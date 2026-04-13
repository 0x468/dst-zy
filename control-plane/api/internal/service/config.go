package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/files"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
	"github.com/gwf/dst-docker/control-plane/api/internal/runtime"
)

type ConfigService struct {
	repo *cluster.Repository
}

func NewConfigService(repo *cluster.Repository) ConfigService {
	return ConfigService{repo: repo}
}

func (s ConfigService) GetSnapshot(_ context.Context, slug string) (models.ClusterConfigSnapshot, error) {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}

	clusterPath := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName, "cluster.ini")
	masterPath := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName, "Master", "server.ini")
	cavesPath := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName, "Caves", "server.ini")

	clusterCfg, err := files.ParseClusterINI(clusterPath)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}
	rawClusterINI, err := os.ReadFile(clusterPath)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}
	masterCfg, err := files.ParseServerINI(masterPath)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}
	cavesCfg, err := files.ParseServerINI(cavesPath)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}

	snapshot := files.BuildSnapshot(clusterCfg, masterCfg, cavesCfg, string(rawClusterINI))
	snapshot.ClusterToken, err = readClusterToken(filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName, "cluster_token.txt"))
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}
	snapshot.MasterHostPort = record.MasterHostPort
	snapshot.CavesHostPort = record.CavesHostPort
	snapshot.MasterSteamHostPort = record.MasterSteamHostPort
	snapshot.CavesSteamHostPort = record.CavesSteamHostPort

	return snapshot, nil
}

func (s ConfigService) SaveSnapshot(_ context.Context, slug string, snapshot models.ClusterConfigSnapshot) error {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return err
	}

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	clusterINIPath := filepath.Join(clusterDir, "cluster.ini")
	clusterCfg, err := files.ParseClusterINI(clusterINIPath)
	if err != nil {
		return err
	}
	masterCfg, err := files.ParseServerINI(filepath.Join(clusterDir, "Master", "server.ini"))
	if err != nil {
		return err
	}
	cavesCfg, err := files.ParseServerINI(filepath.Join(clusterDir, "Caves", "server.ini"))
	if err != nil {
		return err
	}
	if err := writeClusterToken(filepath.Join(clusterDir, "cluster_token.txt"), snapshot.ClusterToken); err != nil {
		return err
	}
	if err := validateManagedPorts(handlers.ClusterMutationRequest{
		MasterHostPort:     snapshot.MasterHostPort,
		CavesHostPort:      snapshot.CavesHostPort,
		SteamHostPort:      snapshot.MasterSteamHostPort,
		CavesSteamHostPort: snapshot.CavesSteamHostPort,
	}); err != nil {
		return err
	}

	if snapshot.RawFiles != nil && strings.TrimSpace(snapshot.RawFiles.ClusterINI) != "" {
		rawClusterINI := strings.TrimSpace(snapshot.RawFiles.ClusterINI) + "\n"
		if _, err := files.ParseClusterINIContents(rawClusterINI); err != nil {
			return apierror.Invalid("invalid cluster.ini", err)
		}
		if err := os.WriteFile(clusterINIPath, []byte(rawClusterINI), 0o644); err != nil {
			return err
		}
	} else {
		clusterCfg.Network.ClusterName = snapshot.ClusterName
		clusterCfg.Network.ClusterDescription = snapshot.ClusterDescription
		clusterCfg.Network.ClusterPassword = snapshot.ClusterPassword
		clusterCfg.Network.ClusterIntention = snapshot.ClusterIntention
		clusterCfg.Gameplay.GameMode = snapshot.GameMode
		clusterCfg.Gameplay.MaxPlayers = snapshot.MaxPlayers
		clusterCfg.Gameplay.PVP = snapshot.PVP
		clusterCfg.Gameplay.PauseWhenEmpty = snapshot.PauseWhenEmpty
		clusterCfg.Shard.ShardEnabled = snapshot.ShardEnabled
		clusterCfg.Shard.BindIP = snapshot.BindIP
		clusterCfg.Shard.MasterIP = snapshot.MasterIP
		clusterCfg.Shard.ClusterKey = snapshot.ClusterKey
		clusterCfg.Shard.MasterPort = snapshot.MasterPort
		if err := files.WriteClusterINI(clusterINIPath, clusterCfg); err != nil {
			return err
		}
	}
	masterCfg.Network.ServerPort = snapshot.Master.ServerPort
	masterCfg.Steam.MasterServerPort = snapshot.Master.MasterServerPort
	masterCfg.Steam.AuthenticationPort = snapshot.Master.AuthenticationPort
	cavesCfg.Network.ServerPort = snapshot.Caves.ServerPort
	cavesCfg.Steam.MasterServerPort = snapshot.Caves.MasterServerPort
	cavesCfg.Steam.AuthenticationPort = snapshot.Caves.AuthenticationPort

	if err := files.WriteServerINI(filepath.Join(clusterDir, "Master", "server.ini"), masterCfg); err != nil {
		return err
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Caves", "server.ini"), cavesCfg); err != nil {
		return err
	}
	record.MasterHostPort = snapshot.MasterHostPort
	record.CavesHostPort = snapshot.CavesHostPort
	record.MasterSteamHostPort = snapshot.MasterSteamHostPort
	record.CavesSteamHostPort = snapshot.CavesSteamHostPort
	if err := os.WriteFile(record.EnvFile, []byte(runtime.GenerateEnvFile(runtime.ComposeTemplateInput{
		ClusterName:          record.ClusterName,
		UpdateMode:           record.UpdateMode,
		ServerModsUpdateMode: record.ServerModsUpdateMode,
		TimeZone:             record.TimeZone,
		MasterHostPort:       record.MasterHostPort,
		CavesHostPort:        record.CavesHostPort,
		SteamHostPort:        record.MasterSteamHostPort,
		CavesSteamHostPort:   record.CavesSteamHostPort,
	})), 0o644); err != nil {
		return err
	}
	if err := s.repo.UpdateRuntimeMetadata(record); err != nil {
		return err
	}

	return nil
}

func readClusterToken(path string) (string, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}

	return strings.TrimSpace(string(contents)), nil
}

func writeClusterToken(path string, token string) error {
	return os.WriteFile(path, []byte(strings.TrimSpace(token)+"\n"), 0o600)
}

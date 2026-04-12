package service

import (
	"context"
	"errors"
	"io"
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

type ClusterService struct {
	repo  *cluster.Repository
	guard files.Guard
	image string
}

func NewClusterService(repo *cluster.Repository, guard files.Guard, image string) ClusterService {
	return ClusterService{repo: repo, guard: guard, image: image}
}

func (s ClusterService) List(_ context.Context) ([]models.ClusterRecord, error) {
	return s.repo.List()
}

func (s ClusterService) Create(_ context.Context, req handlers.ClusterMutationRequest) (models.ClusterRecord, error) {
	clusterDir, err := s.guard.ClusterDir(req.Slug)
	if err != nil {
		return models.ClusterRecord{}, mapClusterMutationError(err)
	}
	if err := validateManagedPorts(req); err != nil {
		return models.ClusterRecord{}, err
	}

	layout := files.BuildManagedLayout(clusterDir)
	if err := s.prepareLayout(layout, req.ClusterName); err != nil {
		return models.ClusterRecord{}, err
	}

	snapshot := snapshotFromCreateRequest(req)
	if err := s.writeSnapshot(layout, req.ClusterName, req.ClusterToken, snapshot); err != nil {
		return models.ClusterRecord{}, err
	}

	composePath, envPath, err := s.writeComposeArtifacts(layout, req)
	if err != nil {
		return models.ClusterRecord{}, err
	}

	timeZone := req.TimeZone
	if timeZone == "" {
		timeZone = models.StandardClosureDefaultTimeZone
	}

	return s.repo.Create(models.ClusterRecord{
		Slug:                 req.Slug,
		DisplayName:          req.DisplayName,
		ClusterName:          req.ClusterName,
		BaseDir:              clusterDir,
		ComposeFile:          composePath,
		EnvFile:              envPath,
		Status:               "stopped",
		UpdateMode:           models.StandardClosureDefaultUpdateMode,
		ServerModsUpdateMode: models.StandardClosureDefaultServerModsUpdateMode,
		TimeZone:             timeZone,
		MasterHostPort:       req.MasterHostPort,
		CavesHostPort:        req.CavesHostPort,
		MasterSteamHostPort:  req.SteamHostPort,
		CavesSteamHostPort:   req.CavesSteamHostPort,
	})
}

func (s ClusterService) Import(_ context.Context, req handlers.ClusterMutationRequest) (models.ClusterRecord, error) {
	if req.BaseDir == "" {
		return models.ClusterRecord{}, apierror.Invalid("base_dir required for import", nil)
	}
	if err := s.guard.EnsureWithinRoot(req.BaseDir); err != nil {
		return models.ClusterRecord{}, mapClusterMutationError(err)
	}

	clusterDir, err := s.guard.ClusterDir(req.Slug)
	if err != nil {
		return models.ClusterRecord{}, mapClusterMutationError(err)
	}

	layout := files.BuildManagedLayout(clusterDir)
	if err := s.prepareLayout(layout, req.ClusterName); err != nil {
		return models.ClusterRecord{}, err
	}

	targetDataDir := filepath.Join(layout.RuntimeDir, "data", req.ClusterName)
	if err := copyClusterDir(req.BaseDir, targetDataDir); err != nil {
		return models.ClusterRecord{}, err
	}

	composePath, envPath, err := s.writeComposeArtifacts(layout, req)
	if err != nil {
		return models.ClusterRecord{}, err
	}

	return s.repo.Create(models.ClusterRecord{
		Slug:        req.Slug,
		DisplayName: req.DisplayName,
		ClusterName: req.ClusterName,
		BaseDir:     clusterDir,
		ComposeFile: composePath,
		EnvFile:     envPath,
		Status:      "stopped",
	})
}

func (s ClusterService) Delete(_ context.Context, slug string) (models.ClusterRecord, error) {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return models.ClusterRecord{}, err
	}
	if record.Status != "stopped" {
		return models.ClusterRecord{}, apierror.Invalid("cluster must be stopped before deletion", nil)
	}
	if err := s.guard.EnsureWithinRoot(record.BaseDir); err != nil {
		return models.ClusterRecord{}, mapClusterMutationError(err)
	}
	if err := os.RemoveAll(record.BaseDir); err != nil {
		return models.ClusterRecord{}, err
	}
	if err := s.repo.Delete(record.ID); err != nil {
		return models.ClusterRecord{}, err
	}

	return record, nil
}

func (s ClusterService) prepareLayout(layout files.ManagedLayout, clusterName string) error {
	dirs := []string{
		layout.RootDir,
		layout.ComposeDir,
		layout.MetaDir,
		layout.RuntimeDir,
		filepath.Join(layout.RuntimeDir, "steam-state"),
		filepath.Join(layout.RuntimeDir, "dst"),
		filepath.Join(layout.RuntimeDir, "ugc"),
		filepath.Join(layout.RuntimeDir, "data", clusterName, "Master"),
		filepath.Join(layout.RuntimeDir, "data", clusterName, "Caves"),
		filepath.Join(layout.RuntimeDir, "data", clusterName, "mods"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}

	return nil
}

func (s ClusterService) writeSnapshot(layout files.ManagedLayout, clusterName string, clusterToken string, snapshot models.ClusterConfigSnapshot) error {
	clusterDir := filepath.Join(layout.RuntimeDir, "data", clusterName)

	clusterCfg := files.ClusterINIConfig{}
	clusterCfg.Gameplay.GameMode = snapshot.GameMode
	clusterCfg.Gameplay.MaxPlayers = snapshot.MaxPlayers
	clusterCfg.Gameplay.PVP = snapshot.PVP
	clusterCfg.Gameplay.PauseWhenEmpty = snapshot.PauseWhenEmpty
	clusterCfg.Network.ClusterName = snapshot.ClusterName
	clusterCfg.Network.ClusterDescription = snapshot.ClusterDescription
	clusterCfg.Network.ClusterPassword = ""
	clusterCfg.Network.ClusterIntention = snapshot.ClusterIntention
	clusterCfg.Misc.ConsoleEnabled = true
	clusterCfg.Shard.ShardEnabled = snapshot.ShardEnabled
	clusterCfg.Shard.BindIP = snapshot.BindIP
	clusterCfg.Shard.MasterIP = snapshot.MasterIP
	clusterCfg.Shard.MasterPort = snapshot.MasterPort
	clusterCfg.Shard.ClusterKey = snapshot.ClusterKey

	masterCfg := files.ServerINIConfig{}
	masterCfg.Network.ServerPort = snapshot.Master.ServerPort
	masterCfg.Shard.IsMaster = snapshot.Master.IsMaster
	masterCfg.Shard.Name = snapshot.Master.Name
	masterCfg.Shard.ID = snapshot.Master.ID
	masterCfg.Account.EncodeUserPath = snapshot.Master.EncodeUserPath
	masterCfg.Steam.MasterServerPort = snapshot.Master.MasterServerPort
	masterCfg.Steam.AuthenticationPort = snapshot.Master.AuthenticationPort

	cavesCfg := files.ServerINIConfig{}
	cavesCfg.Network.ServerPort = snapshot.Caves.ServerPort
	cavesCfg.Shard.IsMaster = snapshot.Caves.IsMaster
	cavesCfg.Shard.Name = snapshot.Caves.Name
	cavesCfg.Shard.ID = snapshot.Caves.ID
	cavesCfg.Account.EncodeUserPath = snapshot.Caves.EncodeUserPath
	cavesCfg.Steam.MasterServerPort = snapshot.Caves.MasterServerPort
	cavesCfg.Steam.AuthenticationPort = snapshot.Caves.AuthenticationPort

	if err := files.WriteClusterINI(filepath.Join(clusterDir, "cluster.ini"), clusterCfg); err != nil {
		return err
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Master", "server.ini"), masterCfg); err != nil {
		return err
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Caves", "server.ini"), cavesCfg); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(clusterDir, "cluster_token.txt"), []byte(strings.TrimSpace(clusterToken)+"\n"), 0o644); err != nil {
		return err
	}

	return nil
}

func (s ClusterService) writeComposeArtifacts(layout files.ManagedLayout, req handlers.ClusterMutationRequest) (string, string, error) {
	timeZone := req.TimeZone
	if strings.TrimSpace(timeZone) == "" {
		timeZone = models.StandardClosureDefaultTimeZone
	}
	masterHostPort := req.MasterHostPort
	if masterHostPort == 0 {
		masterHostPort = models.StandardClosureDefaultMasterHostPort
	}
	cavesHostPort := req.CavesHostPort
	if cavesHostPort == 0 {
		cavesHostPort = models.StandardClosureDefaultCavesHostPort
	}
	steamHostPort := req.SteamHostPort
	if steamHostPort == 0 {
		steamHostPort = models.StandardClosureDefaultMasterSteamHostPort
	}
	cavesSteamHostPort := req.CavesSteamHostPort
	if cavesSteamHostPort == 0 {
		cavesSteamHostPort = models.StandardClosureDefaultCavesSteamHostPort
	}

	input := runtime.ComposeTemplateInput{
		Image:                s.image,
		ClusterName:          req.ClusterName,
		UpdateMode:           models.StandardClosureDefaultUpdateMode,
		ServerModsUpdateMode: models.StandardClosureDefaultServerModsUpdateMode,
		TimeZone:             timeZone,
		MasterHostPort:       masterHostPort,
		CavesHostPort:        cavesHostPort,
		SteamHostPort:        steamHostPort,
		CavesSteamHostPort:   cavesSteamHostPort,
	}

	composePath := filepath.Join(layout.ComposeDir, "docker-compose.yml")
	envPath := filepath.Join(layout.ComposeDir, ".env")
	if err := os.WriteFile(composePath, []byte(runtime.GenerateComposeYAML(input)), 0o644); err != nil {
		return "", "", err
	}
	if err := os.WriteFile(envPath, []byte(runtime.GenerateEnvFile(input)), 0o644); err != nil {
		return "", "", err
	}

	return composePath, envPath, nil
}

func snapshotFromCreateRequest(req handlers.ClusterMutationRequest) models.ClusterConfigSnapshot {
	snapshot := files.DefaultManagedSnapshot(req.ClusterName)
	if strings.TrimSpace(req.ClusterDescription) != "" {
		snapshot.ClusterDescription = req.ClusterDescription
	}
	if strings.TrimSpace(req.GameMode) != "" {
		snapshot.GameMode = req.GameMode
	}
	if req.MaxPlayers > 0 {
		snapshot.MaxPlayers = req.MaxPlayers
	}
	if strings.TrimSpace(req.ClusterKey) != "" {
		snapshot.ClusterKey = req.ClusterKey
	}
	if strings.TrimSpace(req.Intent) != "" {
		snapshot.ClusterIntention = req.Intent
	}
	return snapshot
}

func validateManagedPorts(req handlers.ClusterMutationRequest) error {
	ports := []int{req.MasterHostPort, req.CavesHostPort, req.SteamHostPort, req.CavesSteamHostPort}
	seen := map[int]struct{}{}
	for _, port := range ports {
		if port <= 0 {
			return apierror.Invalid("invalid port", nil)
		}
		if _, ok := seen[port]; ok {
			return apierror.Invalid("duplicate ports are not allowed", nil)
		}
		seen[port] = struct{}{}
	}
	return nil
}

func copyClusterDir(src string, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relativePath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if relativePath == "." {
			return os.MkdirAll(dst, info.Mode().Perm())
		}

		targetPath := filepath.Join(dst, relativePath)
		mode := info.Mode()

		switch {
		case mode.IsDir():
			return os.MkdirAll(targetPath, mode.Perm())
		case mode.IsRegular():
			return copyRegularFile(path, targetPath, mode.Perm())
		default:
			return apierror.Invalid("import contains unsupported file type", nil)
		}
	})
}

func copyRegularFile(src string, dst string, perm os.FileMode) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}

	targetFile, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, perm)
	if err != nil {
		return err
	}
	defer targetFile.Close()

	if _, err := io.Copy(targetFile, sourceFile); err != nil {
		return err
	}

	return nil
}

func mapClusterMutationError(err error) error {
	switch {
	case errors.Is(err, files.ErrInvalidSlug):
		return apierror.Invalid("invalid cluster slug", err)
	case errors.Is(err, files.ErrPathOutsideRoot):
		return apierror.Invalid("path outside managed root", err)
	default:
		return err
	}
}

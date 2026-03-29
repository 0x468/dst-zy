package service

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"

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

	layout := files.BuildManagedLayout(clusterDir)
	if err := s.prepareLayout(layout, req.ClusterName); err != nil {
		return models.ClusterRecord{}, err
	}

	snapshot := defaultSnapshot(req.ClusterName)
	if err := s.writeSnapshot(layout, req.ClusterName, snapshot); err != nil {
		return models.ClusterRecord{}, err
	}

	composePath, envPath, err := s.writeComposeArtifacts(layout, req.ClusterName)
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

	composePath, envPath, err := s.writeComposeArtifacts(layout, req.ClusterName)
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

func (s ClusterService) writeSnapshot(layout files.ManagedLayout, clusterName string, snapshot models.ClusterConfigSnapshot) error {
	clusterDir := filepath.Join(layout.RuntimeDir, "data", clusterName)

	clusterCfg := files.ClusterINIConfig{}
	clusterCfg.Gameplay.GameMode = snapshot.GameMode
	clusterCfg.Gameplay.MaxPlayers = 6
	clusterCfg.Gameplay.PVP = false
	clusterCfg.Gameplay.PauseWhenEmpty = true
	clusterCfg.Network.ClusterName = snapshot.ClusterName
	clusterCfg.Network.ClusterDescription = snapshot.ClusterDescription
	clusterCfg.Network.ClusterPassword = ""
	clusterCfg.Network.ClusterIntention = "cooperative"
	clusterCfg.Misc.ConsoleEnabled = true
	clusterCfg.Shard.ShardEnabled = true
	clusterCfg.Shard.BindIP = "0.0.0.0"
	clusterCfg.Shard.MasterIP = "127.0.0.1"
	clusterCfg.Shard.MasterPort = snapshot.MasterPort
	clusterCfg.Shard.ClusterKey = snapshot.ClusterKey

	masterCfg := files.ServerINIConfig{}
	masterCfg.Network.ServerPort = snapshot.Master.ServerPort
	masterCfg.Shard.IsMaster = true
	masterCfg.Shard.Name = "Master"
	masterCfg.Shard.ID = "1"
	masterCfg.Account.EncodeUserPath = true
	masterCfg.Steam.MasterServerPort = snapshot.Master.MasterServerPort
	masterCfg.Steam.AuthenticationPort = snapshot.Master.AuthenticationPort

	cavesCfg := files.ServerINIConfig{}
	cavesCfg.Network.ServerPort = snapshot.Caves.ServerPort
	cavesCfg.Shard.IsMaster = false
	cavesCfg.Shard.Name = "Caves"
	cavesCfg.Shard.ID = "95247852"
	cavesCfg.Account.EncodeUserPath = true
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

	return nil
}

func (s ClusterService) writeComposeArtifacts(layout files.ManagedLayout, clusterName string) (string, string, error) {
	input := runtime.ComposeTemplateInput{
		Image:                s.image,
		ClusterName:          clusterName,
		UpdateMode:           "install-only",
		ServerModsUpdateMode: "runtime",
		TimeZone:             "Asia/Shanghai",
		MasterHostPort:       11000,
		CavesHostPort:        11001,
		SteamHostPort:        27018,
		CavesSteamHostPort:   27019,
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

func defaultSnapshot(clusterName string) models.ClusterConfigSnapshot {
	return models.ClusterConfigSnapshot{
		ClusterName:        clusterName,
		ClusterDescription: "Managed by DST Control Plane",
		GameMode:           "survival",
		ClusterKey:         "replace-me-cluster-key",
		MasterPort:         10889,
		Master: models.ShardConfigSnapshot{
			ServerPort:         11000,
			MasterServerPort:   27018,
			AuthenticationPort: 8768,
		},
		Caves: models.ShardConfigSnapshot{
			ServerPort:         11001,
			MasterServerPort:   27019,
			AuthenticationPort: 8769,
		},
	}
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

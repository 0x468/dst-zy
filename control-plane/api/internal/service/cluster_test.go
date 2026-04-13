package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/files"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestClusterServiceRejectsInvalidSlug(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	_, err = service.Create(context.Background(), handlers.ClusterMutationRequest{
		Mode:               "create",
		Slug:               "../bad",
		DisplayName:        "Bad Cluster",
		ClusterName:        "Bad_Cluster",
		ClusterDescription: "Bad Cluster Description",
		GameMode:           "survival",
		MaxPlayers:         6,
		ClusterToken:       "bad-token",
		ClusterKey:         "bad-key",
		Intent:             "cooperative",
		TimeZone:           "Asia/Shanghai",
		MasterHostPort:     11000,
		CavesHostPort:      11001,
		SteamHostPort:      27018,
		CavesSteamHostPort: 27019,
		AutoStart:          false,
	})
	if err == nil {
		t.Fatal("expected invalid slug to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected invalid slug to return invalid api error, got %T %v", err, err)
	}
}

func TestClusterServiceCreateBuildsPlayableMasterAndCavesLayout(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	record, err := service.Create(context.Background(), handlers.ClusterMutationRequest{
		Mode:               "create",
		Slug:               "cluster-a",
		DisplayName:        "Cluster A",
		ClusterName:        "Cluster_A",
		ClusterDescription: "Welcome to Cluster A",
		GameMode:           "endless",
		MaxPlayers:         8,
		PVP:                true,
		PauseWhenEmpty:     false,
		ClusterPassword:    "play-together",
		ClusterToken:       "cluster-token-123",
		ClusterKey:         "cluster-key-xyz",
		Intent:             "social",
		TimeZone:           "UTC",
		MasterHostPort:     12000,
		CavesHostPort:      12001,
		SteamHostPort:      28018,
		CavesSteamHostPort: 28019,
		AutoStart:          false,
	})
	if err != nil {
		t.Fatalf("expected create to succeed, got error: %v", err)
	}

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", "Cluster_A")
	clusterINIPath := filepath.Join(clusterDir, "cluster.ini")
	masterINIPath := filepath.Join(clusterDir, "Master", "server.ini")
	cavesINIPath := filepath.Join(clusterDir, "Caves", "server.ini")
	clusterTokenPath := filepath.Join(clusterDir, "cluster_token.txt")

	clusterCfg, err := files.ParseClusterINI(clusterINIPath)
	if err != nil {
		t.Fatalf("expected cluster.ini to parse, got error: %v", err)
	}
	if clusterCfg.Network.ClusterName != "Cluster_A" {
		t.Fatalf("expected cluster name to persist, got %q", clusterCfg.Network.ClusterName)
	}
	if clusterCfg.Network.ClusterDescription != "Welcome to Cluster A" {
		t.Fatalf("expected cluster description to persist, got %q", clusterCfg.Network.ClusterDescription)
	}
	if clusterCfg.Gameplay.GameMode != "endless" {
		t.Fatalf("expected game_mode to persist, got %q", clusterCfg.Gameplay.GameMode)
	}
	if clusterCfg.Gameplay.MaxPlayers != 8 {
		t.Fatalf("expected max_players to persist, got %d", clusterCfg.Gameplay.MaxPlayers)
	}
	if !clusterCfg.Gameplay.PVP {
		t.Fatal("expected pvp to persist as true")
	}
	if clusterCfg.Gameplay.PauseWhenEmpty {
		t.Fatal("expected pause_when_empty to persist as false")
	}
	if clusterCfg.Network.ClusterIntention != "social" {
		t.Fatalf("expected cluster_intention to persist, got %q", clusterCfg.Network.ClusterIntention)
	}
	if clusterCfg.Network.ClusterPassword != "play-together" {
		t.Fatalf("expected cluster_password to persist, got %q", clusterCfg.Network.ClusterPassword)
	}
	if clusterCfg.Shard.ClusterKey != "cluster-key-xyz" {
		t.Fatalf("expected cluster_key to persist, got %q", clusterCfg.Shard.ClusterKey)
	}

	masterCfg, err := files.ParseServerINI(masterINIPath)
	if err != nil {
		t.Fatalf("expected master server.ini to parse, got error: %v", err)
	}
	if !masterCfg.Shard.IsMaster || masterCfg.Shard.Name != "Master" {
		t.Fatalf("expected master shard metadata, got is_master=%t name=%q", masterCfg.Shard.IsMaster, masterCfg.Shard.Name)
	}

	cavesCfg, err := files.ParseServerINI(cavesINIPath)
	if err != nil {
		t.Fatalf("expected caves server.ini to parse, got error: %v", err)
	}
	if cavesCfg.Shard.IsMaster || cavesCfg.Shard.Name != "Caves" {
		t.Fatalf("expected caves shard metadata, got is_master=%t name=%q", cavesCfg.Shard.IsMaster, cavesCfg.Shard.Name)
	}

	clusterToken, err := os.ReadFile(clusterTokenPath)
	if err != nil {
		t.Fatalf("expected cluster_token.txt to be written, got error: %v", err)
	}
	if strings.TrimSpace(string(clusterToken)) != "cluster-token-123" {
		t.Fatalf("expected cluster token to persist, got %q", strings.TrimSpace(string(clusterToken)))
	}
	clusterTokenInfo, err := os.Stat(clusterTokenPath)
	if err != nil {
		t.Fatalf("expected cluster_token.txt stat to succeed, got error: %v", err)
	}
	if clusterTokenInfo.Mode().Perm() != 0o600 {
		t.Fatalf("expected cluster_token.txt permissions 0600, got %o", clusterTokenInfo.Mode().Perm())
	}

	composeYAML, err := os.ReadFile(record.ComposeFile)
	if err != nil {
		t.Fatalf("expected compose yaml to exist, got error: %v", err)
	}
	if !strings.Contains(string(composeYAML), "${DST_MASTER_HOST_PORT:-12000}:11000/udp") {
		t.Fatalf("expected compose yaml to include master host port mapping, got %q", string(composeYAML))
	}
	if !strings.Contains(string(composeYAML), "${DST_CAVES_HOST_PORT:-12001}:11001/udp") {
		t.Fatalf("expected compose yaml to include caves host port mapping, got %q", string(composeYAML))
	}
	if !strings.Contains(string(composeYAML), "${DST_STEAM_HOST_PORT:-28018}:27018/udp") {
		t.Fatalf("expected compose yaml to include steam host port mapping, got %q", string(composeYAML))
	}
	if !strings.Contains(string(composeYAML), "${DST_CAVES_STEAM_HOST_PORT:-28019}:27019/udp") {
		t.Fatalf("expected compose yaml to include caves steam host port mapping, got %q", string(composeYAML))
	}

	envFile, err := os.ReadFile(record.EnvFile)
	if err != nil {
		t.Fatalf("expected env file to exist, got error: %v", err)
	}
	env := string(envFile)
	if !strings.Contains(env, "DST_CLUSTER_NAME=Cluster_A") {
		t.Fatalf("expected env file to include cluster name, got %q", env)
	}
	if !strings.Contains(env, "DST_UPDATE_MODE=install-only") {
		t.Fatalf("expected env file to include default update mode, got %q", env)
	}
	if !strings.Contains(env, "DST_SERVER_MODS_UPDATE_MODE=runtime") {
		t.Fatalf("expected env file to include default server mods update mode, got %q", env)
	}
	if !strings.Contains(env, "DST_MASTER_HOST_PORT=12000") {
		t.Fatalf("expected env file to include master host port, got %q", env)
	}
	if !strings.Contains(env, "DST_CAVES_HOST_PORT=12001") {
		t.Fatalf("expected env file to include caves host port, got %q", env)
	}
	if !strings.Contains(env, "DST_STEAM_HOST_PORT=28018") {
		t.Fatalf("expected env file to include steam host port, got %q", env)
	}
	if !strings.Contains(env, "DST_CAVES_STEAM_HOST_PORT=28019") {
		t.Fatalf("expected env file to include caves steam host port, got %q", env)
	}
	if !strings.Contains(env, "TZ=UTC") {
		t.Fatalf("expected env file to include timezone, got %q", env)
	}

	saved, err := repo.GetBySlug("cluster-a")
	if err != nil {
		t.Fatalf("expected created record to exist, got error: %v", err)
	}
	if saved.MasterHostPort != 12000 || saved.CavesHostPort != 12001 {
		t.Fatalf("expected host ports to persist in metadata, got master=%d caves=%d", saved.MasterHostPort, saved.CavesHostPort)
	}
	if saved.MasterSteamHostPort != 28018 || saved.CavesSteamHostPort != 28019 {
		t.Fatalf("expected steam ports to persist in metadata, got master=%d caves=%d", saved.MasterSteamHostPort, saved.CavesSteamHostPort)
	}
	if saved.TimeZone != "UTC" {
		t.Fatalf("expected timezone to persist in metadata, got %q", saved.TimeZone)
	}
}

func TestClusterServiceCreateRejectsConflictingPorts(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	_, err = service.Create(context.Background(), handlers.ClusterMutationRequest{
		Mode:               "create",
		Slug:               "cluster-a",
		DisplayName:        "Cluster A",
		ClusterName:        "Cluster_A",
		ClusterDescription: "Welcome to Cluster A",
		GameMode:           "survival",
		MaxPlayers:         6,
		ClusterToken:       "cluster-token-123",
		ClusterKey:         "cluster-key-xyz",
		Intent:             "cooperative",
		TimeZone:           "Asia/Shanghai",
		MasterHostPort:     12000,
		CavesHostPort:      12000,
		SteamHostPort:      28018,
		CavesSteamHostPort: 28019,
		AutoStart:          false,
	})
	if err == nil {
		t.Fatal("expected conflicting ports to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected conflicting ports to return invalid api error, got %T %v", err, err)
	}

	if _, err := repo.GetBySlug("cluster-a"); err == nil {
		t.Fatal("expected create to fail before record insertion")
	}
	if _, err := os.Stat(filepath.Join(rootDir, "clusters", "cluster-a")); !os.IsNotExist(err) {
		t.Fatalf("expected create to fail before writing files, got err=%v", err)
	}
}

func TestClusterServiceCreateRejectsPortOutsideValidRange(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	_, err = service.Create(context.Background(), handlers.ClusterMutationRequest{
		Mode:               "create",
		Slug:               "cluster-a",
		DisplayName:        "Cluster A",
		ClusterName:        "Cluster_A",
		ClusterDescription: "Welcome to Cluster A",
		GameMode:           "survival",
		MaxPlayers:         6,
		ClusterToken:       "cluster-token-123",
		ClusterKey:         "cluster-key-xyz",
		Intent:             "cooperative",
		TimeZone:           "Asia/Shanghai",
		MasterHostPort:     70000,
		CavesHostPort:      12001,
		SteamHostPort:      28018,
		CavesSteamHostPort: 28019,
		AutoStart:          false,
	})
	if err == nil {
		t.Fatal("expected out-of-range port to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected out-of-range port to return invalid api error, got %T %v", err, err)
	}
}

func TestClusterServiceImportRejectsMissingBaseDir(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	_, err = service.Import(context.Background(), handlers.ClusterMutationRequest{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
	})
	if err == nil {
		t.Fatal("expected missing base_dir to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected missing base_dir to return invalid api error, got %T %v", err, err)
	}
}

func TestClusterServiceImportRejectsPathOutsideRoot(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	_, err = service.Import(context.Background(), handlers.ClusterMutationRequest{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     "/tmp/outside-root",
	})
	if err == nil {
		t.Fatal("expected outside-root base_dir to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected outside-root base_dir to return invalid api error, got %T %v", err, err)
	}
}

func TestClusterServiceImportCopiesExistingClusterContentsRecursively(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	sourceDir := filepath.Join(rootDir, "legacy-cluster")
	sourceFiles := map[string]string{
		"cluster.ini":       "[NETWORK]\ncluster_name = Legacy Cluster\n",
		"Master/server.ini": "[NETWORK]\nserver_port = 11000\n",
		"Caves/server.ini":  "[NETWORK]\nserver_port = 11001\n",
		"Master/save/session/ABCDEF/snapshot.meta": "snapshot-data",
		"Master/modoverrides.lua":                  "return {}",
		"mods/dedicated_server_mods_setup.lua":     "ServerModSetup(\"workshop-362175979\")\n",
		"mods/workshop-362175979/modinfo.lua":      "name = \"Test Mod\"\n",
		"saveindex":                                "slotdata",
	}
	for relativePath, contents := range sourceFiles {
		targetPath := filepath.Join(sourceDir, filepath.FromSlash(relativePath))
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			t.Fatalf("expected fixture directory to be created, got error: %v", err)
		}
		if err := os.WriteFile(targetPath, []byte(contents), 0o644); err != nil {
			t.Fatalf("expected fixture file to be written, got error: %v", err)
		}
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	record, err := service.Import(context.Background(), handlers.ClusterMutationRequest{
		Slug:               "cluster-a",
		DisplayName:        "Cluster A",
		ClusterName:        "Cluster_A",
		BaseDir:            sourceDir,
		TimeZone:           "UTC",
		MasterHostPort:     12000,
		CavesHostPort:      12001,
		SteamHostPort:      28018,
		CavesSteamHostPort: 28019,
	})
	if err != nil {
		t.Fatalf("expected import to succeed, got error: %v", err)
	}

	importedRoot := filepath.Join(filepath.Dir(record.ComposeFile), "..", "runtime", "data", "Cluster_A")
	for relativePath, contents := range sourceFiles {
		targetPath := filepath.Join(importedRoot, filepath.FromSlash(relativePath))
		data, err := os.ReadFile(targetPath)
		if err != nil {
			t.Fatalf("expected imported file %s to exist, got error: %v", relativePath, err)
		}
		if string(data) != contents {
			t.Fatalf("expected imported file %s contents %q, got %q", relativePath, contents, string(data))
		}
	}

	envFile, err := os.ReadFile(record.EnvFile)
	if err != nil {
		t.Fatalf("expected env file to exist, got error: %v", err)
	}
	env := string(envFile)
	if !strings.Contains(env, "DST_MASTER_HOST_PORT=12000") {
		t.Fatalf("expected env file to include imported master host port, got %q", env)
	}
	if !strings.Contains(env, "DST_CAVES_HOST_PORT=12001") {
		t.Fatalf("expected env file to include imported caves host port, got %q", env)
	}
	if !strings.Contains(env, "DST_STEAM_HOST_PORT=28018") {
		t.Fatalf("expected env file to include imported steam host port, got %q", env)
	}
	if !strings.Contains(env, "DST_CAVES_STEAM_HOST_PORT=28019") {
		t.Fatalf("expected env file to include imported caves steam host port, got %q", env)
	}
	if !strings.Contains(env, "TZ=UTC") {
		t.Fatalf("expected env file to include imported timezone, got %q", env)
	}

	saved, err := repo.GetBySlug("cluster-a")
	if err != nil {
		t.Fatalf("expected imported record to exist, got error: %v", err)
	}
	if saved.MasterHostPort != 12000 || saved.CavesHostPort != 12001 {
		t.Fatalf("expected imported host ports to persist in metadata, got master=%d caves=%d", saved.MasterHostPort, saved.CavesHostPort)
	}
	if saved.MasterSteamHostPort != 28018 || saved.CavesSteamHostPort != 28019 {
		t.Fatalf("expected imported steam ports to persist in metadata, got master=%d caves=%d", saved.MasterSteamHostPort, saved.CavesSteamHostPort)
	}
	if saved.TimeZone != "UTC" {
		t.Fatalf("expected imported timezone to persist in metadata, got %q", saved.TimeZone)
	}
}

func TestClusterServiceImportRejectsConflictingPorts(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	sourceDir := filepath.Join(rootDir, "legacy-cluster")
	if err := os.MkdirAll(sourceDir, 0o755); err != nil {
		t.Fatalf("expected source cluster dir to be created, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	_, err = service.Import(context.Background(), handlers.ClusterMutationRequest{
		Slug:               "cluster-a",
		DisplayName:        "Cluster A",
		ClusterName:        "Cluster_A",
		BaseDir:            sourceDir,
		MasterHostPort:     12000,
		CavesHostPort:      12000,
		SteamHostPort:      28018,
		CavesSteamHostPort: 28019,
	})
	if err == nil {
		t.Fatal("expected conflicting import ports to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected conflicting import ports to return invalid api error, got %T %v", err, err)
	}
}

func TestClusterServiceDeleteRejectsRunningCluster(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	record, err := repo.Create(models.ClusterRecord{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     filepath.Join(rootDir, "clusters", "cluster-a"),
		ComposeFile: filepath.Join(rootDir, "clusters", "cluster-a", "compose", "docker-compose.yml"),
		EnvFile:     filepath.Join(rootDir, "clusters", "cluster-a", "compose", ".env"),
		Status:      "running",
	})
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}
	if err := os.MkdirAll(record.BaseDir, 0o755); err != nil {
		t.Fatalf("expected cluster directory to be created, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	_, err = service.Delete(context.Background(), record.Slug)
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected running cluster delete to return invalid error, got %T %v", err, err)
	}
}

func TestClusterServiceDeleteRemovesClusterDirectoryAndRecord(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	record, err := repo.Create(models.ClusterRecord{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     filepath.Join(rootDir, "clusters", "cluster-a"),
		ComposeFile: filepath.Join(rootDir, "clusters", "cluster-a", "compose", "docker-compose.yml"),
		EnvFile:     filepath.Join(rootDir, "clusters", "cluster-a", "compose", ".env"),
		Status:      "stopped",
	})
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	targetFile := filepath.Join(record.BaseDir, "runtime", "data", "Cluster_A", "cluster.ini")
	if err := os.MkdirAll(filepath.Dir(targetFile), 0o755); err != nil {
		t.Fatalf("expected cluster runtime dir to be created, got error: %v", err)
	}
	if err := os.WriteFile(targetFile, []byte("cluster"), 0o644); err != nil {
		t.Fatalf("expected cluster file to be written, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	if _, err := service.Delete(context.Background(), record.Slug); err != nil {
		t.Fatalf("expected cluster delete to succeed, got error: %v", err)
	}

	if _, err := os.Stat(record.BaseDir); !os.IsNotExist(err) {
		t.Fatalf("expected cluster directory to be removed, got err=%v", err)
	}
	if _, err := repo.GetBySlug(record.Slug); err == nil {
		t.Fatal("expected cluster record to be removed")
	}
}

func TestClusterServiceDiscoverReturnsUnmanagedManagedRoots(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	if _, err := repo.Create(models.ClusterRecord{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     filepath.Join(rootDir, "clusters", "cluster-a"),
		ComposeFile: filepath.Join(rootDir, "clusters", "cluster-a", "compose", "docker-compose.yml"),
		EnvFile:     filepath.Join(rootDir, "clusters", "cluster-a", "compose", ".env"),
		Status:      "stopped",
	}); err != nil {
		t.Fatalf("expected managed cluster record to be created, got error: %v", err)
	}

	writeDiscoveredManagedRoot(t, rootDir, "orphan-a", "Legacy_Cluster")
	if err := os.MkdirAll(filepath.Join(rootDir, "clusters", "broken-root", "runtime", "data"), 0o755); err != nil {
		t.Fatalf("expected incomplete managed root to be created, got error: %v", err)
	}

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	discovered, err := service.Discover(context.Background())
	if err != nil {
		t.Fatalf("expected discovery to succeed, got error: %v", err)
	}

	if len(discovered) != 1 {
		t.Fatalf("expected one unmanaged managed root, got %+v", discovered)
	}
	if discovered[0].Slug != "orphan-a" || discovered[0].ClusterName != "Legacy_Cluster" {
		t.Fatalf("expected orphan-a discovery details, got %+v", discovered[0])
	}
	if discovered[0].DisplayName != "Legacy Cluster" {
		t.Fatalf("expected discovery display name to be humanized, got %q", discovered[0].DisplayName)
	}
	if discovered[0].Status != "discovered" {
		t.Fatalf("expected discovery status discovered, got %q", discovered[0].Status)
	}
}

func TestClusterServiceAdoptRegistersDiscoveredManagedRoot(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	writeDiscoveredManagedRoot(t, rootDir, "orphan-a", "Legacy_Cluster")

	service := NewClusterService(repo, guard, "dst-control-plane:test")
	record, err := service.Adopt(context.Background(), "orphan-a")
	if err != nil {
		t.Fatalf("expected adopt to succeed, got error: %v", err)
	}

	if record.Slug != "orphan-a" || record.DisplayName != "Legacy Cluster" {
		t.Fatalf("expected adopted record identity to be preserved, got %+v", record)
	}
	if record.TimeZone != "UTC" {
		t.Fatalf("expected adopt to restore timezone from env, got %q", record.TimeZone)
	}
	if record.MasterHostPort != 12000 || record.CavesHostPort != 12001 {
		t.Fatalf("expected adopt to restore game ports from env, got master=%d caves=%d", record.MasterHostPort, record.CavesHostPort)
	}
	if record.MasterSteamHostPort != 28018 || record.CavesSteamHostPort != 28019 {
		t.Fatalf("expected adopt to restore steam ports from env, got master=%d caves=%d", record.MasterSteamHostPort, record.CavesSteamHostPort)
	}
	if record.UpdateMode != "validate" || record.ServerModsUpdateMode != "prewarm" {
		t.Fatalf("expected adopt to restore runtime profile from env, got update=%q mods=%q", record.UpdateMode, record.ServerModsUpdateMode)
	}

	saved, err := repo.GetBySlug("orphan-a")
	if err != nil {
		t.Fatalf("expected adopted record to persist, got error: %v", err)
	}
	if saved.Note != "Recovered managed root" {
		t.Fatalf("expected adopted record note to describe recovery, got %q", saved.Note)
	}
}

func writeDiscoveredManagedRoot(t *testing.T, rootDir string, slug string, clusterName string) {
	t.Helper()

	clusterDir := filepath.Join(rootDir, "clusters", slug)
	clusterDataDir := filepath.Join(clusterDir, "runtime", "data", clusterName)
	if err := os.MkdirAll(filepath.Join(clusterDataDir, "Master"), 0o755); err != nil {
		t.Fatalf("expected master shard directory to be created, got error: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(clusterDataDir, "Caves"), 0o755); err != nil {
		t.Fatalf("expected caves shard directory to be created, got error: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(clusterDir, "compose"), 0o755); err != nil {
		t.Fatalf("expected compose directory to be created, got error: %v", err)
	}

	clusterCfg := files.ClusterINIConfig{}
	clusterCfg.Network.ClusterName = clusterName
	clusterCfg.Network.ClusterDescription = "Recovered cluster"
	clusterCfg.Gameplay.GameMode = "survival"
	clusterCfg.Shard.ClusterKey = "legacy-key"
	if err := files.WriteClusterINI(filepath.Join(clusterDataDir, "cluster.ini"), clusterCfg); err != nil {
		t.Fatalf("expected cluster.ini to be written, got error: %v", err)
	}

	if err := os.WriteFile(filepath.Join(clusterDir, "compose", "docker-compose.yml"), []byte("services:\n  dst:\n    image: dst-docker:v1\n"), 0o644); err != nil {
		t.Fatalf("expected compose file to be written, got error: %v", err)
	}
	envFile := strings.Join([]string{
		"DST_CLUSTER_NAME=" + clusterName,
		"DST_UPDATE_MODE=validate",
		"DST_SERVER_MODS_UPDATE_MODE=prewarm",
		"DST_MASTER_HOST_PORT=12000",
		"DST_CAVES_HOST_PORT=12001",
		"DST_STEAM_HOST_PORT=28018",
		"DST_CAVES_STEAM_HOST_PORT=28019",
		"TZ=UTC",
		"",
	}, "\n")
	if err := os.WriteFile(filepath.Join(clusterDir, "compose", ".env"), []byte(envFile), 0o644); err != nil {
		t.Fatalf("expected env file to be written, got error: %v", err)
	}
}

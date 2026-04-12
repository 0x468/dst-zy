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
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestConfigServiceRoundTripsRawClusterINI(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
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

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	if err := os.MkdirAll(filepath.Join(clusterDir, "Master"), 0o755); err != nil {
		t.Fatalf("expected master dir to be created, got error: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(clusterDir, "Caves"), 0o755); err != nil {
		t.Fatalf("expected caves dir to be created, got error: %v", err)
	}

	clusterCfg := files.ClusterINIConfig{}
	clusterCfg.Gameplay.GameMode = "survival"
	clusterCfg.Network.ClusterName = "Cluster_A"
	clusterCfg.Network.ClusterDescription = "A co-op world"
	clusterCfg.Shard.ClusterKey = "secret-key"
	clusterCfg.Shard.MasterPort = 10889

	masterCfg := files.ServerINIConfig{}
	masterCfg.Network.ServerPort = 11000
	masterCfg.Steam.MasterServerPort = 27018
	masterCfg.Steam.AuthenticationPort = 8768

	cavesCfg := files.ServerINIConfig{}
	cavesCfg.Network.ServerPort = 11001
	cavesCfg.Steam.MasterServerPort = 27019
	cavesCfg.Steam.AuthenticationPort = 8769

	if err := files.WriteClusterINI(filepath.Join(clusterDir, "cluster.ini"), clusterCfg); err != nil {
		t.Fatalf("expected cluster ini to be written, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(clusterDir, "cluster_token.txt"), []byte("initial-token\n"), 0o600); err != nil {
		t.Fatalf("expected cluster token to be written, got error: %v", err)
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Master", "server.ini"), masterCfg); err != nil {
		t.Fatalf("expected master ini to be written, got error: %v", err)
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Caves", "server.ini"), cavesCfg); err != nil {
		t.Fatalf("expected caves ini to be written, got error: %v", err)
	}

	service := NewConfigService(repo)

	snapshot, err := service.GetSnapshot(context.Background(), record.Slug)
	if err != nil {
		t.Fatalf("expected snapshot to load, got error: %v", err)
	}

	if snapshot.RawFiles == nil || !strings.Contains(snapshot.RawFiles.ClusterINI, "cluster_name = Cluster_A") {
		t.Fatalf("expected raw cluster.ini content in snapshot, got %#v", snapshot.RawFiles)
	}

	rawClusterINI := strings.TrimSpace(`
[GAMEPLAY]
game_mode = endless

[NETWORK]
cluster_name = Raw Cluster
cluster_description = Updated via raw editor

[SHARD]
cluster_key = raw-secret
master_port = 10889
`)

	snapshot.RawFiles = &models.RawConfigFiles{
		ClusterINI: rawClusterINI,
	}
	snapshot.ClusterName = "Cluster_A"
	snapshot.ClusterDescription = "A co-op world"
	snapshot.GameMode = "survival"
	snapshot.ClusterKey = "secret-key"

	if err := service.SaveSnapshot(context.Background(), record.Slug, snapshot); err != nil {
		t.Fatalf("expected raw cluster.ini save to succeed, got error: %v", err)
	}

	writtenClusterINI, err := os.ReadFile(filepath.Join(clusterDir, "cluster.ini"))
	if err != nil {
		t.Fatalf("expected written cluster.ini to be readable, got error: %v", err)
	}

	if strings.TrimSpace(string(writtenClusterINI)) != rawClusterINI {
		t.Fatalf("expected raw cluster.ini to be persisted, got:\n%s", string(writtenClusterINI))
	}
}

func TestConfigServiceRejectsInvalidRawClusterINI(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
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

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	if err := os.MkdirAll(filepath.Join(clusterDir, "Master"), 0o755); err != nil {
		t.Fatalf("expected master dir to be created, got error: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(clusterDir, "Caves"), 0o755); err != nil {
		t.Fatalf("expected caves dir to be created, got error: %v", err)
	}

	if err := files.WriteClusterINI(filepath.Join(clusterDir, "cluster.ini"), files.ClusterINIConfig{}); err != nil {
		t.Fatalf("expected cluster ini to be written, got error: %v", err)
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Master", "server.ini"), files.ServerINIConfig{}); err != nil {
		t.Fatalf("expected master ini to be written, got error: %v", err)
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Caves", "server.ini"), files.ServerINIConfig{}); err != nil {
		t.Fatalf("expected caves ini to be written, got error: %v", err)
	}

	service := NewConfigService(repo)
	err = service.SaveSnapshot(context.Background(), record.Slug, models.ClusterConfigSnapshot{
		ClusterName: "Cluster_A",
		RawFiles: &models.RawConfigFiles{
			ClusterINI: "[NETWORK",
		},
	})
	if err == nil {
		t.Fatal("expected invalid raw cluster.ini to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected invalid raw cluster.ini to return invalid api error, got %T %v", err, err)
	}
}

func TestConfigServiceStructuredSavePersistsHighFrequencyFields(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
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

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	if err := os.MkdirAll(filepath.Join(clusterDir, "Master"), 0o755); err != nil {
		t.Fatalf("expected master dir to be created, got error: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(clusterDir, "Caves"), 0o755); err != nil {
		t.Fatalf("expected caves dir to be created, got error: %v", err)
	}

	clusterCfg := files.ClusterINIConfig{}
	clusterCfg.Gameplay.GameMode = "survival"
	clusterCfg.Gameplay.MaxPlayers = 6
	clusterCfg.Gameplay.PVP = false
	clusterCfg.Gameplay.PauseWhenEmpty = true
	clusterCfg.Network.ClusterName = "Cluster_A"
	clusterCfg.Network.ClusterDescription = "A co-op world"
	clusterCfg.Network.ClusterIntention = "cooperative"
	clusterCfg.Shard.ShardEnabled = true
	clusterCfg.Shard.BindIP = "0.0.0.0"
	clusterCfg.Shard.MasterIP = "127.0.0.1"
	clusterCfg.Shard.ClusterKey = "secret-key"
	clusterCfg.Shard.MasterPort = 10889

	masterCfg := files.ServerINIConfig{}
	masterCfg.Network.ServerPort = 11000
	masterCfg.Steam.MasterServerPort = 27018
	masterCfg.Steam.AuthenticationPort = 8768

	cavesCfg := files.ServerINIConfig{}
	cavesCfg.Network.ServerPort = 11001
	cavesCfg.Steam.MasterServerPort = 27019
	cavesCfg.Steam.AuthenticationPort = 8769

	if err := files.WriteClusterINI(filepath.Join(clusterDir, "cluster.ini"), clusterCfg); err != nil {
		t.Fatalf("expected cluster ini to be written, got error: %v", err)
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Master", "server.ini"), masterCfg); err != nil {
		t.Fatalf("expected master ini to be written, got error: %v", err)
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Caves", "server.ini"), cavesCfg); err != nil {
		t.Fatalf("expected caves ini to be written, got error: %v", err)
	}

	service := NewConfigService(repo)
	err = service.SaveSnapshot(context.Background(), record.Slug, models.ClusterConfigSnapshot{
		ClusterName:        "Cluster_A_Prime",
		ClusterDescription: "Updated cluster",
		GameMode:           "endless",
		MaxPlayers:         12,
		ClusterIntention:   "social",
		ClusterToken:       "updated-token",
		ShardEnabled:       false,
		BindIP:             "192.168.1.10",
		MasterIP:           "10.0.0.5",
		ClusterKey:         "updated-secret-key",
		MasterPort:         10999,
		Master: models.ShardConfigSnapshot{
			ServerPort:         12000,
			MasterServerPort:   28018,
			AuthenticationPort: 9868,
		},
		Caves: models.ShardConfigSnapshot{
			ServerPort:         12001,
			MasterServerPort:   28019,
			AuthenticationPort: 9869,
		},
	})
	if err != nil {
		t.Fatalf("expected structured save to succeed, got error: %v", err)
	}

	writtenClusterCfg, err := files.ParseClusterINI(filepath.Join(clusterDir, "cluster.ini"))
	if err != nil {
		t.Fatalf("expected updated cluster.ini to parse, got error: %v", err)
	}

	if writtenClusterCfg.Network.ClusterName != "Cluster_A_Prime" {
		t.Fatalf("expected cluster_name to persist, got %q", writtenClusterCfg.Network.ClusterName)
	}
	if writtenClusterCfg.Gameplay.GameMode != "endless" {
		t.Fatalf("expected game_mode to persist, got %q", writtenClusterCfg.Gameplay.GameMode)
	}
	if writtenClusterCfg.Gameplay.MaxPlayers != 12 {
		t.Fatalf("expected max_players to persist, got %d", writtenClusterCfg.Gameplay.MaxPlayers)
	}
	if writtenClusterCfg.Network.ClusterIntention != "social" {
		t.Fatalf("expected cluster_intention to persist, got %q", writtenClusterCfg.Network.ClusterIntention)
	}
	if writtenClusterCfg.Shard.ShardEnabled {
		t.Fatalf("expected shard_enabled to persist as false, got %t", writtenClusterCfg.Shard.ShardEnabled)
	}
	if writtenClusterCfg.Shard.BindIP != "192.168.1.10" {
		t.Fatalf("expected bind_ip to persist, got %q", writtenClusterCfg.Shard.BindIP)
	}
	if writtenClusterCfg.Shard.MasterIP != "10.0.0.5" {
		t.Fatalf("expected master_ip to persist, got %q", writtenClusterCfg.Shard.MasterIP)
	}
	if writtenClusterCfg.Shard.ClusterKey != "updated-secret-key" {
		t.Fatalf("expected cluster_key to persist, got %q", writtenClusterCfg.Shard.ClusterKey)
	}
	if writtenClusterCfg.Shard.MasterPort != 10999 {
		t.Fatalf("expected master_port to persist, got %d", writtenClusterCfg.Shard.MasterPort)
	}

	clusterToken, err := os.ReadFile(filepath.Join(clusterDir, "cluster_token.txt"))
	if err != nil {
		t.Fatalf("expected updated cluster token to be readable, got error: %v", err)
	}
	if strings.TrimSpace(string(clusterToken)) != "updated-token" {
		t.Fatalf("expected cluster token to persist, got %q", strings.TrimSpace(string(clusterToken)))
	}
}

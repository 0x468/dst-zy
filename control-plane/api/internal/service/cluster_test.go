package service

import (
	"context"
	"os"
	"path/filepath"
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
		Slug:        "../bad",
		DisplayName: "Bad Cluster",
		ClusterName: "Bad_Cluster",
	})
	if err == nil {
		t.Fatal("expected invalid slug to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected invalid slug to return invalid api error, got %T %v", err, err)
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
		"cluster.ini":                               "[NETWORK]\ncluster_name = Legacy Cluster\n",
		"Master/server.ini":                         "[NETWORK]\nserver_port = 11000\n",
		"Caves/server.ini":                          "[NETWORK]\nserver_port = 11001\n",
		"Master/save/session/ABCDEF/snapshot.meta":  "snapshot-data",
		"Master/modoverrides.lua":                   "return {}",
		"mods/dedicated_server_mods_setup.lua":      "ServerModSetup(\"workshop-362175979\")\n",
		"mods/workshop-362175979/modinfo.lua":       "name = \"Test Mod\"\n",
		"saveindex":                                 "slotdata",
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
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     sourceDir,
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

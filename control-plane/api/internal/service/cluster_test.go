package service

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/files"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
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

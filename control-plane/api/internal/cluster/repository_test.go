package cluster

import (
	"path/filepath"
	"testing"

	appdb "github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestRepositoryCreateAssignsIDAndRejectsDuplicateSlug(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "app.db")
	database, err := appdb.Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := NewRepository(database)
	record := models.ClusterRecord{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     "/srv/dst-control-plane/clusters/cluster-a",
		Status:      "stopped",
	}

	created, err := repo.Create(record)
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	if created.ID == 0 {
		t.Fatal("expected created cluster record to have an id")
	}

	if _, err := repo.Create(record); err == nil {
		t.Fatal("expected duplicate slug creation to fail")
	}
}

package jobs

import (
	"path/filepath"
	"testing"

	appdb "github.com/gwf/dst-docker/control-plane/api/internal/db"
)

func TestServiceCreateAndFinishJob(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "app.db")
	database, err := appdb.Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	service := NewService(database)

	job, err := service.Create(42, "start", "admin")
	if err != nil {
		t.Fatalf("expected job to be created, got error: %v", err)
	}

	if job.ID == 0 {
		t.Fatal("expected created job to have an id")
	}

	if err := service.MarkFinished(job.ID, "succeeded", "started ok", ""); err != nil {
		t.Fatalf("expected job to be marked finished, got error: %v", err)
	}

	stored, err := service.Get(job.ID)
	if err != nil {
		t.Fatalf("expected stored job to be retrievable, got error: %v", err)
	}

	if stored.Status != "succeeded" {
		t.Fatalf("expected stored job status succeeded, got %q", stored.Status)
	}

	if stored.StdoutExcerpt != "started ok" {
		t.Fatalf("expected stored stdout excerpt, got %q", stored.StdoutExcerpt)
	}
}

package audit

import (
	"path/filepath"
	"testing"

	appdb "github.com/gwf/dst-docker/control-plane/api/internal/db"
)

func TestServiceRecordAndListAuditEntries(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "app.db")
	database, err := appdb.Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	service := NewService(database)

	entry, err := service.Record("admin", "save_config", "cluster", 42, "updated cluster config")
	if err != nil {
		t.Fatalf("expected audit record to be created, got error: %v", err)
	}

	if entry.ID == 0 {
		t.Fatal("expected created audit record to have an id")
	}

	entries, err := service.List(10)
	if err != nil {
		t.Fatalf("expected audit entries to list, got error: %v", err)
	}

	if len(entries) == 0 {
		t.Fatal("expected at least one audit entry")
	}

	if entries[0].Action != "save_config" {
		t.Fatalf("expected first audit action save_config, got %q", entries[0].Action)
	}
}

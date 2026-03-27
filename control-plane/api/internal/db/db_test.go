package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenCreatesSQLiteFileAndAppliesSchema(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "app.db")

	database, err := Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	if _, err := os.Stat(dbPath); err != nil {
		t.Fatalf("expected sqlite file to exist, got error: %v", err)
	}

	exists, err := HasTable(database, "users")
	if err != nil {
		t.Fatalf("expected schema lookup to succeed, got error: %v", err)
	}

	if !exists {
		t.Fatal("expected initial users table to exist after migrations")
	}
}

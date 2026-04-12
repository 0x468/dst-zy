package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/sqlite/migrations"
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

func TestOpenEnablesSQLiteForeignKeys(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "app.db")

	database, err := Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	var enabled int
	if err := database.QueryRow(`PRAGMA foreign_keys;`).Scan(&enabled); err != nil {
		t.Fatalf("expected foreign_keys pragma query to succeed, got error: %v", err)
	}

	if enabled != 1 {
		t.Fatalf("expected PRAGMA foreign_keys to be enabled, got %d", enabled)
	}
}

func TestOpenBackfillsRuntimeMetadataForLegacyClustersIdempotently(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "app.db")

	legacyDB, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("expected legacy sqlite database to open, got error: %v", err)
	}

	for _, migrationName := range []string{
		"001_initial.sql",
		"002_cluster_records.sql",
		"003_jobs_and_audit.sql",
	} {
		contents, err := migrations.Files.ReadFile(migrationName)
		if err != nil {
			t.Fatalf("expected migration file %s to be readable, got error: %v", migrationName, err)
		}
		if _, err := legacyDB.Exec(string(contents)); err != nil {
			t.Fatalf("expected migration %s to apply in legacy setup, got error: %v", migrationName, err)
		}
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	result, err := legacyDB.Exec(
		`INSERT INTO cluster_records (
			slug, display_name, note, cluster_name, base_dir, compose_file, env_file, status, created_at, updated_at
		) VALUES (?, ?, '', ?, ?, '', '', 'stopped', ?, ?)`,
		"legacy-cluster",
		"Legacy Cluster",
		"Legacy_Cluster",
		"/tmp/legacy-cluster",
		now,
		now,
	)
	if err != nil {
		t.Fatalf("expected legacy cluster record insertion to succeed, got error: %v", err)
	}
	clusterID, err := result.LastInsertId()
	if err != nil {
		t.Fatalf("expected legacy cluster id to be returned, got error: %v", err)
	}

	if err := legacyDB.Close(); err != nil {
		t.Fatalf("expected legacy sqlite database to close cleanly, got error: %v", err)
	}

	database, err := Open(dbPath)
	if err != nil {
		t.Fatalf("expected database open with full migrations to succeed, got error: %v", err)
	}

	var metadataRows int
	if err := database.QueryRow(
		`SELECT COUNT(1) FROM cluster_runtime_metadata WHERE cluster_id = ?`,
		clusterID,
	).Scan(&metadataRows); err != nil {
		t.Fatalf("expected metadata count query to succeed, got error: %v", err)
	}
	if metadataRows != 1 {
		t.Fatalf("expected one backfilled metadata row, got %d", metadataRows)
	}

	if err := database.Close(); err != nil {
		t.Fatalf("expected database to close after first open, got error: %v", err)
	}

	database, err = Open(dbPath)
	if err != nil {
		t.Fatalf("expected second database open to stay idempotent, got error: %v", err)
	}
	defer database.Close()

	if err := database.QueryRow(
		`SELECT COUNT(1) FROM cluster_runtime_metadata WHERE cluster_id = ?`,
		clusterID,
	).Scan(&metadataRows); err != nil {
		t.Fatalf("expected metadata count query after reopen to succeed, got error: %v", err)
	}
	if metadataRows != 1 {
		t.Fatalf("expected one metadata row after reopen, got %d", metadataRows)
	}
}

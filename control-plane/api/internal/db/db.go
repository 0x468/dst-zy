package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"github.com/gwf/dst-docker/control-plane/api/internal/sqlite/migrations"
	_ "github.com/mattn/go-sqlite3"
)

func Open(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	database, err := sql.Open("sqlite3", fmt.Sprintf("%s?_foreign_keys=on", path))
	if err != nil {
		return nil, err
	}

	if err := database.Ping(); err != nil {
		database.Close()
		return nil, err
	}

	if err := applyMigrations(database); err != nil {
		database.Close()
		return nil, err
	}

	return database, nil
}

func HasTable(database *sql.DB, name string) (bool, error) {
	var exists int
	err := database.QueryRow(
		`SELECT COUNT(1) FROM sqlite_master WHERE type = 'table' AND name = ?`,
		name,
	).Scan(&exists)
	if err != nil {
		return false, err
	}

	return exists > 0, nil
}

func applyMigrations(database *sql.DB) error {
	entries, err := migrations.Files.ReadDir(".")
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		contents, err := migrations.Files.ReadFile(entry.Name())
		if err != nil {
			return err
		}

		if _, err := database.Exec(string(contents)); err != nil {
			return fmt.Errorf("apply migration %s: %w", entry.Name(), err)
		}
	}

	return nil
}

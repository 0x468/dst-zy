package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestBackupServiceListReturnsArchivesNewestFirst(t *testing.T) {
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
		Status:      "running",
	})
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	backupDir := filepath.Join(record.BaseDir, "meta", "backups")
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		t.Fatalf("expected backup dir to be created, got error: %v", err)
	}

	oldArchive := filepath.Join(backupDir, "Cluster_A-20260329T120000Z.tar.gz")
	newArchive := filepath.Join(backupDir, "Cluster_A-20260329T130000Z.tar.gz")
	if err := os.WriteFile(oldArchive, []byte("old-backup"), 0o644); err != nil {
		t.Fatalf("expected old archive to be written, got error: %v", err)
	}
	if err := os.WriteFile(newArchive, []byte("new-backup"), 0o644); err != nil {
		t.Fatalf("expected new archive to be written, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(backupDir, "notes.txt"), []byte("ignore"), 0o644); err != nil {
		t.Fatalf("expected extra file to be written, got error: %v", err)
	}

	oldTime := time.Date(2026, 3, 29, 12, 0, 0, 0, time.UTC)
	newTime := time.Date(2026, 3, 29, 13, 0, 0, 0, time.UTC)
	if err := os.Chtimes(oldArchive, oldTime, oldTime); err != nil {
		t.Fatalf("expected old archive times to be updated, got error: %v", err)
	}
	if err := os.Chtimes(newArchive, newTime, newTime); err != nil {
		t.Fatalf("expected new archive times to be updated, got error: %v", err)
	}

	service := NewBackupService(repo)
	backups, err := service.List(context.Background(), record.Slug)
	if err != nil {
		t.Fatalf("expected list backups to succeed, got error: %v", err)
	}

	if len(backups) != 2 {
		t.Fatalf("expected exactly two archives, got %+v", backups)
	}
	if backups[0].Name != filepath.Base(newArchive) {
		t.Fatalf("expected newest archive first, got %+v", backups)
	}
	if backups[0].SizeBytes != int64(len("new-backup")) {
		t.Fatalf("expected backup size to be recorded, got %+v", backups[0])
	}
	if backups[1].Name != filepath.Base(oldArchive) {
		t.Fatalf("expected old archive second, got %+v", backups)
	}
}

func TestBackupServiceResolveArchiveRejectsTraversalAndMissingFiles(t *testing.T) {
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
		Status:      "running",
	})
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	backupDir := filepath.Join(record.BaseDir, "meta", "backups")
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		t.Fatalf("expected backup dir to be created, got error: %v", err)
	}

	service := NewBackupService(repo)

	_, err = service.ResolveArchivePath(context.Background(), record.Slug, "../secret.tar.gz")
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected traversal name to be rejected as invalid, got %T %v", err, err)
	}

	_, err = service.ResolveArchivePath(context.Background(), record.Slug, "missing.tar.gz")
	if !apierror.IsKind(err, apierror.KindNotFound) {
		t.Fatalf("expected missing archive to return not found, got %T %v", err, err)
	}
}

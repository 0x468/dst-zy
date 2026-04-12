package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/jobs"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestLogsServiceReadsMasterAndCavesLogs(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	jobsRepo := jobs.NewService(database)

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

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	if err := ensureDir(filepath.Join(clusterDir, "Master")); err != nil {
		t.Fatalf("expected master dir to be created, got error: %v", err)
	}
	if err := ensureDir(filepath.Join(clusterDir, "Caves")); err != nil {
		t.Fatalf("expected caves dir to be created, got error: %v", err)
	}

	if err := os.WriteFile(filepath.Join(clusterDir, "Master", "server_log.txt"), []byte("master-line-1\nmaster-line-2\n"), 0o644); err != nil {
		t.Fatalf("expected master log to be written, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(clusterDir, "Caves", "server_log.txt"), []byte("caves-line-1\ncaves-line-2\n"), 0o644); err != nil {
		t.Fatalf("expected caves log to be written, got error: %v", err)
	}

	job, err := jobsRepo.Create(record.ID, "backup", "admin")
	if err != nil {
		t.Fatalf("expected backup job to be created, got error: %v", err)
	}
	if err := jobsRepo.MarkFinished(job.ID, "succeeded", "/tmp/backup.tar.gz", ""); err != nil {
		t.Fatalf("expected backup job to finish, got error: %v", err)
	}

	service := NewLogsService(repo, jobsRepo)
	service.now = func() time.Time { return time.Date(2026, 4, 12, 9, 0, 0, 0, time.UTC) }

	masterLog, err := service.Read(context.Background(), record.Slug, "master")
	if err != nil {
		t.Fatalf("expected master logs to read, got error: %v", err)
	}
	if masterLog.Source != "master" {
		t.Fatalf("expected master source, got %q", masterLog.Source)
	}
	if !strings.Contains(masterLog.Content, "master-line-2") {
		t.Fatalf("expected master log content, got %q", masterLog.Content)
	}

	cavesLog, err := service.Read(context.Background(), record.Slug, "caves")
	if err != nil {
		t.Fatalf("expected caves logs to read, got error: %v", err)
	}
	if cavesLog.Source != "caves" {
		t.Fatalf("expected caves source, got %q", cavesLog.Source)
	}
	if !strings.Contains(cavesLog.Content, "caves-line-2") {
		t.Fatalf("expected caves log content, got %q", cavesLog.Content)
	}

	jobsLog, err := service.Read(context.Background(), record.Slug, "jobs")
	if err != nil {
		t.Fatalf("expected jobs logs to read, got error: %v", err)
	}
	if jobsLog.Source != "jobs" {
		t.Fatalf("expected jobs source, got %q", jobsLog.Source)
	}
	if !strings.Contains(jobsLog.Content, "backup") || !strings.Contains(jobsLog.Content, "/tmp/backup.tar.gz") {
		t.Fatalf("expected jobs log content to include job excerpt, got %q", jobsLog.Content)
	}
}

func TestLogsServiceJobsSourceUsesClusterScopedRecentJobs(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	jobsRepo := jobs.NewService(database)

	clusterA, err := repo.Create(models.ClusterRecord{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     filepath.Join(rootDir, "clusters", "cluster-a"),
		ComposeFile: filepath.Join(rootDir, "clusters", "cluster-a", "compose", "docker-compose.yml"),
		EnvFile:     filepath.Join(rootDir, "clusters", "cluster-a", "compose", ".env"),
		Status:      "running",
	})
	if err != nil {
		t.Fatalf("expected cluster A record to be created, got error: %v", err)
	}
	clusterB, err := repo.Create(models.ClusterRecord{
		Slug:        "cluster-b",
		DisplayName: "Cluster B",
		ClusterName: "Cluster_B",
		BaseDir:     filepath.Join(rootDir, "clusters", "cluster-b"),
		ComposeFile: filepath.Join(rootDir, "clusters", "cluster-b", "compose", "docker-compose.yml"),
		EnvFile:     filepath.Join(rootDir, "clusters", "cluster-b", "compose", ".env"),
		Status:      "running",
	})
	if err != nil {
		t.Fatalf("expected cluster B record to be created, got error: %v", err)
	}

	jobA, err := jobsRepo.Create(clusterA.ID, "restore", "admin")
	if err != nil {
		t.Fatalf("expected cluster A job to be created, got error: %v", err)
	}
	if err := jobsRepo.MarkFinished(jobA.ID, "succeeded", "cluster-a-important-job", ""); err != nil {
		t.Fatalf("expected cluster A job to finish, got error: %v", err)
	}

	for i := 0; i < 25; i++ {
		jobB, err := jobsRepo.Create(clusterB.ID, "update", "bot")
		if err != nil {
			t.Fatalf("expected cluster B job %d to be created, got error: %v", i, err)
		}
		if err := jobsRepo.MarkFinished(jobB.ID, "succeeded", "cluster-b-noise", ""); err != nil {
			t.Fatalf("expected cluster B job %d to finish, got error: %v", i, err)
		}
	}

	service := NewLogsService(repo, jobsRepo)
	service.jobsLimit = 20

	jobsLog, err := service.Read(context.Background(), clusterA.Slug, "jobs")
	if err != nil {
		t.Fatalf("expected jobs log to read, got error: %v", err)
	}
	if !strings.Contains(jobsLog.Content, "cluster-a-important-job") {
		t.Fatalf("expected cluster-scoped jobs log to include cluster A job, got %q", jobsLog.Content)
	}
}

package service

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/jobs"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestRuntimeServiceComposeModeRunsCommandAndUpdatesStatus(t *testing.T) {
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
		Status:      "stopped",
	})
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	var executedArgs []string
	service := NewRuntimeService(repo, jobsRepo, "compose")
	service.runnerFactory = func(record models.ClusterRecord) composeCommandFactory {
		return fakeComposeRunner{
			startCommand: exec.Command("docker", "compose", "up", "-d"),
		}
	}
	service.commandRunner = func(cmd *exec.Cmd) (string, string, error) {
		executedArgs = append(executedArgs, cmd.Args...)
		return "compose up ok", "", nil
	}

	job, err := service.RunAction(context.Background(), record.Slug, "start", "admin")
	if err != nil {
		t.Fatalf("expected compose action to succeed, got error: %v", err)
	}

	if len(executedArgs) == 0 {
		t.Fatal("expected compose command to execute")
	}
	if job.Status != "succeeded" {
		t.Fatalf("expected job status succeeded, got %q", job.Status)
	}
	if job.StdoutExcerpt != "compose up ok" {
		t.Fatalf("expected stdout excerpt to be recorded, got %q", job.StdoutExcerpt)
	}

	reloaded, err := repo.GetBySlug(record.Slug)
	if err != nil {
		t.Fatalf("expected cluster record to reload, got error: %v", err)
	}
	if reloaded.Status != "running" {
		t.Fatalf("expected cluster status running, got %q", reloaded.Status)
	}
}

func TestRuntimeServiceComposeModeMarksFailures(t *testing.T) {
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

	service := NewRuntimeService(repo, jobsRepo, "compose")
	service.runnerFactory = func(record models.ClusterRecord) composeCommandFactory {
		return fakeComposeRunner{
			stopCommand: exec.Command("docker", "compose", "stop"),
		}
	}
	service.commandRunner = func(cmd *exec.Cmd) (string, string, error) {
		return "", "compose stop failed", errors.New("exit status 1")
	}

	job, err := service.RunAction(context.Background(), record.Slug, "stop", "admin")
	if err == nil {
		t.Fatal("expected compose action to fail")
	}
	if job.Status != "failed" {
		t.Fatalf("expected failed job status, got %q", job.Status)
	}
	if job.StderrExcerpt != "compose stop failed" {
		t.Fatalf("expected stderr excerpt to be recorded, got %q", job.StderrExcerpt)
	}

	reloaded, err := repo.GetBySlug(record.Slug)
	if err != nil {
		t.Fatalf("expected cluster record to reload, got error: %v", err)
	}
	if reloaded.Status != "running" {
		t.Fatalf("expected cluster status to stay running after failed stop, got %q", reloaded.Status)
	}
}

func TestRuntimeServiceRejectsUnsupportedActionBeforeCreatingJob(t *testing.T) {
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

	service := NewRuntimeService(repo, jobsRepo, "compose")

	_, err = service.RunAction(context.Background(), record.Slug, "explode", "admin")
	if err == nil {
		t.Fatal("expected unsupported action to fail")
	}
	if !apierror.IsKind(err, apierror.KindInvalid) {
		t.Fatalf("expected unsupported action to return invalid api error, got %T %v", err, err)
	}

	jobRecords, err := jobsRepo.List(20)
	if err != nil {
		t.Fatalf("expected jobs to list, got error: %v", err)
	}
	if len(jobRecords) != 0 {
		t.Fatalf("expected no job to be created for unsupported action, got %d", len(jobRecords))
	}
}

func TestRuntimeServiceBackupCreatesArchiveAndPreservesStatus(t *testing.T) {
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
		Status:      "stopped",
	})
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	clusterDataDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	if err := os.MkdirAll(filepath.Join(clusterDataDir, "Master"), 0o755); err != nil {
		t.Fatalf("expected cluster data directory to be created, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(clusterDataDir, "cluster.ini"), []byte("[NETWORK]\ncluster_name = Cluster_A\n"), 0o644); err != nil {
		t.Fatalf("expected cluster.ini to be written, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(clusterDataDir, "Master", "worldgenoverride.lua"), []byte("return {}"), 0o644); err != nil {
		t.Fatalf("expected worldgenoverride.lua to be written, got error: %v", err)
	}

	service := NewRuntimeService(repo, jobsRepo, "compose")

	job, err := service.RunAction(context.Background(), record.Slug, "backup", "admin")
	if err != nil {
		t.Fatalf("expected backup action to succeed, got error: %v", err)
	}
	if job.Status != "succeeded" {
		t.Fatalf("expected backup job status succeeded, got %q", job.Status)
	}
	if !strings.Contains(job.StdoutExcerpt, filepath.Join("meta", "backups")) {
		t.Fatalf("expected backup stdout excerpt to include archive path, got %q", job.StdoutExcerpt)
	}

	archivePath := strings.TrimSpace(job.StdoutExcerpt)
	if _, err := os.Stat(archivePath); err != nil {
		t.Fatalf("expected backup archive to exist, got error: %v", err)
	}

	archiveFile, err := os.Open(archivePath)
	if err != nil {
		t.Fatalf("expected backup archive to open, got error: %v", err)
	}
	defer archiveFile.Close()

	gzipReader, err := gzip.NewReader(archiveFile)
	if err != nil {
		t.Fatalf("expected gzip reader, got error: %v", err)
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	entries := map[string]string{}
	for {
		header, err := tarReader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatalf("expected tar entry, got error: %v", err)
		}
		if !header.FileInfo().Mode().IsRegular() {
			continue
		}

		contents, err := io.ReadAll(tarReader)
		if err != nil {
			t.Fatalf("expected tar contents to read, got error: %v", err)
		}
		entries[header.Name] = string(contents)
	}

	if entries["Cluster_A/cluster.ini"] != "[NETWORK]\ncluster_name = Cluster_A\n" {
		t.Fatalf("expected cluster.ini to be archived, got %+v", entries)
	}
	if entries["Cluster_A/Master/worldgenoverride.lua"] != "return {}" {
		t.Fatalf("expected worldgenoverride.lua to be archived, got %+v", entries)
	}

	reloaded, err := repo.GetBySlug(record.Slug)
	if err != nil {
		t.Fatalf("expected cluster record to reload, got error: %v", err)
	}
	if reloaded.Status != "stopped" {
		t.Fatalf("expected backup to preserve cluster status, got %q", reloaded.Status)
	}
}

func TestRuntimeServiceRunActionSupportsRestore(t *testing.T) {
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
		Status:      "stopped",
	})
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	backupDir := filepath.Join(record.BaseDir, "meta", "backups")
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		t.Fatalf("expected backup dir to be created, got error: %v", err)
	}

	clusterDataDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	if err := os.MkdirAll(filepath.Join(clusterDataDir, "Master"), 0o755); err != nil {
		t.Fatalf("expected cluster data directory to be created, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(clusterDataDir, "Master", "state.txt"), []byte("old-state"), 0o644); err != nil {
		t.Fatalf("expected existing shard state to be written, got error: %v", err)
	}

	restoreSource := filepath.Join(rootDir, "restore-src")
	if err := os.MkdirAll(filepath.Join(restoreSource, "Master"), 0o755); err != nil {
		t.Fatalf("expected restore source to be created, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(restoreSource, "Master", "state.txt"), []byte("restored-state"), 0o644); err != nil {
		t.Fatalf("expected restore source state to be written, got error: %v", err)
	}

	archiveName := "Cluster_A-20260412T090000Z.tar.gz"
	archivePath := filepath.Join(backupDir, archiveName)
	if err := writeTarGzArchive(restoreSource, record.ClusterName, archivePath); err != nil {
		t.Fatalf("expected restore archive to be created, got error: %v", err)
	}

	service := NewRuntimeService(repo, jobsRepo, "compose")

	job, err := service.RunAction(context.Background(), record.Slug, "restore:"+archiveName, "admin")
	if err != nil {
		t.Fatalf("expected restore action to succeed, got error: %v", err)
	}
	if job.Status != "succeeded" {
		t.Fatalf("expected restore job status succeeded, got %q", job.Status)
	}
	if job.JobType != "restore" {
		t.Fatalf("expected restore job type, got %q", job.JobType)
	}
	if !strings.Contains(job.StdoutExcerpt, archiveName) {
		t.Fatalf("expected restore stdout excerpt to include archive name, got %q", job.StdoutExcerpt)
	}

	restoredStatePath := filepath.Join(clusterDataDir, "Master", "state.txt")
	restoredState, err := os.ReadFile(restoredStatePath)
	if err != nil {
		t.Fatalf("expected restored state to be readable, got error: %v", err)
	}
	if string(restoredState) != "restored-state" {
		t.Fatalf("expected restored state contents, got %q", string(restoredState))
	}
}

func TestRuntimeServiceRestoreWithoutArchiveNameUsesLatestBackup(t *testing.T) {
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
		Status:      "stopped",
	})
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	clusterDataDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	if err := os.MkdirAll(filepath.Join(clusterDataDir, "Master"), 0o755); err != nil {
		t.Fatalf("expected cluster data directory to be created, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(clusterDataDir, "Master", "state.txt"), []byte("old-state"), 0o644); err != nil {
		t.Fatalf("expected existing shard state to be written, got error: %v", err)
	}

	backupDir := filepath.Join(record.BaseDir, "meta", "backups")
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		t.Fatalf("expected backup dir to be created, got error: %v", err)
	}

	oldSource := filepath.Join(rootDir, "restore-old")
	if err := os.MkdirAll(filepath.Join(oldSource, "Master"), 0o755); err != nil {
		t.Fatalf("expected old restore source to be created, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(oldSource, "Master", "state.txt"), []byte("old-backup-state"), 0o644); err != nil {
		t.Fatalf("expected old restore source state to be written, got error: %v", err)
	}

	newSource := filepath.Join(rootDir, "restore-new")
	if err := os.MkdirAll(filepath.Join(newSource, "Master"), 0o755); err != nil {
		t.Fatalf("expected new restore source to be created, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(newSource, "Master", "state.txt"), []byte("latest-backup-state"), 0o644); err != nil {
		t.Fatalf("expected new restore source state to be written, got error: %v", err)
	}

	oldArchiveName := "Cluster_A-20260412T080000Z.tar.gz"
	newArchiveName := "Cluster_A-20260412T090000Z.tar.gz"
	oldArchivePath := filepath.Join(backupDir, oldArchiveName)
	newArchivePath := filepath.Join(backupDir, newArchiveName)
	if err := writeTarGzArchive(oldSource, record.ClusterName, oldArchivePath); err != nil {
		t.Fatalf("expected old archive to be created, got error: %v", err)
	}
	if err := writeTarGzArchive(newSource, record.ClusterName, newArchivePath); err != nil {
		t.Fatalf("expected new archive to be created, got error: %v", err)
	}

	oldTime := time.Date(2026, 4, 12, 8, 0, 0, 0, time.UTC)
	newTime := time.Date(2026, 4, 12, 9, 0, 0, 0, time.UTC)
	if err := os.Chtimes(oldArchivePath, oldTime, oldTime); err != nil {
		t.Fatalf("expected old archive timestamps to update, got error: %v", err)
	}
	if err := os.Chtimes(newArchivePath, newTime, newTime); err != nil {
		t.Fatalf("expected new archive timestamps to update, got error: %v", err)
	}

	service := NewRuntimeService(repo, jobsRepo, "compose")

	job, err := service.RunAction(context.Background(), record.Slug, "restore", "admin")
	if err != nil {
		t.Fatalf("expected restore action without name to succeed, got error: %v", err)
	}
	if job.Status != "succeeded" {
		t.Fatalf("expected restore job status succeeded, got %q", job.Status)
	}
	if !strings.Contains(job.StdoutExcerpt, "restored latest backup") {
		t.Fatalf("expected restore stdout excerpt to indicate latest backup, got %q", job.StdoutExcerpt)
	}

	restoredState, err := os.ReadFile(filepath.Join(clusterDataDir, "Master", "state.txt"))
	if err != nil {
		t.Fatalf("expected restored state to be readable, got error: %v", err)
	}
	if string(restoredState) != "latest-backup-state" {
		t.Fatalf("expected latest backup contents, got %q", string(restoredState))
	}
}

type fakeComposeRunner struct {
	startCommand    *exec.Cmd
	stopCommand     *exec.Cmd
	restartCommand  *exec.Cmd
	updateCommand   *exec.Cmd
	validateCommand *exec.Cmd
}

func (f fakeComposeRunner) StartCommand() *exec.Cmd {
	return f.startCommand
}

func (f fakeComposeRunner) StopCommand() *exec.Cmd {
	return f.stopCommand
}

func (f fakeComposeRunner) RestartCommand() *exec.Cmd {
	return f.restartCommand
}

func (f fakeComposeRunner) UpdateCommand() *exec.Cmd {
	return f.updateCommand
}

func (f fakeComposeRunner) ValidateCommand() *exec.Cmd {
	return f.validateCommand
}

package service

import (
	"archive/tar"
	"context"
	"compress/gzip"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

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

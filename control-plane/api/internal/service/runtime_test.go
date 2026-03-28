package service

import (
	"context"
	"errors"
	"os/exec"
	"path/filepath"
	"testing"

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

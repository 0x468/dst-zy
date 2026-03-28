package service

import (
	"bytes"
	"context"
	"errors"
	"os/exec"
	"path/filepath"

	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/jobs"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
	"github.com/gwf/dst-docker/control-plane/api/internal/runtime"
)

type RuntimeService struct {
	repo          *cluster.Repository
	jobs          *jobs.Service
	executionMode string
	runnerFactory func(record models.ClusterRecord) composeCommandFactory
	commandRunner func(cmd *exec.Cmd) (string, string, error)
}

func NewRuntimeService(repo *cluster.Repository, jobs *jobs.Service, executionMode string) RuntimeService {
	return RuntimeService{
		repo:          repo,
		jobs:          jobs,
		executionMode: executionMode,
		runnerFactory: func(record models.ClusterRecord) composeCommandFactory {
			return runtime.NewComposeRunner(filepath.Dir(record.ComposeFile), record.ComposeFile, record.EnvFile)
		},
		commandRunner: runCommand,
	}
}

func (s RuntimeService) RunAction(_ context.Context, slug string, action string, actor string) (models.JobRecord, error) {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return models.JobRecord{}, err
	}

	job, err := s.jobs.Create(record.ID, action, actor)
	if err != nil {
		return models.JobRecord{}, err
	}

	switch s.executionMode {
	case "dry-run":
		if err := s.jobs.MarkFinished(job.ID, "succeeded", "dry run "+action, ""); err != nil {
			return models.JobRecord{}, err
		}
		if err := s.repo.UpdateStatus(record.ID, nextStatusForAction(action)); err != nil {
			return models.JobRecord{}, err
		}
	case "compose":
		runner := s.runnerFactory(record)
		cmd, err := commandForAction(runner, action)
		if err != nil {
			return models.JobRecord{}, err
		}

		stdout, stderr, runErr := s.commandRunner(cmd)
		if runErr != nil {
			if markErr := s.jobs.MarkFinished(job.ID, "failed", truncateExcerpt(stdout), truncateExcerpt(stderr)); markErr != nil {
				return models.JobRecord{}, markErr
			}
			failedJob, getErr := s.jobs.Get(job.ID)
			if getErr != nil {
				return models.JobRecord{}, getErr
			}
			return failedJob, runErr
		}

		if err := s.jobs.MarkFinished(job.ID, "succeeded", truncateExcerpt(stdout), truncateExcerpt(stderr)); err != nil {
			return models.JobRecord{}, err
		}
		if err := s.repo.UpdateStatus(record.ID, nextStatusForAction(action)); err != nil {
			return models.JobRecord{}, err
		}
	default:
		return models.JobRecord{}, errors.New("compose execution mode not wired yet")
	}

	return s.jobs.Get(job.ID)
}

type composeCommandFactory interface {
	StartCommand() *exec.Cmd
	StopCommand() *exec.Cmd
	RestartCommand() *exec.Cmd
	UpdateCommand() *exec.Cmd
	ValidateCommand() *exec.Cmd
}

func commandForAction(runner composeCommandFactory, action string) (*exec.Cmd, error) {
	switch action {
	case "start":
		return runner.StartCommand(), nil
	case "stop":
		return runner.StopCommand(), nil
	case "restart":
		return runner.RestartCommand(), nil
	case "update":
		return runner.UpdateCommand(), nil
	case "validate":
		return runner.ValidateCommand(), nil
	default:
		return nil, errors.New("unsupported action")
	}
}

func nextStatusForAction(action string) string {
	switch action {
	case "stop":
		return "stopped"
	default:
		return "running"
	}
}

func runCommand(cmd *exec.Cmd) (string, string, error) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	return stdout.String(), stderr.String(), err
}

func truncateExcerpt(value string) string {
	const maxExcerptLength = 4096
	if len(value) <= maxExcerptLength {
		return value
	}
	return value[:maxExcerptLength]
}

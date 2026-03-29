package service

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
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
	if !isSupportedAction(action) {
		return models.JobRecord{}, apierror.Invalid("unsupported action", nil)
	}

	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return models.JobRecord{}, err
	}

	job, err := s.jobs.Create(record.ID, action, actor)
	if err != nil {
		return models.JobRecord{}, err
	}

	if action == "backup" {
		archivePath, err := createBackupArchive(record)
		if err != nil {
			if markErr := s.jobs.MarkFinished(job.ID, "failed", "", truncateExcerpt(err.Error())); markErr != nil {
				return models.JobRecord{}, markErr
			}
			failedJob, getErr := s.jobs.Get(job.ID)
			if getErr != nil {
				return models.JobRecord{}, getErr
			}
			return failedJob, err
		}
		if err := s.jobs.MarkFinished(job.ID, "succeeded", truncateExcerpt(archivePath), ""); err != nil {
			return models.JobRecord{}, err
		}
		return s.jobs.Get(job.ID)
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

func isSupportedAction(action string) bool {
	switch action {
	case "start", "stop", "restart", "update", "validate", "backup":
		return true
	default:
		return false
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

func createBackupArchive(record models.ClusterRecord) (archivePath string, err error) {
	sourceDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	backupDir := filepath.Join(record.BaseDir, "meta", "backups")
	if err := ensureDir(backupDir); err != nil {
		return "", err
	}

	archivePath = filepath.Join(
		backupDir,
		fmt.Sprintf("%s-%s.tar.gz", record.ClusterName, time.Now().UTC().Format("20060102T150405Z")),
	)
	if err := writeTarGzArchive(sourceDir, record.ClusterName, archivePath); err != nil {
		return "", err
	}

	return archivePath, nil
}

func writeTarGzArchive(sourceDir string, rootName string, archivePath string) (err error) {
	archiveFile, err := os.Create(archivePath)
	if err != nil {
		return err
	}
	defer func() {
		closeErr := archiveFile.Close()
		if err == nil {
			err = closeErr
		}
		if err != nil {
			_ = os.Remove(archivePath)
		}
	}()

	gzipWriter := gzip.NewWriter(archiveFile)
	defer func() {
		closeErr := gzipWriter.Close()
		if err == nil {
			err = closeErr
		}
	}()

	tarWriter := tar.NewWriter(gzipWriter)
	defer func() {
		closeErr := tarWriter.Close()
		if err == nil {
			err = closeErr
		}
	}()

	return filepath.Walk(sourceDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relativePath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}

		archiveName := rootName
		if relativePath != "." {
			archiveName = rootName + "/" + filepath.ToSlash(relativePath)
		}

		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = archiveName

		switch {
		case info.IsDir():
			if !strings.HasSuffix(header.Name, "/") {
				header.Name += "/"
			}
			return tarWriter.WriteHeader(header)
		case info.Mode().IsRegular():
			if err := tarWriter.WriteHeader(header); err != nil {
				return err
			}

			sourceFile, err := os.Open(path)
			if err != nil {
				return err
			}
			defer sourceFile.Close()

			_, err = io.Copy(tarWriter, sourceFile)
			return err
		default:
			return apierror.Invalid("backup contains unsupported file type", nil)
		}
	})
}

func ensureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}

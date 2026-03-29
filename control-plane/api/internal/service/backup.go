package service

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

type BackupService struct {
	repo *cluster.Repository
}

func NewBackupService(repo *cluster.Repository) BackupService {
	return BackupService{repo: repo}
}

func (s BackupService) List(_ context.Context, slug string) ([]models.BackupRecord, error) {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return nil, err
	}

	backupDir := filepath.Join(record.BaseDir, "meta", "backups")
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []models.BackupRecord{}, nil
		}
		return nil, err
	}

	backups := make([]models.BackupRecord, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".tar.gz") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			return nil, err
		}

		backups = append(backups, models.BackupRecord{
			Name:        entry.Name(),
			SizeBytes:   info.Size(),
			CreatedAt:   info.ModTime().UTC(),
			ClusterSlug: slug,
		})
	}

	slices.SortFunc(backups, func(a models.BackupRecord, b models.BackupRecord) int {
		return b.CreatedAt.Compare(a.CreatedAt)
	})

	return backups, nil
}

func (s BackupService) ResolveArchivePath(_ context.Context, slug string, name string) (string, error) {
	if err := validateArchiveName(name); err != nil {
		return "", err
	}

	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return "", err
	}

	archivePath := filepath.Join(record.BaseDir, "meta", "backups", name)
	info, err := os.Stat(archivePath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", apierror.NotFound("backup not found", err)
		}
		return "", err
	}
	if info.IsDir() {
		return "", apierror.NotFound("backup not found", nil)
	}

	return archivePath, nil
}

func validateArchiveName(name string) error {
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, `\`) {
		return apierror.Invalid("invalid backup name", nil)
	}
	if filepath.Base(name) != name || !strings.HasSuffix(name, ".tar.gz") {
		return apierror.Invalid("invalid backup name", nil)
	}

	return nil
}

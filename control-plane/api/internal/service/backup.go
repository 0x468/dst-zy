package service

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"io"
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

func (s BackupService) Restore(ctx context.Context, slug string, name string) error {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return err
	}

	archiveName := strings.TrimSpace(name)
	if archiveName == "" {
		backups, err := s.List(ctx, slug)
		if err != nil {
			return err
		}
		if len(backups) == 0 {
			return apierror.NotFound("backup not found", nil)
		}
		archiveName = backups[0].Name
	}

	archivePath, err := s.ResolveArchivePath(ctx, slug, archiveName)
	if err != nil {
		return err
	}

	runtimeDataDir := filepath.Join(record.BaseDir, "runtime", "data")
	if err := os.MkdirAll(runtimeDataDir, 0o755); err != nil {
		return err
	}

	restoreRoot, err := os.MkdirTemp(runtimeDataDir, ".restore-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(restoreRoot)

	if err := extractTarGzArchive(archivePath, restoreRoot); err != nil {
		return err
	}

	restoredClusterDir := filepath.Join(restoreRoot, record.ClusterName)
	info, err := os.Stat(restoredClusterDir)
	if err != nil {
		if os.IsNotExist(err) {
			return apierror.Invalid("backup archive missing cluster root", nil)
		}
		return err
	}
	if !info.IsDir() {
		return apierror.Invalid("backup archive missing cluster root", nil)
	}

	targetClusterDir := filepath.Join(runtimeDataDir, record.ClusterName)
	if err := os.RemoveAll(targetClusterDir); err != nil {
		return err
	}
	if err := os.Rename(restoredClusterDir, targetClusterDir); err != nil {
		return err
	}

	return nil
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

func extractTarGzArchive(archivePath string, destinationRoot string) (err error) {
	archiveFile, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer archiveFile.Close()

	gzipReader, err := gzip.NewReader(archiveFile)
	if err != nil {
		return err
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	for {
		header, err := tarReader.Next()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		name := filepath.Clean(filepath.FromSlash(header.Name))
		if name == "." || strings.HasPrefix(name, "..") || filepath.IsAbs(name) {
			return apierror.Invalid("backup archive contains invalid path", nil)
		}

		targetPath := filepath.Join(destinationRoot, name)
		relPath, err := filepath.Rel(destinationRoot, targetPath)
		if err != nil {
			return err
		}
		if relPath == ".." || strings.HasPrefix(relPath, ".."+string(filepath.Separator)) {
			return apierror.Invalid("backup archive contains invalid path", nil)
		}

		mode := header.FileInfo().Mode()
		switch {
		case mode.IsDir():
			if err := os.MkdirAll(targetPath, 0o755); err != nil {
				return err
			}
		case mode.IsRegular():
			if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
				return err
			}
			targetFile, err := os.OpenFile(targetPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode.Perm())
			if err != nil {
				return err
			}
			if _, err := io.Copy(targetFile, tarReader); err != nil {
				targetFile.Close()
				return err
			}
			if err := targetFile.Close(); err != nil {
				return err
			}
		default:
			return apierror.Invalid("backup archive contains unsupported file type", nil)
		}
	}
}

package service

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/jobs"
)

type LogEntry struct {
	Source    string    `json:"source"`
	Content   string    `json:"content"`
	UpdatedAt time.Time `json:"updated_at"`
}

type LogsService struct {
	repo         *cluster.Repository
	jobs         *jobs.Service
	now          func() time.Time
	maxTailBytes int64
	jobsLimit    int
}

func NewLogsService(repo *cluster.Repository, jobs *jobs.Service) LogsService {
	return LogsService{
		repo:         repo,
		jobs:         jobs,
		now:          func() time.Time { return time.Now().UTC() },
		maxTailBytes: 64 * 1024,
		jobsLimit:    20,
	}
}

func (s LogsService) Read(_ context.Context, slug string, source string) (LogEntry, error) {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return LogEntry{}, err
	}

	normalizedSource := strings.ToLower(strings.TrimSpace(source))
	if normalizedSource == "" {
		normalizedSource = "jobs"
	}

	var content string
	switch normalizedSource {
	case "jobs":
		content, err = s.readJobsLog(record.ID)
	case "master":
		content, err = s.readShardLog(record.BaseDir, record.ClusterName, "Master")
	case "caves":
		content, err = s.readShardLog(record.BaseDir, record.ClusterName, "Caves")
	default:
		return LogEntry{}, apierror.Invalid("unsupported log source", nil)
	}
	if err != nil {
		return LogEntry{}, err
	}

	return LogEntry{
		Source:    normalizedSource,
		Content:   content,
		UpdatedAt: s.now(),
	}, nil
}

func (s LogsService) readJobsLog(clusterID int64) (string, error) {
	records, err := s.jobs.List(s.jobsLimit)
	if err != nil {
		return "", err
	}

	lines := make([]string, 0, len(records)*3)
	for _, record := range records {
		if record.ClusterID != clusterID {
			continue
		}

		lines = append(lines, fmt.Sprintf(
			"%s #%d %s %s by %s",
			record.StartedAt.UTC().Format(time.RFC3339),
			record.ID,
			record.JobType,
			record.Status,
			record.RequestedBy,
		))
		if record.StdoutExcerpt != "" {
			lines = append(lines, "stdout: "+record.StdoutExcerpt)
		}
		if record.StderrExcerpt != "" {
			lines = append(lines, "stderr: "+record.StderrExcerpt)
		}
	}

	return strings.Join(lines, "\n"), nil
}

func (s LogsService) readShardLog(baseDir string, clusterName string, shard string) (string, error) {
	logPath := filepath.Join(baseDir, "runtime", "data", clusterName, shard, "server_log.txt")

	file, err := os.Open(logPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return "", err
	}

	start := int64(0)
	if info.Size() > s.maxTailBytes {
		start = info.Size() - s.maxTailBytes
	}
	if _, err := file.Seek(start, io.SeekStart); err != nil {
		return "", err
	}

	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

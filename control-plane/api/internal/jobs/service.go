package jobs

import (
	"database/sql"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) Create(clusterID int64, jobType string, requestedBy string) (models.JobRecord, error) {
	now := time.Now().UTC()
	result, err := s.db.Exec(
		`INSERT INTO jobs (
			cluster_id,
			job_type,
			status,
			requested_by,
			stdout_excerpt,
			stderr_excerpt,
			started_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		clusterID,
		jobType,
		"running",
		requestedBy,
		"",
		"",
		now.Format(time.RFC3339Nano),
	)
	if err != nil {
		return models.JobRecord{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return models.JobRecord{}, err
	}

	return models.JobRecord{
		ID:          id,
		ClusterID:   clusterID,
		JobType:     jobType,
		Status:      "running",
		RequestedBy: requestedBy,
		StartedAt:   now,
	}, nil
}

func (s *Service) MarkFinished(id int64, status string, stdoutExcerpt string, stderrExcerpt string) error {
	now := time.Now().UTC()
	_, err := s.db.Exec(
		`UPDATE jobs
		 SET status = ?, stdout_excerpt = ?, stderr_excerpt = ?, finished_at = ?
		 WHERE id = ?`,
		status,
		stdoutExcerpt,
		stderrExcerpt,
		now.Format(time.RFC3339Nano),
		id,
	)
	return err
}

func (s *Service) Get(id int64) (models.JobRecord, error) {
	row := s.db.QueryRow(
		`SELECT id, cluster_id, job_type, status, requested_by, stdout_excerpt, stderr_excerpt, started_at, finished_at
		 FROM jobs WHERE id = ?`,
		id,
	)

	var record models.JobRecord
	var startedAt string
	var finishedAt sql.NullString
	if err := row.Scan(
		&record.ID,
		&record.ClusterID,
		&record.JobType,
		&record.Status,
		&record.RequestedBy,
		&record.StdoutExcerpt,
		&record.StderrExcerpt,
		&startedAt,
		&finishedAt,
	); err != nil {
		return models.JobRecord{}, err
	}

	parsedStartedAt, err := time.Parse(time.RFC3339Nano, startedAt)
	if err != nil {
		return models.JobRecord{}, err
	}
	record.StartedAt = parsedStartedAt

	if finishedAt.Valid {
		parsedFinishedAt, err := time.Parse(time.RFC3339Nano, finishedAt.String)
		if err != nil {
			return models.JobRecord{}, err
		}
		record.FinishedAt = &parsedFinishedAt
	}

	return record, nil
}

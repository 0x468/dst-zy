package cluster

import (
	"database/sql"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(record models.ClusterRecord) (models.ClusterRecord, error) {
	now := time.Now().UTC()

	result, err := r.db.Exec(
		`INSERT INTO cluster_records (
			slug,
			display_name,
			note,
			cluster_name,
			base_dir,
			compose_file,
			env_file,
			status,
			created_at,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		record.Slug,
		record.DisplayName,
		record.Note,
		record.ClusterName,
		record.BaseDir,
		record.ComposeFile,
		record.EnvFile,
		record.Status,
		now,
		now,
	)
	if err != nil {
		return models.ClusterRecord{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return models.ClusterRecord{}, err
	}

	record.ID = id
	record.CreatedAt = now
	record.UpdatedAt = now
	return record, nil
}

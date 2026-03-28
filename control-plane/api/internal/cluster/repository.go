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
		now.Format(time.RFC3339Nano),
		now.Format(time.RFC3339Nano),
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

func (r *Repository) List() ([]models.ClusterRecord, error) {
	rows, err := r.db.Query(
		`SELECT id, slug, display_name, note, cluster_name, base_dir, compose_file, env_file, status, created_at, updated_at
		 FROM cluster_records
		 ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []models.ClusterRecord{}
	for rows.Next() {
		record, err := scanClusterRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	return records, rows.Err()
}

func (r *Repository) GetBySlug(slug string) (models.ClusterRecord, error) {
	row := r.db.QueryRow(
		`SELECT id, slug, display_name, note, cluster_name, base_dir, compose_file, env_file, status, created_at, updated_at
		 FROM cluster_records
		 WHERE slug = ?`,
		slug,
	)

	return scanClusterRecord(row)
}

type clusterScanner interface {
	Scan(dest ...any) error
}

func scanClusterRecord(scanner clusterScanner) (models.ClusterRecord, error) {
	var record models.ClusterRecord
	var createdAt string
	var updatedAt string

	if err := scanner.Scan(
		&record.ID,
		&record.Slug,
		&record.DisplayName,
		&record.Note,
		&record.ClusterName,
		&record.BaseDir,
		&record.ComposeFile,
		&record.EnvFile,
		&record.Status,
		&createdAt,
		&updatedAt,
	); err != nil {
		return models.ClusterRecord{}, err
	}

	parsedCreatedAt, err := time.Parse(time.RFC3339Nano, createdAt)
	if err != nil {
		return models.ClusterRecord{}, err
	}
	parsedUpdatedAt, err := time.Parse(time.RFC3339Nano, updatedAt)
	if err != nil {
		return models.ClusterRecord{}, err
	}

	record.CreatedAt = parsedCreatedAt
	record.UpdatedAt = parsedUpdatedAt
	return record, nil
}

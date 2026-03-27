package audit

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

func (s *Service) Record(actor string, action string, targetType string, targetID int64, summary string) (models.AuditRecord, error) {
	now := time.Now().UTC()
	result, err := s.db.Exec(
		`INSERT INTO audit_records (
			actor,
			action,
			target_type,
			target_id,
			summary,
			created_at
		) VALUES (?, ?, ?, ?, ?, ?)`,
		actor,
		action,
		targetType,
		targetID,
		summary,
		now.Format(time.RFC3339Nano),
	)
	if err != nil {
		return models.AuditRecord{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return models.AuditRecord{}, err
	}

	return models.AuditRecord{
		ID:         id,
		Actor:      actor,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Summary:    summary,
		CreatedAt:  now,
	}, nil
}

func (s *Service) List(limit int) ([]models.AuditRecord, error) {
	rows, err := s.db.Query(
		`SELECT id, actor, action, target_type, target_id, summary, created_at
		 FROM audit_records
		 ORDER BY id DESC
		 LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []models.AuditRecord{}
	for rows.Next() {
		var record models.AuditRecord
		var createdAt string
		if err := rows.Scan(
			&record.ID,
			&record.Actor,
			&record.Action,
			&record.TargetType,
			&record.TargetID,
			&record.Summary,
			&createdAt,
		); err != nil {
			return nil, err
		}

		parsedCreatedAt, err := time.Parse(time.RFC3339Nano, createdAt)
		if err != nil {
			return nil, err
		}
		record.CreatedAt = parsedCreatedAt

		records = append(records, record)
	}

	return records, rows.Err()
}

package models

import "time"

type AuditRecord struct {
	ID         int64     `json:"id"`
	Actor      string    `json:"actor"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type"`
	TargetID   int64     `json:"target_id"`
	Summary    string    `json:"summary"`
	CreatedAt  time.Time `json:"created_at"`
}

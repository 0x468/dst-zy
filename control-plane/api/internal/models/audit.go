package models

import "time"

type AuditRecord struct {
	ID         int64
	Actor      string
	Action     string
	TargetType string
	TargetID   int64
	Summary    string
	CreatedAt  time.Time
}

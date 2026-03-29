package models

import "time"

type BackupRecord struct {
	Name        string    `json:"name"`
	SizeBytes   int64     `json:"size_bytes"`
	CreatedAt   time.Time `json:"created_at"`
	ClusterSlug string    `json:"cluster_slug"`
}

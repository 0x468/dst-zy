package models

import "time"

type ClusterRecord struct {
	ID          int64
	Slug        string
	DisplayName string
	Note        string
	ClusterName string
	BaseDir     string
	ComposeFile string
	EnvFile     string
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

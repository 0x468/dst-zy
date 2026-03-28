package models

import "time"

type ClusterRecord struct {
	ID          int64     `json:"id"`
	Slug        string    `json:"slug"`
	DisplayName string    `json:"display_name"`
	Note        string    `json:"note"`
	ClusterName string    `json:"cluster_name"`
	BaseDir     string    `json:"base_dir"`
	ComposeFile string    `json:"compose_file"`
	EnvFile     string    `json:"env_file"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

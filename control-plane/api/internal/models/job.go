package models

import "time"

type JobRecord struct {
	ID            int64      `json:"id"`
	ClusterID     int64      `json:"cluster_id"`
	JobType       string     `json:"job_type"`
	Status        string     `json:"status"`
	RequestedBy   string     `json:"requested_by"`
	StdoutExcerpt string     `json:"stdout_excerpt"`
	StderrExcerpt string     `json:"stderr_excerpt"`
	StartedAt     time.Time  `json:"started_at"`
	FinishedAt    *time.Time `json:"finished_at"`
}

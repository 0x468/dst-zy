package models

import "time"

type JobRecord struct {
	ID            int64
	ClusterID     int64
	JobType       string
	Status        string
	RequestedBy   string
	StdoutExcerpt string
	StderrExcerpt string
	StartedAt     time.Time
	FinishedAt    *time.Time
}

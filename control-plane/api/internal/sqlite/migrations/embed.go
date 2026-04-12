package migrations

import "embed"

//go:embed 001_initial.sql 002_cluster_records.sql 003_jobs_and_audit.sql 004_standard_closure.sql
var Files embed.FS

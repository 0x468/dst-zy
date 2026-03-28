package service

import (
	"context"

	"github.com/gwf/dst-docker/control-plane/api/internal/jobs"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

type JobsService struct {
	jobs *jobs.Service
}

func NewJobsService(jobs *jobs.Service) JobsService {
	return JobsService{jobs: jobs}
}

func (s JobsService) List(_ context.Context, limit int) ([]models.JobRecord, error) {
	return s.jobs.List(limit)
}

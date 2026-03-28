package service

import (
	"context"
	"errors"

	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/jobs"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

type RuntimeService struct {
	repo          *cluster.Repository
	jobs          *jobs.Service
	executionMode string
}

func NewRuntimeService(repo *cluster.Repository, jobs *jobs.Service, executionMode string) RuntimeService {
	return RuntimeService{repo: repo, jobs: jobs, executionMode: executionMode}
}

func (s RuntimeService) RunAction(_ context.Context, slug string, action string, actor string) (models.JobRecord, error) {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return models.JobRecord{}, err
	}

	job, err := s.jobs.Create(record.ID, action, actor)
	if err != nil {
		return models.JobRecord{}, err
	}

	switch s.executionMode {
	case "dry-run":
		if err := s.jobs.MarkFinished(job.ID, "succeeded", "dry run "+action, ""); err != nil {
			return models.JobRecord{}, err
		}
	default:
		return models.JobRecord{}, errors.New("compose execution mode not wired yet")
	}

	return s.jobs.Get(job.ID)
}

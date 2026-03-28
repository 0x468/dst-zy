package service

import (
	"context"
	"path/filepath"

	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/files"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

type ConfigService struct {
	repo *cluster.Repository
}

func NewConfigService(repo *cluster.Repository) ConfigService {
	return ConfigService{repo: repo}
}

func (s ConfigService) GetSnapshot(_ context.Context, slug string) (models.ClusterConfigSnapshot, error) {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}

	clusterPath := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName, "cluster.ini")
	masterPath := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName, "Master", "server.ini")
	cavesPath := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName, "Caves", "server.ini")

	clusterCfg, err := files.ParseClusterINI(clusterPath)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}
	masterCfg, err := files.ParseServerINI(masterPath)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}
	cavesCfg, err := files.ParseServerINI(cavesPath)
	if err != nil {
		return models.ClusterConfigSnapshot{}, err
	}

	return files.BuildSnapshot(clusterCfg, masterCfg, cavesCfg), nil
}

func (s ConfigService) SaveSnapshot(_ context.Context, slug string, snapshot models.ClusterConfigSnapshot) error {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		return err
	}

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	clusterCfg, err := files.ParseClusterINI(filepath.Join(clusterDir, "cluster.ini"))
	if err != nil {
		return err
	}
	masterCfg, err := files.ParseServerINI(filepath.Join(clusterDir, "Master", "server.ini"))
	if err != nil {
		return err
	}
	cavesCfg, err := files.ParseServerINI(filepath.Join(clusterDir, "Caves", "server.ini"))
	if err != nil {
		return err
	}

	clusterCfg.Network.ClusterName = snapshot.ClusterName
	clusterCfg.Network.ClusterDescription = snapshot.ClusterDescription
	clusterCfg.Gameplay.GameMode = snapshot.GameMode
	clusterCfg.Shard.ClusterKey = snapshot.ClusterKey
	clusterCfg.Shard.MasterPort = snapshot.MasterPort
	masterCfg.Network.ServerPort = snapshot.Master.ServerPort
	masterCfg.Steam.MasterServerPort = snapshot.Master.MasterServerPort
	masterCfg.Steam.AuthenticationPort = snapshot.Master.AuthenticationPort
	cavesCfg.Network.ServerPort = snapshot.Caves.ServerPort
	cavesCfg.Steam.MasterServerPort = snapshot.Caves.MasterServerPort
	cavesCfg.Steam.AuthenticationPort = snapshot.Caves.AuthenticationPort

	if err := files.WriteClusterINI(filepath.Join(clusterDir, "cluster.ini"), clusterCfg); err != nil {
		return err
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Master", "server.ini"), masterCfg); err != nil {
		return err
	}
	if err := files.WriteServerINI(filepath.Join(clusterDir, "Caves", "server.ini"), cavesCfg); err != nil {
		return err
	}

	return nil
}

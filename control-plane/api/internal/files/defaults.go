package files

import "github.com/gwf/dst-docker/control-plane/api/internal/models"

func DefaultManagedSnapshot(clusterName string) models.ClusterConfigSnapshot {
	return models.ClusterConfigSnapshot{
		ClusterName:        clusterName,
		ClusterDescription: "Managed by DST Control Plane",
		GameMode:           "survival",
		MaxPlayers:         6,
		PVP:                false,
		PauseWhenEmpty:     true,
		ClusterIntention:   "cooperative",
		ClusterKey:         "replace-me-cluster-key",
		ShardEnabled:       true,
		BindIP:             "0.0.0.0",
		MasterIP:           "127.0.0.1",
		MasterPort:         10889,
		Master: models.ShardConfigSnapshot{
			ServerPort:         models.StandardClosureDefaultMasterHostPort,
			MasterServerPort:   models.StandardClosureDefaultMasterSteamHostPort,
			AuthenticationPort: 8768,
			IsMaster:           true,
			Name:               "Master",
			ID:                 models.StandardClosureDefaultMasterShardID,
			EncodeUserPath:     true,
		},
		Caves: models.ShardConfigSnapshot{
			ServerPort:         models.StandardClosureDefaultCavesHostPort,
			MasterServerPort:   models.StandardClosureDefaultCavesSteamHostPort,
			AuthenticationPort: 8769,
			IsMaster:           false,
			Name:               "Caves",
			ID:                 models.StandardClosureDefaultCavesShardID,
			EncodeUserPath:     true,
		},
	}
}

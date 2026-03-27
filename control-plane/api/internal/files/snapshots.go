package files

import "github.com/gwf/dst-docker/control-plane/api/internal/models"

func BuildSnapshot(cluster ClusterINIConfig, master ServerINIConfig, caves ServerINIConfig) models.ClusterConfigSnapshot {
	return models.ClusterConfigSnapshot{
		ClusterName:        cluster.Network.ClusterName,
		ClusterDescription: cluster.Network.ClusterDescription,
		GameMode:           cluster.Gameplay.GameMode,
		ClusterKey:         cluster.Shard.ClusterKey,
		MasterPort:         cluster.Shard.MasterPort,
		Master: models.ShardConfigSnapshot{
			ServerPort:         master.Network.ServerPort,
			MasterServerPort:   master.Steam.MasterServerPort,
			AuthenticationPort: master.Steam.AuthenticationPort,
		},
		Caves: models.ShardConfigSnapshot{
			ServerPort:         caves.Network.ServerPort,
			MasterServerPort:   caves.Steam.MasterServerPort,
			AuthenticationPort: caves.Steam.AuthenticationPort,
		},
	}
}

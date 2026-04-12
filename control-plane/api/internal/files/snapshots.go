package files

import "github.com/gwf/dst-docker/control-plane/api/internal/models"

func BuildSnapshot(cluster ClusterINIConfig, master ServerINIConfig, caves ServerINIConfig, rawClusterINI string) models.ClusterConfigSnapshot {
	return models.ClusterConfigSnapshot{
		ClusterName:        cluster.Network.ClusterName,
		ClusterDescription: cluster.Network.ClusterDescription,
		GameMode:           cluster.Gameplay.GameMode,
		MaxPlayers:         cluster.Gameplay.MaxPlayers,
		PVP:                cluster.Gameplay.PVP,
		PauseWhenEmpty:     cluster.Gameplay.PauseWhenEmpty,
		ClusterIntention:   cluster.Network.ClusterIntention,
		ClusterKey:         cluster.Shard.ClusterKey,
		ShardEnabled:       cluster.Shard.ShardEnabled,
		BindIP:             cluster.Shard.BindIP,
		MasterIP:           cluster.Shard.MasterIP,
		MasterPort:         cluster.Shard.MasterPort,
		Master: models.ShardConfigSnapshot{
			ServerPort:         master.Network.ServerPort,
			MasterServerPort:   master.Steam.MasterServerPort,
			AuthenticationPort: master.Steam.AuthenticationPort,
			IsMaster:           master.Shard.IsMaster,
			Name:               master.Shard.Name,
			ID:                 master.Shard.ID,
			EncodeUserPath:     master.Account.EncodeUserPath,
		},
		Caves: models.ShardConfigSnapshot{
			ServerPort:         caves.Network.ServerPort,
			MasterServerPort:   caves.Steam.MasterServerPort,
			AuthenticationPort: caves.Steam.AuthenticationPort,
			IsMaster:           caves.Shard.IsMaster,
			Name:               caves.Shard.Name,
			ID:                 caves.Shard.ID,
			EncodeUserPath:     caves.Account.EncodeUserPath,
		},
		RawFiles: &models.RawConfigFiles{
			ClusterINI: rawClusterINI,
		},
	}
}

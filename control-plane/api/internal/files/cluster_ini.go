package files

import (
	"fmt"
	"os"
	"strings"
)

type ClusterINIConfig struct {
	Gameplay struct {
		GameMode       string
		MaxPlayers     int
		PVP            bool
		PauseWhenEmpty bool
	}
	Network struct {
		ClusterName        string
		ClusterDescription string
		ClusterPassword    string
		ClusterIntention   string
	}
	Misc struct {
		ConsoleEnabled bool
	}
	Shard struct {
		ShardEnabled bool
		BindIP       string
		MasterIP     string
		MasterPort   int
		ClusterKey   string
	}
}

func ParseClusterINI(path string) (ClusterINIConfig, error) {
	sections, err := parseINI(path)
	if err != nil {
		return ClusterINIConfig{}, err
	}

	cfg := ClusterINIConfig{}
	cfg.Gameplay.GameMode = iniValue(sections, "GAMEPLAY", "game_mode")
	cfg.Gameplay.MaxPlayers = parseInt(iniValue(sections, "GAMEPLAY", "max_players"))
	cfg.Gameplay.PVP = parseBool(iniValue(sections, "GAMEPLAY", "pvp"))
	cfg.Gameplay.PauseWhenEmpty = parseBool(iniValue(sections, "GAMEPLAY", "pause_when_empty"))

	cfg.Network.ClusterName = iniValue(sections, "NETWORK", "cluster_name")
	cfg.Network.ClusterDescription = iniValue(sections, "NETWORK", "cluster_description")
	cfg.Network.ClusterPassword = iniValue(sections, "NETWORK", "cluster_password")
	cfg.Network.ClusterIntention = iniValue(sections, "NETWORK", "cluster_intention")

	cfg.Misc.ConsoleEnabled = parseBool(iniValue(sections, "MISC", "console_enabled"))

	cfg.Shard.ShardEnabled = parseBool(iniValue(sections, "SHARD", "shard_enabled"))
	cfg.Shard.BindIP = iniValue(sections, "SHARD", "bind_ip")
	cfg.Shard.MasterIP = iniValue(sections, "SHARD", "master_ip")
	cfg.Shard.MasterPort = parseInt(iniValue(sections, "SHARD", "master_port"))
	cfg.Shard.ClusterKey = iniValue(sections, "SHARD", "cluster_key")

	return cfg, nil
}

func WriteClusterINI(path string, cfg ClusterINIConfig) error {
	contents := fmt.Sprintf(`[GAMEPLAY]
game_mode = %s
max_players = %d
pvp = %t
pause_when_empty = %t

[NETWORK]
cluster_name = %s
cluster_description = %s
cluster_password = %s
cluster_intention = %s

[MISC]
console_enabled = %t

[SHARD]
shard_enabled = %t
bind_ip = %s
master_ip = %s
master_port = %d
cluster_key = %s
`,
		cfg.Gameplay.GameMode,
		cfg.Gameplay.MaxPlayers,
		cfg.Gameplay.PVP,
		cfg.Gameplay.PauseWhenEmpty,
		cfg.Network.ClusterName,
		cfg.Network.ClusterDescription,
		cfg.Network.ClusterPassword,
		cfg.Network.ClusterIntention,
		cfg.Misc.ConsoleEnabled,
		cfg.Shard.ShardEnabled,
		cfg.Shard.BindIP,
		cfg.Shard.MasterIP,
		cfg.Shard.MasterPort,
		cfg.Shard.ClusterKey,
	)

	return os.WriteFile(path, []byte(strings.TrimSpace(contents)+"\n"), 0o644)
}

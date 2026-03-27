package files

import (
	"fmt"
	"os"
	"strings"
)

type ServerINIConfig struct {
	Network struct {
		ServerPort int
	}
	Shard struct {
		IsMaster bool
		Name     string
		ID       string
	}
	Account struct {
		EncodeUserPath bool
	}
	Steam struct {
		MasterServerPort   int
		AuthenticationPort int
	}
}

func ParseServerINI(path string) (ServerINIConfig, error) {
	sections, err := parseINI(path)
	if err != nil {
		return ServerINIConfig{}, err
	}

	cfg := ServerINIConfig{}
	cfg.Network.ServerPort = parseInt(iniValue(sections, "NETWORK", "server_port"))
	cfg.Shard.IsMaster = parseBool(iniValue(sections, "SHARD", "is_master"))
	cfg.Shard.Name = iniValue(sections, "SHARD", "name")
	cfg.Shard.ID = iniValue(sections, "SHARD", "id")
	cfg.Account.EncodeUserPath = parseBool(iniValue(sections, "ACCOUNT", "encode_user_path"))
	cfg.Steam.MasterServerPort = parseInt(iniValue(sections, "STEAM", "master_server_port"))
	cfg.Steam.AuthenticationPort = parseInt(iniValue(sections, "STEAM", "authentication_port"))

	return cfg, nil
}

func WriteServerINI(path string, cfg ServerINIConfig) error {
	contents := fmt.Sprintf(`[NETWORK]
server_port = %d

[SHARD]
is_master = %t
name = %s
id = %s

[ACCOUNT]
encode_user_path = %t

[STEAM]
master_server_port = %d
authentication_port = %d
`,
		cfg.Network.ServerPort,
		cfg.Shard.IsMaster,
		cfg.Shard.Name,
		cfg.Shard.ID,
		cfg.Account.EncodeUserPath,
		cfg.Steam.MasterServerPort,
		cfg.Steam.AuthenticationPort,
	)

	return os.WriteFile(path, []byte(strings.TrimSpace(contents)+"\n"), 0o644)
}

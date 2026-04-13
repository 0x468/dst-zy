package models

const (
	StandardClosureDefaultMasterShardID = "1"
	StandardClosureDefaultCavesShardID  = "95247852"
)

type ShardConfigSnapshot struct {
	ServerPort         int    `json:"server_port"`
	MasterServerPort   int    `json:"master_server_port"`
	AuthenticationPort int    `json:"authentication_port"`
	IsMaster           bool   `json:"is_master"`
	Name               string `json:"name"`
	ID                 string `json:"id"`
	EncodeUserPath     bool   `json:"encode_user_path"`
}

type RawConfigFiles struct {
	ClusterINI string `json:"cluster_ini"`
}

type ClusterConfigSnapshot struct {
	DisplayName          string              `json:"display_name"`
	Note                 string              `json:"note"`
	ClusterName          string              `json:"cluster_name"`
	ClusterDescription   string              `json:"cluster_description"`
	ClusterPassword      string              `json:"cluster_password"`
	ClusterToken         string              `json:"cluster_token"`
	GameMode             string              `json:"game_mode"`
	MaxPlayers           int                 `json:"max_players"`
	PVP                  bool                `json:"pvp"`
	PauseWhenEmpty       bool                `json:"pause_when_empty"`
	ClusterIntention     string              `json:"cluster_intention"`
	ClusterKey           string              `json:"cluster_key"`
	ShardEnabled         bool                `json:"shard_enabled"`
	BindIP               string              `json:"bind_ip"`
	MasterIP             string              `json:"master_ip"`
	TimeZone             string              `json:"time_zone"`
	UpdateMode           string              `json:"update_mode"`
	ServerModsUpdateMode string              `json:"server_mods_update_mode"`
	MasterHostPort       int                 `json:"master_host_port"`
	CavesHostPort        int                 `json:"caves_host_port"`
	MasterSteamHostPort  int                 `json:"master_steam_host_port"`
	CavesSteamHostPort   int                 `json:"caves_steam_host_port"`
	MasterPort           int                 `json:"master_port"`
	Master               ShardConfigSnapshot `json:"master"`
	Caves                ShardConfigSnapshot `json:"caves"`
	RawFiles             *RawConfigFiles     `json:"raw_files,omitempty"`
}

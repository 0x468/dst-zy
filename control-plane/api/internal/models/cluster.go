package models

import "time"

const (
	StandardClosureDefaultUpdateMode           = "install-only"
	StandardClosureDefaultServerModsUpdateMode = "runtime"
	StandardClosureDefaultTimeZone             = "Asia/Shanghai"
	StandardClosureDefaultMasterHostPort       = 11000
	StandardClosureDefaultCavesHostPort        = 11001
	StandardClosureDefaultMasterSteamHostPort  = 27018
	StandardClosureDefaultCavesSteamHostPort   = 27019
)

type ClusterRecord struct {
	ID                   int64     `json:"id"`
	Slug                 string    `json:"slug"`
	DisplayName          string    `json:"display_name"`
	Note                 string    `json:"note"`
	ClusterName          string    `json:"cluster_name"`
	BaseDir              string    `json:"base_dir"`
	ComposeFile          string    `json:"compose_file"`
	EnvFile              string    `json:"env_file"`
	Status               string    `json:"status"`
	UpdateMode           string    `json:"update_mode"`
	ServerModsUpdateMode string    `json:"server_mods_update_mode"`
	TimeZone             string    `json:"time_zone"`
	MasterHostPort       int       `json:"master_host_port"`
	CavesHostPort        int       `json:"caves_host_port"`
	MasterSteamHostPort  int       `json:"master_steam_host_port"`
	CavesSteamHostPort   int       `json:"caves_steam_host_port"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

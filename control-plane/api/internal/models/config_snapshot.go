package models

type ShardConfigSnapshot struct {
	ServerPort         int `json:"server_port"`
	MasterServerPort   int `json:"master_server_port"`
	AuthenticationPort int `json:"authentication_port"`
}

type RawConfigFiles struct {
	ClusterINI string `json:"cluster_ini"`
}

type ClusterConfigSnapshot struct {
	ClusterName        string          `json:"cluster_name"`
	ClusterDescription string          `json:"cluster_description"`
	GameMode           string          `json:"game_mode"`
	ClusterKey         string          `json:"cluster_key"`
	MasterPort         int             `json:"master_port"`
	Master             ShardConfigSnapshot `json:"master"`
	Caves              ShardConfigSnapshot `json:"caves"`
	RawFiles           *RawConfigFiles `json:"raw_files,omitempty"`
}

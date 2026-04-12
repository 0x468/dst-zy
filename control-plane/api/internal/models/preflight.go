package models

const (
	PreflightStatusReady   = "ready"
	PreflightStatusBlocked = "blocked"
)

const (
	PreflightSeverityFatal   = "fatal"
	PreflightSeverityWarning = "warning"
)

const (
	PreflightCodeTokenMissing          = "token_missing"
	PreflightCodeClusterKeyMissing     = "cluster_key_missing"
	PreflightCodeClusterINIMissing     = "cluster_ini_missing"
	PreflightCodeClusterINIInvalid     = "cluster_ini_invalid"
	PreflightCodeMasterServerINIMissing = "master_server_ini_missing"
	PreflightCodeMasterServerINIInvalid = "master_server_ini_invalid"
	PreflightCodeCavesServerINIMissing  = "caves_server_ini_missing"
	PreflightCodeCavesServerINIInvalid  = "caves_server_ini_invalid"
	PreflightCodeMasterShardInvalid    = "master_shard_invalid"
	PreflightCodeCavesShardInvalid     = "caves_shard_invalid"
	PreflightCodeHostPortConflict      = "host_port_conflict"
)

type PreflightCheck struct {
	Code     string `json:"code"`
	Severity string `json:"severity"`
	Summary  string `json:"summary"`
	Detail   string `json:"detail"`
	Hint     string `json:"hint"`
}

type PreflightReport struct {
	Status       string           `json:"status"`
	FatalCount   int              `json:"fatal_count"`
	WarningCount int              `json:"warning_count"`
	Checks       []PreflightCheck `json:"checks"`
}

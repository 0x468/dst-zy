package runtime

import "fmt"

type ComposeTemplateInput struct {
	Image                string
	ClusterName          string
	UpdateMode           string
	ServerModsUpdateMode string
	TimeZone             string
	MasterHostPort       int
	CavesHostPort        int
	SteamHostPort        int
	CavesSteamHostPort   int
}

func GenerateComposeYAML(input ComposeTemplateInput) string {
	return fmt.Sprintf(`services:
  dst:
    image: %s
    env_file:
      - .env
    volumes:
      - ./steam-state:/steam-state
      - ./dst:/opt/dst
      - ./ugc:/ugc
      - ./data:/data
    ports:
      - ${DST_MASTER_HOST_PORT:-%d}:11000/udp
      - ${DST_CAVES_HOST_PORT:-%d}:11001/udp
      - ${DST_STEAM_HOST_PORT:-%d}:27018/udp
      - ${DST_CAVES_STEAM_HOST_PORT:-%d}:27019/udp
    restart: unless-stopped
`,
		input.Image,
		input.MasterHostPort,
		input.CavesHostPort,
		input.SteamHostPort,
		input.CavesSteamHostPort,
	)
}

func GenerateEnvFile(input ComposeTemplateInput) string {
	return fmt.Sprintf(`DST_CLUSTER_NAME=%s
DST_UPDATE_MODE=%s
DST_SERVER_MODS_UPDATE_MODE=%s
DST_MASTER_HOST_PORT=%d
DST_CAVES_HOST_PORT=%d
DST_STEAM_HOST_PORT=%d
DST_CAVES_STEAM_HOST_PORT=%d
TZ=%s
`,
		input.ClusterName,
		input.UpdateMode,
		input.ServerModsUpdateMode,
		input.MasterHostPort,
		input.CavesHostPort,
		input.SteamHostPort,
		input.CavesSteamHostPort,
		input.TimeZone,
	)
}

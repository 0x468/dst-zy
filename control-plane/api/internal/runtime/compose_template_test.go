package runtime

import (
	"strings"
	"testing"
)

func TestGenerateComposeYAMLAndEnv(t *testing.T) {
	input := ComposeTemplateInput{
		Image:                "dst-docker:v1",
		ClusterName:          "Cluster_A",
		UpdateMode:           "install-only",
		ServerModsUpdateMode: "runtime",
		TimeZone:             "Asia/Shanghai",
		MasterHostPort:       11000,
		CavesHostPort:        11001,
		SteamHostPort:        27018,
		CavesSteamHostPort:   27019,
	}

	composeYAML := GenerateComposeYAML(input)
	if !strings.Contains(composeYAML, "image: dst-docker:v1") {
		t.Fatalf("expected compose yaml to include image, got %q", composeYAML)
	}

	if !strings.Contains(composeYAML, "${DST_MASTER_HOST_PORT:-11000}:11000/udp") {
		t.Fatalf("expected compose yaml to include master host port mapping, got %q", composeYAML)
	}

	envFile := GenerateEnvFile(input)
	if !strings.Contains(envFile, "DST_CLUSTER_NAME=Cluster_A") {
		t.Fatalf("expected env file to include cluster name, got %q", envFile)
	}

	if !strings.Contains(envFile, "DST_UPDATE_MODE=install-only") {
		t.Fatalf("expected env file to include update mode, got %q", envFile)
	}
	if !strings.Contains(envFile, "DST_SERVER_MODS_UPDATE_MODE=runtime") {
		t.Fatalf("expected env file to include server mods update mode, got %q", envFile)
	}
	if !strings.Contains(envFile, "DST_MASTER_HOST_PORT=11000") {
		t.Fatalf("expected env file to include master host port, got %q", envFile)
	}
	if !strings.Contains(envFile, "DST_CAVES_HOST_PORT=11001") {
		t.Fatalf("expected env file to include caves host port, got %q", envFile)
	}
	if !strings.Contains(envFile, "DST_STEAM_HOST_PORT=27018") {
		t.Fatalf("expected env file to include steam host port, got %q", envFile)
	}
	if !strings.Contains(envFile, "DST_CAVES_STEAM_HOST_PORT=27019") {
		t.Fatalf("expected env file to include caves steam host port, got %q", envFile)
	}
	if !strings.Contains(envFile, "TZ=Asia/Shanghai") {
		t.Fatalf("expected env file to include timezone, got %q", envFile)
	}
}

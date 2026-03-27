package files

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseAndWriteClusterINI(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cluster.ini")
	contents := `[GAMEPLAY]
game_mode = survival
max_players = 6
pvp = false
pause_when_empty = true

[NETWORK]
cluster_name = Example Cluster
cluster_description = Example Description
cluster_password =
cluster_intention = cooperative

[MISC]
console_enabled = true

[SHARD]
shard_enabled = true
bind_ip = 0.0.0.0
master_ip = 127.0.0.1
master_port = 10889
cluster_key = secret-cluster-key
`

	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("expected cluster.ini to be written, got error: %v", err)
	}

	cfg, err := ParseClusterINI(path)
	if err != nil {
		t.Fatalf("expected cluster.ini to parse, got error: %v", err)
	}

	if cfg.Network.ClusterName != "Example Cluster" {
		t.Fatalf("expected cluster name to parse, got %q", cfg.Network.ClusterName)
	}

	if cfg.Shard.ClusterKey != "secret-cluster-key" {
		t.Fatalf("expected cluster key to parse, got %q", cfg.Shard.ClusterKey)
	}

	cfg.Network.ClusterName = "Updated Cluster"
	if err := WriteClusterINI(path, cfg); err != nil {
		t.Fatalf("expected cluster.ini to be written back, got error: %v", err)
	}

	updated, err := ParseClusterINI(path)
	if err != nil {
		t.Fatalf("expected updated cluster.ini to parse, got error: %v", err)
	}

	if updated.Network.ClusterName != "Updated Cluster" {
		t.Fatalf("expected updated cluster name, got %q", updated.Network.ClusterName)
	}
}

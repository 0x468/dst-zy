package files

import "testing"

func TestBuildSnapshot(t *testing.T) {
	cluster := ClusterINIConfig{}
	cluster.Network.ClusterName = "Snapshot Cluster"
	cluster.Network.ClusterDescription = "Snapshot Description"
	cluster.Gameplay.GameMode = "survival"
	cluster.Shard.ClusterKey = "snapshot-key"
	cluster.Shard.MasterPort = 10889

	master := ServerINIConfig{}
	master.Network.ServerPort = 11000
	master.Steam.MasterServerPort = 27018
	master.Steam.AuthenticationPort = 8768

	caves := ServerINIConfig{}
	caves.Network.ServerPort = 11001
	caves.Steam.MasterServerPort = 27019
	caves.Steam.AuthenticationPort = 8769

	snapshot := BuildSnapshot(cluster, master, caves)

	if snapshot.ClusterName != "Snapshot Cluster" {
		t.Fatalf("expected cluster name in snapshot, got %q", snapshot.ClusterName)
	}

	if snapshot.Master.ServerPort != 11000 {
		t.Fatalf("expected master server port in snapshot, got %d", snapshot.Master.ServerPort)
	}

	if snapshot.Caves.MasterServerPort != 27019 {
		t.Fatalf("expected caves master_server_port in snapshot, got %d", snapshot.Caves.MasterServerPort)
	}
}

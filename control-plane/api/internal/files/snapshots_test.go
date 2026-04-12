package files

import "testing"

func TestBuildSnapshot(t *testing.T) {
	cluster := ClusterINIConfig{}
	cluster.Network.ClusterName = "Snapshot Cluster"
	cluster.Network.ClusterDescription = "Snapshot Description"
	cluster.Network.ClusterIntention = "cooperative"
	cluster.Gameplay.GameMode = "survival"
	cluster.Gameplay.MaxPlayers = 6
	cluster.Gameplay.PVP = true
	cluster.Gameplay.PauseWhenEmpty = false
	cluster.Shard.ClusterKey = "snapshot-key"
	cluster.Shard.ShardEnabled = true
	cluster.Shard.BindIP = "0.0.0.0"
	cluster.Shard.MasterIP = "127.0.0.1"
	cluster.Shard.MasterPort = 10889

	master := ServerINIConfig{}
	master.Network.ServerPort = 11000
	master.Shard.IsMaster = true
	master.Shard.Name = "Master"
	master.Shard.ID = "1"
	master.Account.EncodeUserPath = true
	master.Steam.MasterServerPort = 27018
	master.Steam.AuthenticationPort = 8768

	caves := ServerINIConfig{}
	caves.Network.ServerPort = 11001
	caves.Shard.IsMaster = false
	caves.Shard.Name = "Caves"
	caves.Shard.ID = "95247852"
	caves.Account.EncodeUserPath = true
	caves.Steam.MasterServerPort = 27019
	caves.Steam.AuthenticationPort = 8769

	snapshot := BuildSnapshot(cluster, master, caves, "[NETWORK]\ncluster_name = Snapshot Cluster\n")

	if snapshot.ClusterName != "Snapshot Cluster" {
		t.Fatalf("expected cluster name in snapshot, got %q", snapshot.ClusterName)
	}

	if snapshot.Master.ServerPort != 11000 {
		t.Fatalf("expected master server port in snapshot, got %d", snapshot.Master.ServerPort)
	}

	if snapshot.Caves.MasterServerPort != 27019 {
		t.Fatalf("expected caves master_server_port in snapshot, got %d", snapshot.Caves.MasterServerPort)
	}
	if snapshot.MaxPlayers != 6 || !snapshot.PVP || snapshot.PauseWhenEmpty {
		t.Fatalf("expected gameplay fields to persist, got max_players=%d pvp=%t pause_when_empty=%t", snapshot.MaxPlayers, snapshot.PVP, snapshot.PauseWhenEmpty)
	}
	if snapshot.ClusterIntention != "cooperative" {
		t.Fatalf("expected cluster intention in snapshot, got %q", snapshot.ClusterIntention)
	}
	if !snapshot.ShardEnabled || snapshot.BindIP != "0.0.0.0" || snapshot.MasterIP != "127.0.0.1" {
		t.Fatalf("expected shard network fields to persist, got shard_enabled=%t bind_ip=%q master_ip=%q", snapshot.ShardEnabled, snapshot.BindIP, snapshot.MasterIP)
	}
	if !snapshot.Master.IsMaster || snapshot.Master.Name != "Master" || snapshot.Master.ID != "1" || !snapshot.Master.EncodeUserPath {
		t.Fatalf("expected master shard metadata to persist, got is_master=%t name=%q id=%q encode_user_path=%t", snapshot.Master.IsMaster, snapshot.Master.Name, snapshot.Master.ID, snapshot.Master.EncodeUserPath)
	}
	if snapshot.Caves.IsMaster || snapshot.Caves.Name != "Caves" || snapshot.Caves.ID != "95247852" || !snapshot.Caves.EncodeUserPath {
		t.Fatalf("expected caves shard metadata to persist, got is_master=%t name=%q id=%q encode_user_path=%t", snapshot.Caves.IsMaster, snapshot.Caves.Name, snapshot.Caves.ID, snapshot.Caves.EncodeUserPath)
	}

	if snapshot.RawFiles == nil || snapshot.RawFiles.ClusterINI == "" {
		t.Fatal("expected raw cluster.ini content in snapshot")
	}
}

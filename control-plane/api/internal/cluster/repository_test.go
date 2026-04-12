package cluster

import (
	"path/filepath"
	"testing"

	appdb "github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/files"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestRepositoryCreateAssignsIDAndRejectsDuplicateSlug(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "app.db")
	database, err := appdb.Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := NewRepository(database)
	record := models.ClusterRecord{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     "/srv/dst-control-plane/clusters/cluster-a",
		Status:      "stopped",
	}

	created, err := repo.Create(record)
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	if created.ID == 0 {
		t.Fatal("expected created cluster record to have an id")
	}

	if _, err := repo.Create(record); err == nil {
		t.Fatal("expected duplicate slug creation to fail")
	}
}

func TestRepositoryUpdateStatusPersistsState(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "app.db")
	database, err := appdb.Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := NewRepository(database)
	record := models.ClusterRecord{
		Slug:        "cluster-a",
		DisplayName: "Cluster A",
		ClusterName: "Cluster_A",
		BaseDir:     "/srv/dst-control-plane/clusters/cluster-a",
		Status:      "stopped",
	}

	created, err := repo.Create(record)
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	if err := repo.UpdateStatus(created.ID, "running"); err != nil {
		t.Fatalf("expected status update to succeed, got error: %v", err)
	}

	reloaded, err := repo.GetBySlug(created.Slug)
	if err != nil {
		t.Fatalf("expected cluster record to reload, got error: %v", err)
	}

	if reloaded.Status != "running" {
		t.Fatalf("expected status to be running, got %q", reloaded.Status)
	}
}

func TestRepositoryCreatePersistsStandardClosureMetadata(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "app.db")
	database, err := appdb.Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := NewRepository(database)
	record := models.ClusterRecord{
		Slug:                 "cluster-standard",
		DisplayName:          "Cluster Standard",
		ClusterName:          "Cluster_Standard",
		BaseDir:              "/srv/dst-control-plane/clusters/cluster-standard",
		Status:               "stopped",
		UpdateMode:           "install-only",
		ServerModsUpdateMode: "runtime",
		TimeZone:             "Asia/Shanghai",
		MasterHostPort:       11000,
		CavesHostPort:        11001,
		MasterSteamHostPort:  27018,
		CavesSteamHostPort:   27019,
	}

	created, err := repo.Create(record)
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	reloaded, err := repo.GetBySlug(created.Slug)
	if err != nil {
		t.Fatalf("expected cluster record to reload, got error: %v", err)
	}

	if reloaded.UpdateMode != "install-only" {
		t.Fatalf("expected update_mode to persist, got %q", reloaded.UpdateMode)
	}
	if reloaded.ServerModsUpdateMode != "runtime" {
		t.Fatalf("expected server_mods_update_mode to persist, got %q", reloaded.ServerModsUpdateMode)
	}
	if reloaded.TimeZone != "Asia/Shanghai" {
		t.Fatalf("expected time_zone to persist, got %q", reloaded.TimeZone)
	}
	if reloaded.MasterHostPort != 11000 {
		t.Fatalf("expected master_host_port to persist, got %d", reloaded.MasterHostPort)
	}
	if reloaded.CavesHostPort != 11001 {
		t.Fatalf("expected caves_host_port to persist, got %d", reloaded.CavesHostPort)
	}
	if reloaded.MasterSteamHostPort != 27018 {
		t.Fatalf("expected master_steam_host_port to persist, got %d", reloaded.MasterSteamHostPort)
	}
	if reloaded.CavesSteamHostPort != 27019 {
		t.Fatalf("expected caves_steam_host_port to persist, got %d", reloaded.CavesSteamHostPort)
	}
}

func TestRepositoryCreateAppliesStandardClosureDefaultsWhenMetadataOmitted(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "app.db")
	database, err := appdb.Open(dbPath)
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := NewRepository(database)
	record := models.ClusterRecord{
		Slug:        "cluster-defaults",
		DisplayName: "Cluster Defaults",
		ClusterName: "Cluster_Defaults",
		BaseDir:     "/srv/dst-control-plane/clusters/cluster-defaults",
		Status:      "stopped",
	}

	created, err := repo.Create(record)
	if err != nil {
		t.Fatalf("expected cluster record to be created, got error: %v", err)
	}

	if created.UpdateMode != "install-only" {
		t.Fatalf("expected update_mode default in created record, got %q", created.UpdateMode)
	}
	if created.ServerModsUpdateMode != "runtime" {
		t.Fatalf("expected server_mods_update_mode default in created record, got %q", created.ServerModsUpdateMode)
	}
	if created.TimeZone != "Asia/Shanghai" {
		t.Fatalf("expected time_zone default in created record, got %q", created.TimeZone)
	}
	if created.MasterHostPort != 11000 || created.CavesHostPort != 11001 {
		t.Fatalf("expected default host ports 11000/11001, got %d/%d", created.MasterHostPort, created.CavesHostPort)
	}
	if created.MasterSteamHostPort != 27018 || created.CavesSteamHostPort != 27019 {
		t.Fatalf("expected default steam ports 27018/27019, got %d/%d", created.MasterSteamHostPort, created.CavesSteamHostPort)
	}

	reloaded, err := repo.GetBySlug(created.Slug)
	if err != nil {
		t.Fatalf("expected cluster record to reload, got error: %v", err)
	}
	if reloaded.UpdateMode != "install-only" || reloaded.ServerModsUpdateMode != "runtime" || reloaded.TimeZone != "Asia/Shanghai" {
		t.Fatalf(
			"expected persisted defaults to be install-only/runtime/Asia/Shanghai, got %q/%q/%q",
			reloaded.UpdateMode,
			reloaded.ServerModsUpdateMode,
			reloaded.TimeZone,
		)
	}
	if reloaded.MasterHostPort != 11000 || reloaded.CavesHostPort != 11001 {
		t.Fatalf("expected persisted default host ports 11000/11001, got %d/%d", reloaded.MasterHostPort, reloaded.CavesHostPort)
	}
	if reloaded.MasterSteamHostPort != 27018 || reloaded.CavesSteamHostPort != 27019 {
		t.Fatalf("expected persisted default steam ports 27018/27019, got %d/%d", reloaded.MasterSteamHostPort, reloaded.CavesSteamHostPort)
	}
}

func TestDefaultManagedSnapshotProvidesPlayableMasterAndCavesDefaults(t *testing.T) {
	snapshot := files.DefaultManagedSnapshot("Cluster_Playable")

	if snapshot.ClusterName != "Cluster_Playable" {
		t.Fatalf("expected cluster_name to be propagated, got %q", snapshot.ClusterName)
	}
	if snapshot.GameMode != "survival" || snapshot.MaxPlayers <= 0 {
		t.Fatalf("expected playable gameplay defaults, got mode=%q max_players=%d", snapshot.GameMode, snapshot.MaxPlayers)
	}
	if snapshot.Master.ServerPort <= 0 || snapshot.Caves.ServerPort <= 0 {
		t.Fatalf("expected positive shard server ports, got master=%d caves=%d", snapshot.Master.ServerPort, snapshot.Caves.ServerPort)
	}
	if !snapshot.Master.IsMaster || snapshot.Caves.IsMaster {
		t.Fatalf("expected master/caves is_master flags, got master=%t caves=%t", snapshot.Master.IsMaster, snapshot.Caves.IsMaster)
	}
	if snapshot.Master.Name != "Master" || snapshot.Caves.Name != "Caves" {
		t.Fatalf("expected shard names Master/Caves, got %q/%q", snapshot.Master.Name, snapshot.Caves.Name)
	}
	if snapshot.Master.ID == "" || snapshot.Caves.ID == "" {
		t.Fatalf("expected shard IDs to be non-empty, got master=%q caves=%q", snapshot.Master.ID, snapshot.Caves.ID)
	}
	if snapshot.Master.ID != "1" || snapshot.Caves.ID != "2" {
		t.Fatalf("expected canonical shard IDs 1/2, got %q/%q", snapshot.Master.ID, snapshot.Caves.ID)
	}
	if snapshot.Master.MasterServerPort == snapshot.Caves.MasterServerPort {
		t.Fatalf("expected distinct steam ports for master/caves, got both=%d", snapshot.Master.MasterServerPort)
	}
}

package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/files"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestPreflightServicePreviewBlocksMissingCredentialsAndManagedPortConflicts(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	if _, err := repo.Create(models.ClusterRecord{
		Slug:                "cluster-a",
		DisplayName:         "Cluster A",
		ClusterName:         "Cluster_A",
		BaseDir:             filepath.Join(rootDir, "clusters", "cluster-a"),
		ComposeFile:         filepath.Join(rootDir, "clusters", "cluster-a", "compose", "docker-compose.yml"),
		EnvFile:             filepath.Join(rootDir, "clusters", "cluster-a", "compose", ".env"),
		Status:              "stopped",
		MasterHostPort:      12000,
		CavesHostPort:       12001,
		MasterSteamHostPort: 28018,
		CavesSteamHostPort:  28019,
	}); err != nil {
		t.Fatalf("expected seed cluster to be created, got error: %v", err)
	}

	service := NewPreflightService(repo)
	report, err := service.Preview(context.Background(), handlers.ClusterMutationRequest{
		Mode:               "create",
		Slug:               "cluster-b",
		DisplayName:        "Cluster B",
		ClusterName:        "Cluster_B",
		ClusterDescription: "Cluster B Desc",
		GameMode:           "survival",
		MaxPlayers:         6,
		ClusterToken:       "",
		ClusterKey:         "",
		Intent:             "cooperative",
		TimeZone:           "Asia/Shanghai",
		MasterHostPort:     12000,
		CavesHostPort:      12002,
		SteamHostPort:      28020,
		CavesSteamHostPort: 28021,
	})
	if err != nil {
		t.Fatalf("expected preview to return structured report, got error: %v", err)
	}

	if report.Status != models.PreflightStatusBlocked {
		t.Fatalf("expected blocked preview status, got %q", report.Status)
	}
	if report.FatalCount != 3 {
		t.Fatalf("expected exactly three fatal checks, got %d (%+v)", report.FatalCount, report.Checks)
	}
	assertPreflightCheck(t, report, models.PreflightCodeTokenMissing, models.PreflightSeverityFatal)
	assertPreflightCheck(t, report, models.PreflightCodeClusterKeyMissing, models.PreflightSeverityFatal)
	assertPreflightCheck(t, report, models.PreflightCodeHostPortConflict, models.PreflightSeverityFatal)
}

func TestPreflightServiceGetBySlugReadsPersistedClusterLayout(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	guard, err := files.NewGuard(rootDir)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	clusterService := NewClusterService(repo, guard, "dst-control-plane:test")
	record, err := clusterService.Create(context.Background(), handlers.ClusterMutationRequest{
		Mode:               "create",
		Slug:               "cluster-a",
		DisplayName:        "Cluster A",
		ClusterName:        "Cluster_A",
		ClusterDescription: "Cluster A Desc",
		GameMode:           "survival",
		MaxPlayers:         6,
		ClusterToken:       "token-a",
		ClusterKey:         "key-a",
		Intent:             "cooperative",
		TimeZone:           "Asia/Shanghai",
		MasterHostPort:     11000,
		CavesHostPort:      11001,
		SteamHostPort:      27018,
		CavesSteamHostPort: 27019,
	})
	if err != nil {
		t.Fatalf("expected create to succeed, got error: %v", err)
	}

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	if err := os.Remove(filepath.Join(clusterDir, "cluster_token.txt")); err != nil {
		t.Fatalf("expected token file to be removable for failure setup, got error: %v", err)
	}
	if err := os.Remove(filepath.Join(clusterDir, "Caves", "server.ini")); err != nil {
		t.Fatalf("expected caves server.ini to be removable for failure setup, got error: %v", err)
	}

	service := NewPreflightService(repo)
	report, err := service.GetBySlug(context.Background(), record.Slug)
	if err != nil {
		t.Fatalf("expected persisted preflight report, got error: %v", err)
	}

	if report.Status != models.PreflightStatusBlocked {
		t.Fatalf("expected blocked persisted report, got %q", report.Status)
	}
	assertPreflightCheck(t, report, models.PreflightCodeTokenMissing, models.PreflightSeverityFatal)
	assertPreflightCheck(t, report, models.PreflightCodeCavesServerINIMissing, models.PreflightSeverityFatal)
}

func TestPreflightServiceGetBySlugReturnsNotFoundForUnknownCluster(t *testing.T) {
	rootDir := t.TempDir()

	database, err := db.Open(filepath.Join(rootDir, "app.db"))
	if err != nil {
		t.Fatalf("expected database to open, got error: %v", err)
	}
	defer database.Close()

	repo := cluster.NewRepository(database)
	service := NewPreflightService(repo)

	_, err = service.GetBySlug(context.Background(), "missing")
	if err == nil {
		t.Fatal("expected unknown cluster preflight to fail")
	}
	if !apierror.IsKind(err, apierror.KindNotFound) {
		t.Fatalf("expected not found api error, got %T %v", err, err)
	}
}

func assertPreflightCheck(t *testing.T, report models.PreflightReport, code string, severity string) {
	t.Helper()

	for _, check := range report.Checks {
		if check.Code == code {
			if check.Severity != severity {
				t.Fatalf("expected check %q severity %q, got %q", code, severity, check.Severity)
			}
			return
		}
	}

	t.Fatalf("expected preflight report to include check %q, got %+v", code, report.Checks)
}

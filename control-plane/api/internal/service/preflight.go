package service

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/files"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

type PreflightService struct {
	repo *cluster.Repository
}

func NewPreflightService(repo *cluster.Repository) PreflightService {
	return PreflightService{repo: repo}
}

func (s PreflightService) Preview(_ context.Context, req handlers.ClusterMutationRequest) (models.PreflightReport, error) {
	if req.Mode != "create" {
		return models.PreflightReport{}, apierror.Invalid("preflight preview only supports create mode", nil)
	}

	report := models.PreflightReport{}
	if strings.TrimSpace(req.ClusterToken) == "" {
		appendPreflightCheck(&report, models.PreflightCheck{
			Code:     models.PreflightCodeTokenMissing,
			Severity: models.PreflightSeverityFatal,
			Summary:  "cluster_token.txt is missing",
			Detail:   "The create request does not include a cluster token.",
			Hint:     "Provide a valid Klei cluster token before trying to auto-start the cluster.",
		})
	}
	if strings.TrimSpace(req.ClusterKey) == "" {
		appendPreflightCheck(&report, models.PreflightCheck{
			Code:     models.PreflightCodeClusterKeyMissing,
			Severity: models.PreflightSeverityFatal,
			Summary:  "cluster_key is missing",
			Detail:   "The create request does not include a shared cluster key.",
			Hint:     "Provide a non-empty cluster_key so Master and Caves can join the same cluster.",
		})
	}
	for _, detail := range s.detectManagedPortConflicts(0, req.MasterHostPort, req.CavesHostPort, req.SteamHostPort, req.CavesSteamHostPort) {
		appendPreflightCheck(&report, models.PreflightCheck{
			Code:     models.PreflightCodeHostPortConflict,
			Severity: models.PreflightSeverityFatal,
			Summary:  "host port conflicts with another managed cluster",
			Detail:   detail,
			Hint:     "Choose a different host port that is not already assigned to another managed cluster.",
		})
	}
	finalizePreflightReport(&report)
	return report, nil
}

func (s PreflightService) GetBySlug(_ context.Context, slug string) (models.PreflightReport, error) {
	record, err := s.repo.GetBySlug(slug)
	if err != nil {
		if err == sql.ErrNoRows {
			return models.PreflightReport{}, apierror.NotFound("cluster not found", err)
		}
		return models.PreflightReport{}, err
	}

	clusterDir := filepath.Join(record.BaseDir, "runtime", "data", record.ClusterName)
	report := models.PreflightReport{}

	tokenPath := filepath.Join(clusterDir, "cluster_token.txt")
	tokenBytes, err := os.ReadFile(tokenPath)
	switch {
	case os.IsNotExist(err):
		appendPreflightCheck(&report, models.PreflightCheck{
			Code:     models.PreflightCodeTokenMissing,
			Severity: models.PreflightSeverityFatal,
			Summary:  "cluster_token.txt is missing",
			Detail:   fmt.Sprintf("%s was not found.", tokenPath),
			Hint:     "Add a valid Klei cluster token before starting the cluster.",
		})
	case err != nil:
		return models.PreflightReport{}, err
	case strings.TrimSpace(string(tokenBytes)) == "":
		appendPreflightCheck(&report, models.PreflightCheck{
			Code:     models.PreflightCodeTokenMissing,
			Severity: models.PreflightSeverityFatal,
			Summary:  "cluster_token.txt is empty",
			Detail:   fmt.Sprintf("%s exists but does not contain a token.", tokenPath),
			Hint:     "Write a valid Klei cluster token into cluster_token.txt.",
		})
	}

	clusterINIPath := filepath.Join(clusterDir, "cluster.ini")
	clusterCfg, ok, err := readClusterINI(clusterINIPath, &report)
	if err != nil {
		return models.PreflightReport{}, err
	}
	if ok {
		if strings.TrimSpace(clusterCfg.Shard.ClusterKey) == "" {
			appendPreflightCheck(&report, models.PreflightCheck{
				Code:     models.PreflightCodeClusterKeyMissing,
				Severity: models.PreflightSeverityFatal,
				Summary:  "cluster_key is missing",
				Detail:   "cluster.ini does not define a non-empty [SHARD] cluster_key.",
				Hint:     "Set a shared cluster_key in cluster.ini before starting the cluster.",
			})
		}
	}

	masterCfg, masterOK, err := readServerINI(filepath.Join(clusterDir, "Master", "server.ini"), true, &report)
	if err != nil {
		return models.PreflightReport{}, err
	}
	cavesCfg, cavesOK, err := readServerINI(filepath.Join(clusterDir, "Caves", "server.ini"), false, &report)
	if err != nil {
		return models.PreflightReport{}, err
	}

	if masterOK {
		validateShardConfig(&report, masterCfg, true)
	}
	if cavesOK {
		validateShardConfig(&report, cavesCfg, false)
	}

	for _, detail := range s.detectManagedPortConflicts(record.ID, record.MasterHostPort, record.CavesHostPort, record.MasterSteamHostPort, record.CavesSteamHostPort) {
		appendPreflightCheck(&report, models.PreflightCheck{
			Code:     models.PreflightCodeHostPortConflict,
			Severity: models.PreflightSeverityFatal,
			Summary:  "host port conflicts with another managed cluster",
			Detail:   detail,
			Hint:     "Adjust the managed host port mapping so every cluster uses a unique port.",
		})
	}

	finalizePreflightReport(&report)
	return report, nil
}

func readClusterINI(path string, report *models.PreflightReport) (files.ClusterINIConfig, bool, error) {
	cfg, err := files.ParseClusterINI(path)
	switch {
	case os.IsNotExist(err):
		appendPreflightCheck(report, models.PreflightCheck{
			Code:     models.PreflightCodeClusterINIMissing,
			Severity: models.PreflightSeverityFatal,
			Summary:  "cluster.ini is missing",
			Detail:   fmt.Sprintf("%s was not found.", path),
			Hint:     "Restore or recreate cluster.ini before starting the cluster.",
		})
		return files.ClusterINIConfig{}, false, nil
	case err != nil:
		appendPreflightCheck(report, models.PreflightCheck{
			Code:     models.PreflightCodeClusterINIInvalid,
			Severity: models.PreflightSeverityFatal,
			Summary:  "cluster.ini could not be parsed",
			Detail:   err.Error(),
			Hint:     "Fix cluster.ini syntax errors and try again.",
		})
		return files.ClusterINIConfig{}, false, nil
	default:
		return cfg, true, nil
	}
}

func readServerINI(path string, isMaster bool, report *models.PreflightReport) (files.ServerINIConfig, bool, error) {
	cfg, err := files.ParseServerINI(path)
	switch {
	case os.IsNotExist(err):
		appendPreflightCheck(report, models.PreflightCheck{
			Code:     missingServerINICode(isMaster),
			Severity: models.PreflightSeverityFatal,
			Summary:  missingServerINISummary(isMaster),
			Detail:   fmt.Sprintf("%s was not found.", path),
			Hint:     "Restore the missing server.ini before starting the cluster.",
		})
		return files.ServerINIConfig{}, false, nil
	case err != nil:
		appendPreflightCheck(report, models.PreflightCheck{
			Code:     invalidServerINICode(isMaster),
			Severity: models.PreflightSeverityFatal,
			Summary:  invalidServerINISummary(isMaster),
			Detail:   err.Error(),
			Hint:     "Fix the shard server.ini syntax errors and try again.",
		})
		return files.ServerINIConfig{}, false, nil
	default:
		return cfg, true, nil
	}
}

func validateShardConfig(report *models.PreflightReport, cfg files.ServerINIConfig, isMaster bool) {
	expectedName := "Caves"
	expectedMasterValue := false
	code := models.PreflightCodeCavesShardInvalid
	if isMaster {
		expectedName = "Master"
		expectedMasterValue = true
		code = models.PreflightCodeMasterShardInvalid
	}

	if cfg.Shard.IsMaster != expectedMasterValue || cfg.Shard.Name != expectedName || cfg.Network.ServerPort <= 0 || cfg.Steam.MasterServerPort <= 0 || cfg.Steam.AuthenticationPort <= 0 {
		appendPreflightCheck(report, models.PreflightCheck{
			Code:     code,
			Severity: models.PreflightSeverityFatal,
			Summary:  fmt.Sprintf("%s shard configuration is incomplete", expectedName),
			Detail:   fmt.Sprintf("Expected name=%s is_master=%t with non-zero network and steam ports.", expectedName, expectedMasterValue),
			Hint:     fmt.Sprintf("Fix %s/server.ini so shard role and port fields match the managed layout.", expectedName),
		})
	}
}

func missingServerINICode(isMaster bool) string {
	if isMaster {
		return models.PreflightCodeMasterServerINIMissing
	}
	return models.PreflightCodeCavesServerINIMissing
}

func invalidServerINICode(isMaster bool) string {
	if isMaster {
		return models.PreflightCodeMasterServerINIInvalid
	}
	return models.PreflightCodeCavesServerINIInvalid
}

func missingServerINISummary(isMaster bool) string {
	if isMaster {
		return "Master server.ini is missing"
	}
	return "Caves server.ini is missing"
}

func invalidServerINISummary(isMaster bool) string {
	if isMaster {
		return "Master server.ini could not be parsed"
	}
	return "Caves server.ini could not be parsed"
}

func (s PreflightService) detectManagedPortConflicts(currentID int64, ports ...int) []string {
	records, err := s.repo.List()
	if err != nil {
		return nil
	}

	seen := map[int]struct{}{}
	for _, port := range ports {
		if port <= 0 {
			continue
		}
		seen[port] = struct{}{}
	}

	conflicts := []string{}
	for _, record := range records {
		if record.ID == currentID {
			continue
		}
		for _, port := range []int{
			record.MasterHostPort,
			record.CavesHostPort,
			record.MasterSteamHostPort,
			record.CavesSteamHostPort,
		} {
			if _, ok := seen[port]; ok {
				conflicts = append(conflicts, fmt.Sprintf("Port %d is already assigned to managed cluster %s.", port, record.Slug))
			}
		}
	}
	return conflicts
}

func appendPreflightCheck(report *models.PreflightReport, check models.PreflightCheck) {
	report.Checks = append(report.Checks, check)
	switch check.Severity {
	case models.PreflightSeverityFatal:
		report.FatalCount++
	case models.PreflightSeverityWarning:
		report.WarningCount++
	}
}

func finalizePreflightReport(report *models.PreflightReport) {
	if report.FatalCount > 0 {
		report.Status = models.PreflightStatusBlocked
		return
	}
	report.Status = models.PreflightStatusReady
}

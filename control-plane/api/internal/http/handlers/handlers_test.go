package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/auth"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestLoginAndLogoutHandlers(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	auditService := &fakeAuditService{}
	router := NewRouter(Dependencies{
		SessionSecret:       secret,
		SessionTTL:          90 * time.Minute,
		SessionCookieSecure: true,
		Auth:                fakeAuthService{allow: true},
		Audit:               auditService,
	})

	loginBody := bytes.NewBufferString(`{"username":"admin","password":"secret"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/login", loginBody)
	loginReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	loginRec := httptest.NewRecorder()

	router.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected login to succeed, got %d", loginRec.Code)
	}

	cookies := loginRec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected login to set a session cookie")
	}
	if !cookies[0].Secure {
		t.Fatal("expected login cookie to set Secure when configured")
	}
	if cookies[0].MaxAge != int((90 * time.Minute).Seconds()) {
		t.Fatalf("expected login cookie max-age to match ttl, got %d", cookies[0].MaxAge)
	}
	if cookies[0].Expires.IsZero() {
		t.Fatal("expected login cookie to set explicit Expires")
	}
	if cookies[0].Expires.Before(time.Now().UTC().Add(89*time.Minute)) || cookies[0].Expires.After(time.Now().UTC().Add(91*time.Minute)) {
		t.Fatalf("expected login cookie expiry to be about 90 minutes ahead, got %s", cookies[0].Expires)
	}

	logoutReq := httptest.NewRequest(http.MethodPost, "/api/logout", nil)
	logoutReq.AddCookie(cookies[0])
	logoutReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	logoutRec := httptest.NewRecorder()

	router.ServeHTTP(logoutRec, logoutReq)

	if logoutRec.Code != http.StatusNoContent {
		t.Fatalf("expected logout to return 204, got %d", logoutRec.Code)
	}
	logoutCookies := logoutRec.Result().Cookies()
	if len(logoutCookies) == 0 {
		t.Fatal("expected logout to clear session cookie")
	}
	if !logoutCookies[0].Secure {
		t.Fatal("expected logout cookie to preserve Secure when configured")
	}
	if len(auditService.records) != 2 {
		t.Fatalf("expected login and logout to both record audit entries, got %+v", auditService.records)
	}
	if auditService.records[0].action != "login_success" {
		t.Fatalf("expected first audit action login_success, got %q", auditService.records[0].action)
	}
	if auditService.records[1].action != "logout_success" {
		t.Fatalf("expected second audit action logout_success, got %q", auditService.records[1].action)
	}
}

func TestStateChangingHandlersRequireCSRFFetchHeader(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
	})

	loginReq := httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewBufferString(`{"username":"admin","password":"secret"}`))
	loginRec := httptest.NewRecorder()

	router.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusForbidden {
		t.Fatalf("expected login without csrf header to return 403, got %d", loginRec.Code)
	}
	if !bytes.Contains(loginRec.Body.Bytes(), []byte(`"error":"missing csrf header"`)) {
		t.Fatalf("expected csrf failure response, got %q", loginRec.Body.String())
	}
}

func TestSessionHandler(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
	})

	sessionReq := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	sessionReq.AddCookie(issueSessionCookie(t, secret))
	sessionRec := httptest.NewRecorder()

	router.ServeHTTP(sessionRec, sessionReq)

	if sessionRec.Code != http.StatusOK {
		t.Fatalf("expected session to return 200, got %d", sessionRec.Code)
	}

	if !bytes.Contains(sessionRec.Body.Bytes(), []byte(`"authenticated":true`)) {
		t.Fatalf("expected session response to mark authenticated, got %q", sessionRec.Body.String())
	}
}

func TestClusterHandlers(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	auditService := &fakeAuditService{}
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
		Audit:         auditService,
		Clusters: fakeClusterService{
			list: []models.ClusterRecord{
				{ID: 1, Slug: "cluster-a", DisplayName: "Cluster A", ClusterName: "Cluster_A", Status: "running"},
			},
			created:  models.ClusterRecord{ID: 2, Slug: "cluster-b", DisplayName: "Cluster B", ClusterName: "Cluster_B", Status: "stopped"},
			imported: models.ClusterRecord{ID: 3, Slug: "cluster-c", DisplayName: "Cluster C", ClusterName: "Cluster_C", Status: "stopped"},
		},
	})

	sessionCookie := issueSessionCookie(t, secret)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/clusters", nil)
	req.AddCookie(sessionCookie)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected cluster list to return 200, got %d", rec.Code)
	}

	createBody := bytes.NewBufferString(`{"mode":"create","slug":"cluster-b","display_name":"Cluster B","cluster_name":"Cluster_B","base_dir":"/srv/cluster-b"}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/clusters", createBody)
	createReq.AddCookie(sessionCookie)
	createReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected create cluster to return 201, got %d", createRec.Code)
	}
	if len(auditService.records) != 1 || auditService.records[0].action != "cluster_create" {
		t.Fatalf("expected create cluster to record cluster_create audit, got %+v", auditService.records)
	}

	importBody := bytes.NewBufferString(`{"mode":"import","slug":"cluster-c","display_name":"Cluster C","cluster_name":"Cluster_C","base_dir":"/srv/cluster-c"}`)
	importReq := httptest.NewRequest(http.MethodPost, "/api/clusters", importBody)
	importReq.AddCookie(sessionCookie)
	importReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	importRec := httptest.NewRecorder()
	router.ServeHTTP(importRec, importReq)

	if importRec.Code != http.StatusCreated {
		t.Fatalf("expected import cluster to return 201, got %d", importRec.Code)
	}
	if len(auditService.records) != 2 || auditService.records[1].action != "cluster_import" {
		t.Fatalf("expected import cluster to record cluster_import audit, got %+v", auditService.records)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/clusters/cluster-a", nil)
	deleteReq.AddCookie(sessionCookie)
	deleteReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	deleteRec := httptest.NewRecorder()
	router.ServeHTTP(deleteRec, deleteReq)

	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("expected delete cluster to return 204, got %d", deleteRec.Code)
	}
	if len(auditService.records) != 3 || auditService.records[2].action != "cluster_delete" {
		t.Fatalf("expected delete cluster to record cluster_delete audit, got %+v", auditService.records)
	}
}

func TestConfigAndJobsHandlers(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	auditService := &fakeAuditService{
		list: []models.AuditRecord{
			{ID: 21, Actor: "admin", Action: "login_success", Summary: "client=127.0.0.1"},
			{ID: 22, Actor: "admin", Action: "cluster_action_start", TargetType: "cluster", Summary: "slug=cluster-a"},
			{ID: 23, Actor: "admin", Action: "cluster_action_stop", TargetType: "cluster", Summary: "slug=cluster-b"},
		},
	}
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
		Config: fakeConfigService{
			snapshot: models.ClusterConfigSnapshot{
				ClusterName: "Cluster_A",
				Master: models.ShardConfigSnapshot{
					ServerPort: 11000,
				},
			},
		},
		Runtime: fakeRuntimeService{
			job: models.JobRecord{ID: 10, JobType: "start", Status: "running"},
		},
		Jobs: fakeJobsService{
			list: []models.JobRecord{
				{ID: 10, JobType: "start", Status: "running"},
			},
		},
		Audit: auditService,
		Backups: fakeBackupService{
			list: []models.BackupRecord{
				{
					Name:       "Cluster_A-20260329T130000Z.tar.gz",
					SizeBytes:  512,
					CreatedAt:  time.Date(2026, 3, 29, 13, 0, 0, 0, time.UTC),
					ClusterSlug: "cluster-a",
				},
			},
		},
	})

	sessionCookie := issueSessionCookie(t, secret)

	getConfigRec := httptest.NewRecorder()
	getConfigReq := httptest.NewRequest(http.MethodGet, "/api/clusters/cluster-a/config", nil)
	getConfigReq.AddCookie(sessionCookie)
	router.ServeHTTP(getConfigRec, getConfigReq)

	if getConfigRec.Code != http.StatusOK {
		t.Fatalf("expected get config to return 200, got %d", getConfigRec.Code)
	}

	savePayload, err := json.Marshal(models.ClusterConfigSnapshot{ClusterName: "Cluster_A"})
	if err != nil {
		t.Fatalf("expected save payload to marshal, got error: %v", err)
	}

	saveConfigReq := httptest.NewRequest(http.MethodPut, "/api/clusters/cluster-a/config", bytes.NewReader(savePayload))
	saveConfigReq.AddCookie(sessionCookie)
	saveConfigReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	saveConfigRec := httptest.NewRecorder()
	router.ServeHTTP(saveConfigRec, saveConfigReq)

	if saveConfigRec.Code != http.StatusNoContent {
		t.Fatalf("expected save config to return 204, got %d", saveConfigRec.Code)
	}
	if len(auditService.records) != 1 || auditService.records[0].action != "config_save" {
		t.Fatalf("expected save config to record config_save audit, got %+v", auditService.records)
	}

	actionReq := httptest.NewRequest(http.MethodPost, "/api/clusters/cluster-a/actions", bytes.NewBufferString(`{"action":"start"}`))
	actionReq.AddCookie(sessionCookie)
	actionReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	actionRec := httptest.NewRecorder()
	router.ServeHTTP(actionRec, actionReq)

	if actionRec.Code != http.StatusAccepted {
		t.Fatalf("expected lifecycle action to return 202, got %d", actionRec.Code)
	}
	if len(auditService.records) != 2 || auditService.records[1].action != "cluster_action_start" {
		t.Fatalf("expected action to record cluster_action_start audit, got %+v", auditService.records)
	}

	backupReq := httptest.NewRequest(http.MethodPost, "/api/clusters/cluster-a/actions", bytes.NewBufferString(`{"action":"backup"}`))
	backupReq.AddCookie(sessionCookie)
	backupReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	backupRec := httptest.NewRecorder()
	router.ServeHTTP(backupRec, backupReq)

	if backupRec.Code != http.StatusAccepted {
		t.Fatalf("expected backup action to return 202, got %d", backupRec.Code)
	}
	if len(auditService.records) != 3 || auditService.records[2].action != "cluster_action_backup" {
		t.Fatalf("expected backup action to record cluster_action_backup audit, got %+v", auditService.records)
	}

	jobsReq := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
	jobsReq.AddCookie(sessionCookie)
	jobsRec := httptest.NewRecorder()
	router.ServeHTTP(jobsRec, jobsReq)

	if jobsRec.Code != http.StatusOK {
		t.Fatalf("expected jobs list to return 200, got %d", jobsRec.Code)
	}

	auditReq := httptest.NewRequest(http.MethodGet, "/api/audit", nil)
	auditReq.AddCookie(sessionCookie)
	auditRec := httptest.NewRecorder()
	router.ServeHTTP(auditRec, auditReq)

	if auditRec.Code != http.StatusOK {
		t.Fatalf("expected audit list to return 200, got %d", auditRec.Code)
	}
	if !bytes.Contains(auditRec.Body.Bytes(), []byte(`"action":"login_success"`)) {
		t.Fatalf("expected audit list to include login_success entry, got %q", auditRec.Body.String())
	}

	filteredAuditReq := httptest.NewRequest(http.MethodGet, "/api/audit?slug=cluster-a", nil)
	filteredAuditReq.AddCookie(sessionCookie)
	filteredAuditRec := httptest.NewRecorder()
	router.ServeHTTP(filteredAuditRec, filteredAuditReq)

	if filteredAuditRec.Code != http.StatusOK {
		t.Fatalf("expected filtered audit list to return 200, got %d", filteredAuditRec.Code)
	}
	if !bytes.Contains(filteredAuditRec.Body.Bytes(), []byte(`"action":"cluster_action_start"`)) {
		t.Fatalf("expected filtered audit list to include cluster-a entry, got %q", filteredAuditRec.Body.String())
	}
	if bytes.Contains(filteredAuditRec.Body.Bytes(), []byte(`"action":"cluster_action_stop"`)) {
		t.Fatalf("expected filtered audit list to exclude other cluster entry, got %q", filteredAuditRec.Body.String())
	}

	limitedAuditReq := httptest.NewRequest(http.MethodGet, "/api/audit?limit=1", nil)
	limitedAuditReq.AddCookie(sessionCookie)
	limitedAuditRec := httptest.NewRecorder()
	router.ServeHTTP(limitedAuditRec, limitedAuditReq)

	if limitedAuditRec.Code != http.StatusOK {
		t.Fatalf("expected limited audit list to return 200, got %d", limitedAuditRec.Code)
	}
	if bytes.Count(limitedAuditRec.Body.Bytes(), []byte(`"action":`)) != 1 {
		t.Fatalf("expected limited audit list to return exactly one record, got %q", limitedAuditRec.Body.String())
	}

	backupsReq := httptest.NewRequest(http.MethodGet, "/api/clusters/cluster-a/backups", nil)
	backupsReq.AddCookie(sessionCookie)
	backupsRec := httptest.NewRecorder()
	router.ServeHTTP(backupsRec, backupsReq)

	if backupsRec.Code != http.StatusOK {
		t.Fatalf("expected backups list to return 200, got %d", backupsRec.Code)
	}
	if !bytes.Contains(backupsRec.Body.Bytes(), []byte(`"name":"Cluster_A-20260329T130000Z.tar.gz"`)) {
		t.Fatalf("expected backups list to include archive metadata, got %q", backupsRec.Body.String())
	}
}

func TestBackupDownloadHandlerServesArchiveFile(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	archiveDir := t.TempDir()
	archivePath := filepath.Join(archiveDir, "Cluster_A-20260329T130000Z.tar.gz")
	if err := os.WriteFile(archivePath, []byte("archive-bytes"), 0o644); err != nil {
		t.Fatalf("expected archive file to be written, got error: %v", err)
	}

	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
		Backups: fakeBackupService{
			resolvePath: archivePath,
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/clusters/cluster-a/backups/Cluster_A-20260329T130000Z.tar.gz", nil)
	req.AddCookie(issueSessionCookie(t, secret))
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected backup download to return 200, got %d", rec.Code)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("archive-bytes")) {
		t.Fatalf("expected backup download body to contain archive bytes, got %q", rec.Body.String())
	}
	if contentDisposition := rec.Header().Get("Content-Disposition"); contentDisposition == "" {
		t.Fatal("expected backup download to set Content-Disposition")
	}
}

func TestReadHandlersRequireSession(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
		Clusters:      fakeClusterService{},
		Config:        fakeConfigService{},
		Jobs:          fakeJobsService{},
	})

	tests := []struct {
		name string
		path string
	}{
		{name: "cluster list", path: "/api/clusters"},
		{name: "cluster config", path: "/api/clusters/cluster-a/config"},
		{name: "cluster backups", path: "/api/clusters/cluster-a/backups"},
		{name: "jobs list", path: "/api/jobs"},
		{name: "audit list", path: "/api/audit"},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, testCase.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected %s to require session and return 401, got %d", testCase.path, rec.Code)
			}
		})
	}
}

func TestHandlersMapKnownErrorsToStructuredResponses(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	sessionCookie := issueSessionCookie(t, secret)
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
		Config: fakeConfigService{
			getErr:  sql.ErrNoRows,
			saveErr: apierror.Invalid("invalid cluster.ini", nil),
		},
		Runtime: fakeRuntimeService{
			runErr: apierror.Invalid("unsupported action", nil),
		},
	})

	getConfigReq := httptest.NewRequest(http.MethodGet, "/api/clusters/missing/config", nil)
	getConfigReq.AddCookie(sessionCookie)
	getConfigRec := httptest.NewRecorder()
	router.ServeHTTP(getConfigRec, getConfigReq)
	if getConfigRec.Code != http.StatusNotFound {
		t.Fatalf("expected missing cluster config to return 404, got %d", getConfigRec.Code)
	}
	if !bytes.Contains(getConfigRec.Body.Bytes(), []byte(`"error":"cluster not found"`)) {
		t.Fatalf("expected missing cluster config body to include json error, got %q", getConfigRec.Body.String())
	}

	saveConfigReq := httptest.NewRequest(http.MethodPut, "/api/clusters/cluster-a/config", bytes.NewBufferString(`{"cluster_name":"Cluster_A"}`))
	saveConfigReq.AddCookie(sessionCookie)
	saveConfigReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	saveConfigRec := httptest.NewRecorder()
	router.ServeHTTP(saveConfigRec, saveConfigReq)
	if saveConfigRec.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid config save to return 400, got %d", saveConfigRec.Code)
	}
	if !bytes.Contains(saveConfigRec.Body.Bytes(), []byte(`"error":"invalid cluster.ini"`)) {
		t.Fatalf("expected invalid config save body to include json error, got %q", saveConfigRec.Body.String())
	}

	actionReq := httptest.NewRequest(http.MethodPost, "/api/clusters/cluster-a/actions", bytes.NewBufferString(`{"action":"explode"}`))
	actionReq.AddCookie(sessionCookie)
	actionReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	actionRec := httptest.NewRecorder()
	router.ServeHTTP(actionRec, actionReq)
	if actionRec.Code != http.StatusBadRequest {
		t.Fatalf("expected unsupported action to return 400, got %d", actionRec.Code)
	}
	if !bytes.Contains(actionRec.Body.Bytes(), []byte(`"error":"unsupported action"`)) {
		t.Fatalf("expected unsupported action body to include json error, got %q", actionRec.Body.String())
	}
}

func TestClusterMutationHandlersMapInvalidInputsToBadRequest(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	sessionCookie := issueSessionCookie(t, secret)
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
		Clusters: fakeClusterService{
			createErr: apierror.Invalid("invalid cluster slug", nil),
			importErr: apierror.Invalid("base_dir required for import", nil),
		},
	})

	createReq := httptest.NewRequest(http.MethodPost, "/api/clusters", bytes.NewBufferString(`{"mode":"create","slug":"../bad","display_name":"Bad","cluster_name":"Bad"}`))
	createReq.AddCookie(sessionCookie)
	createReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid create request to return 400, got %d", createRec.Code)
	}
	if !bytes.Contains(createRec.Body.Bytes(), []byte(`"error":"invalid cluster slug"`)) {
		t.Fatalf("expected invalid create response to include json error, got %q", createRec.Body.String())
	}

	importReq := httptest.NewRequest(http.MethodPost, "/api/clusters", bytes.NewBufferString(`{"mode":"import","slug":"cluster-a","display_name":"Cluster A","cluster_name":"Cluster_A","base_dir":""}`))
	importReq.AddCookie(sessionCookie)
	importReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	importRec := httptest.NewRecorder()
	router.ServeHTTP(importRec, importReq)
	if importRec.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid import request to return 400, got %d", importRec.Code)
	}
	if !bytes.Contains(importRec.Body.Bytes(), []byte(`"error":"base_dir required for import"`)) {
		t.Fatalf("expected invalid import response to include json error, got %q", importRec.Body.String())
	}
}

func TestLoginHandlerReturnsTooManyRequestsWhenRateLimited(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	auditService := &fakeAuditService{}
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
		LoginLimiter:  fakeLoginLimiter{allow: false},
		Audit:         auditService,
	})

	loginReq := httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewBufferString(`{"username":"admin","password":"secret"}`))
	loginReq.RemoteAddr = "127.0.0.1:43210"
	loginReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
	loginRec := httptest.NewRecorder()

	router.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected rate limited login to return 429, got %d", loginRec.Code)
	}
	if !bytes.Contains(loginRec.Body.Bytes(), []byte(`"error":"too many login attempts"`)) {
		t.Fatalf("expected rate limited login response to include json error, got %q", loginRec.Body.String())
	}
	if len(auditService.records) != 1 {
		t.Fatalf("expected one audit record for rate limited login, got %d", len(auditService.records))
	}
	if auditService.records[0].action != "login_rate_limited" {
		t.Fatalf("expected audit action login_rate_limited, got %q", auditService.records[0].action)
	}
}

func TestLoginHandlerRecordsAuditEntriesForSuccessfulAndFailedAttempts(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")

	t.Run("success", func(t *testing.T) {
		auditService := &fakeAuditService{}
		router := NewRouter(Dependencies{
			SessionSecret: secret,
			Auth:          fakeAuthService{allow: true},
			Audit:         auditService,
		})

		loginReq := httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewBufferString(`{"username":"admin","password":"secret"}`))
		loginReq.RemoteAddr = "127.0.0.1:43210"
		loginReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
		loginRec := httptest.NewRecorder()

		router.ServeHTTP(loginRec, loginReq)

		if loginRec.Code != http.StatusOK {
			t.Fatalf("expected login to succeed, got %d", loginRec.Code)
		}
		if len(auditService.records) != 1 {
			t.Fatalf("expected one audit record for successful login, got %d", len(auditService.records))
		}
		if auditService.records[0].action != "login_success" {
			t.Fatalf("expected audit action login_success, got %q", auditService.records[0].action)
		}
	})

	t.Run("failure", func(t *testing.T) {
		auditService := &fakeAuditService{}
		router := NewRouter(Dependencies{
			SessionSecret: secret,
			Auth:          fakeAuthService{allow: false},
			Audit:         auditService,
		})

		loginReq := httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewBufferString(`{"username":"admin","password":"wrong"}`))
		loginReq.RemoteAddr = "127.0.0.1:43210"
		loginReq.Header.Set("X-DST-Control-Plane-CSRF", "1")
		loginRec := httptest.NewRecorder()

		router.ServeHTTP(loginRec, loginReq)

		if loginRec.Code != http.StatusUnauthorized {
			t.Fatalf("expected login failure to return 401, got %d", loginRec.Code)
		}
		if len(auditService.records) != 1 {
			t.Fatalf("expected one audit record for failed login, got %d", len(auditService.records))
		}
		if auditService.records[0].action != "login_failed" {
			t.Fatalf("expected audit action login_failed, got %q", auditService.records[0].action)
		}
	})
}

func issueSessionCookie(t *testing.T, secret []byte) *http.Cookie {
	t.Helper()

	token, err := auth.IssueSessionToken("admin", time.Now().UTC().Add(-time.Hour), 2*time.Hour, secret)
	if err != nil {
		t.Fatalf("expected session token, got error: %v", err)
	}

	return &http.Cookie{
		Name:  SessionCookieName,
		Value: token,
	}
}

type fakeAuthService struct {
	allow bool
}

func (f fakeAuthService) Authenticate(_ context.Context, username string, password string) (bool, error) {
	return f.allow && username != "" && password != "", nil
}

type fakeLoginLimiter struct {
	allow bool
}

func (f fakeLoginLimiter) Allow(_ string) bool {
	return f.allow
}

func (f fakeLoginLimiter) RegisterFailure(_ string) {}

func (f fakeLoginLimiter) Reset(_ string) {}

type fakeAuditService struct {
	records []fakeAuditRecord
	list    []models.AuditRecord
}

type fakeAuditRecord struct {
	actor      string
	action     string
	targetType string
	targetID   int64
	summary    string
}

func (f *fakeAuditService) Record(actor string, action string, targetType string, targetID int64, summary string) (models.AuditRecord, error) {
	f.records = append(f.records, fakeAuditRecord{
		actor:      actor,
		action:     action,
		targetType: targetType,
		targetID:   targetID,
		summary:    summary,
	})

	return models.AuditRecord{
		Actor:      actor,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Summary:    summary,
	}, nil
}

func (f *fakeAuditService) List(limit int) ([]models.AuditRecord, error) {
	if len(f.list) <= limit {
		return f.list, nil
	}

	return f.list[:limit], nil
}

type fakeClusterService struct {
	list      []models.ClusterRecord
	created   models.ClusterRecord
	imported  models.ClusterRecord
	deleted   models.ClusterRecord
	createErr error
	importErr error
	deleteErr error
}

func (f fakeClusterService) List(_ context.Context) ([]models.ClusterRecord, error) {
	return f.list, nil
}

func (f fakeClusterService) Create(_ context.Context, _ ClusterMutationRequest) (models.ClusterRecord, error) {
	return f.created, f.createErr
}

func (f fakeClusterService) Import(_ context.Context, _ ClusterMutationRequest) (models.ClusterRecord, error) {
	return f.imported, f.importErr
}

func (f fakeClusterService) Delete(_ context.Context, _ string) (models.ClusterRecord, error) {
	return f.deleted, f.deleteErr
}

type fakeConfigService struct {
	snapshot models.ClusterConfigSnapshot
	getErr   error
	saveErr  error
}

func (f fakeConfigService) GetSnapshot(_ context.Context, _ string) (models.ClusterConfigSnapshot, error) {
	return f.snapshot, f.getErr
}

func (f fakeConfigService) SaveSnapshot(_ context.Context, _ string, _ models.ClusterConfigSnapshot) error {
	return f.saveErr
}

type fakeRuntimeService struct {
	job        models.JobRecord
	runErr     error
	runAction  func(ctx context.Context, slug string, action string, actor string) (models.JobRecord, error)
}

func (f fakeRuntimeService) RunAction(ctx context.Context, slug string, action string, actor string) (models.JobRecord, error) {
	if f.runAction != nil {
		return f.runAction(ctx, slug, action, actor)
	}
	return f.job, f.runErr
}

type fakeJobsService struct {
	list []models.JobRecord
}

func (f fakeJobsService) List(_ context.Context, _ int) ([]models.JobRecord, error) {
	return f.list, nil
}

type fakeBackupService struct {
	list        []models.BackupRecord
	listErr     error
	resolvePath string
	resolveErr  error
}

func (f fakeBackupService) List(_ context.Context, _ string) ([]models.BackupRecord, error) {
	return f.list, f.listErr
}

func (f fakeBackupService) ResolveArchivePath(_ context.Context, _ string, _ string) (string, error) {
	return f.resolvePath, f.resolveErr
}

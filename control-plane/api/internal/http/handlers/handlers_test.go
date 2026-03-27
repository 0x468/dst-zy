package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/auth"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestLoginAndLogoutHandlers(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
	})

	loginBody := bytes.NewBufferString(`{"username":"admin","password":"secret"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/login", loginBody)
	loginRec := httptest.NewRecorder()

	router.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected login to succeed, got %d", loginRec.Code)
	}

	cookies := loginRec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected login to set a session cookie")
	}

	logoutReq := httptest.NewRequest(http.MethodPost, "/api/logout", nil)
	logoutReq.AddCookie(cookies[0])
	logoutRec := httptest.NewRecorder()

	router.ServeHTTP(logoutRec, logoutReq)

	if logoutRec.Code != http.StatusNoContent {
		t.Fatalf("expected logout to return 204, got %d", logoutRec.Code)
	}
}

func TestClusterHandlers(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	router := NewRouter(Dependencies{
		SessionSecret: secret,
		Auth:          fakeAuthService{allow: true},
		Clusters: fakeClusterService{
			list: []models.ClusterRecord{
				{ID: 1, Slug: "cluster-a", DisplayName: "Cluster A", ClusterName: "Cluster_A", Status: "running"},
			},
			created: models.ClusterRecord{ID: 2, Slug: "cluster-b", DisplayName: "Cluster B", ClusterName: "Cluster_B", Status: "stopped"},
			imported: models.ClusterRecord{ID: 3, Slug: "cluster-c", DisplayName: "Cluster C", ClusterName: "Cluster_C", Status: "stopped"},
		},
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/clusters", nil)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected cluster list to return 200, got %d", rec.Code)
	}

	sessionCookie := issueSessionCookie(t, secret)
	createBody := bytes.NewBufferString(`{"mode":"create","slug":"cluster-b","display_name":"Cluster B","cluster_name":"Cluster_B","base_dir":"/srv/cluster-b"}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/clusters", createBody)
	createReq.AddCookie(sessionCookie)
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected create cluster to return 201, got %d", createRec.Code)
	}

	importBody := bytes.NewBufferString(`{"mode":"import","slug":"cluster-c","display_name":"Cluster C","cluster_name":"Cluster_C","base_dir":"/srv/cluster-c"}`)
	importReq := httptest.NewRequest(http.MethodPost, "/api/clusters", importBody)
	importReq.AddCookie(sessionCookie)
	importRec := httptest.NewRecorder()
	router.ServeHTTP(importRec, importReq)

	if importRec.Code != http.StatusCreated {
		t.Fatalf("expected import cluster to return 201, got %d", importRec.Code)
	}
}

func TestConfigAndJobsHandlers(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
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
	})

	getConfigRec := httptest.NewRecorder()
	getConfigReq := httptest.NewRequest(http.MethodGet, "/api/clusters/cluster-a/config", nil)
	router.ServeHTTP(getConfigRec, getConfigReq)

	if getConfigRec.Code != http.StatusOK {
		t.Fatalf("expected get config to return 200, got %d", getConfigRec.Code)
	}

	sessionCookie := issueSessionCookie(t, secret)
	savePayload, err := json.Marshal(models.ClusterConfigSnapshot{ClusterName: "Cluster_A"})
	if err != nil {
		t.Fatalf("expected save payload to marshal, got error: %v", err)
	}

	saveConfigReq := httptest.NewRequest(http.MethodPut, "/api/clusters/cluster-a/config", bytes.NewReader(savePayload))
	saveConfigReq.AddCookie(sessionCookie)
	saveConfigRec := httptest.NewRecorder()
	router.ServeHTTP(saveConfigRec, saveConfigReq)

	if saveConfigRec.Code != http.StatusNoContent {
		t.Fatalf("expected save config to return 204, got %d", saveConfigRec.Code)
	}

	actionReq := httptest.NewRequest(http.MethodPost, "/api/clusters/cluster-a/actions", bytes.NewBufferString(`{"action":"start"}`))
	actionReq.AddCookie(sessionCookie)
	actionRec := httptest.NewRecorder()
	router.ServeHTTP(actionRec, actionReq)

	if actionRec.Code != http.StatusAccepted {
		t.Fatalf("expected lifecycle action to return 202, got %d", actionRec.Code)
	}

	jobsReq := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
	jobsRec := httptest.NewRecorder()
	router.ServeHTTP(jobsRec, jobsReq)

	if jobsRec.Code != http.StatusOK {
		t.Fatalf("expected jobs list to return 200, got %d", jobsRec.Code)
	}
}

func issueSessionCookie(t *testing.T, secret []byte) *http.Cookie {
	t.Helper()

	token, err := auth.IssueSessionToken("admin", time.Date(2026, 3, 28, 12, 0, 0, 0, time.UTC), 2*time.Hour, secret)
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

type fakeClusterService struct {
	list     []models.ClusterRecord
	created  models.ClusterRecord
	imported models.ClusterRecord
}

func (f fakeClusterService) List(_ context.Context) ([]models.ClusterRecord, error) {
	return f.list, nil
}

func (f fakeClusterService) Create(_ context.Context, _ ClusterMutationRequest) (models.ClusterRecord, error) {
	return f.created, nil
}

func (f fakeClusterService) Import(_ context.Context, _ ClusterMutationRequest) (models.ClusterRecord, error) {
	return f.imported, nil
}

type fakeConfigService struct {
	snapshot models.ClusterConfigSnapshot
}

func (f fakeConfigService) GetSnapshot(_ context.Context, _ string) (models.ClusterConfigSnapshot, error) {
	return f.snapshot, nil
}

func (f fakeConfigService) SaveSnapshot(_ context.Context, _ string, _ models.ClusterConfigSnapshot) error {
	return nil
}

type fakeRuntimeService struct {
	job models.JobRecord
}

func (f fakeRuntimeService) RunAction(_ context.Context, _ string, _ string, _ string) (models.JobRecord, error) {
	return f.job, nil
}

type fakeJobsService struct {
	list []models.JobRecord
}

func (f fakeJobsService) List(_ context.Context, _ int) ([]models.JobRecord, error) {
	return f.list, nil
}

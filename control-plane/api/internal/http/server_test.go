package httpapi

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/auth"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

func TestNewServerHandlerServesHealthAPIAndSPA(t *testing.T) {
	staticDir := filepath.Join(t.TempDir(), "web")
	if err := os.MkdirAll(filepath.Join(staticDir, "assets"), 0o755); err != nil {
		t.Fatalf("expected static assets dir to be created, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<html><body>control-plane</body></html>"), 0o644); err != nil {
		t.Fatalf("expected index.html to be written, got error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "assets", "app.js"), []byte("console.log('ok')"), 0o644); err != nil {
		t.Fatalf("expected asset file to be written, got error: %v", err)
	}

	secret := []byte("0123456789abcdef0123456789abcdef")
	handler := NewServerHandler(handlers.Dependencies{
		SessionSecret: secret,
		Auth:          handlerFakeAuthService{allow: true},
		Clusters: handlerFakeClusterService{
			list: []models.ClusterRecord{
				{ID: 1, Slug: "cluster-a", DisplayName: "Cluster A", ClusterName: "Cluster_A", Status: "running"},
			},
		},
		Config:  handlerFakeConfigService{},
		Runtime: handlerFakeRuntimeService{},
		Jobs:    handlerFakeJobsService{},
	}, staticDir)

	healthReq := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	healthRec := httptest.NewRecorder()
	handler.ServeHTTP(healthRec, healthReq)
	if healthRec.Code != http.StatusOK {
		t.Fatalf("expected healthz to return 200, got %d", healthRec.Code)
	}

	apiReq := httptest.NewRequest(http.MethodGet, "/api/clusters", nil)
	apiReq.AddCookie(issueServerSessionCookie(t, secret))
	apiRec := httptest.NewRecorder()
	handler.ServeHTTP(apiRec, apiReq)
	if apiRec.Code != http.StatusOK {
		t.Fatalf("expected api clusters to return 200, got %d", apiRec.Code)
	}

	rootReq := httptest.NewRequest(http.MethodGet, "/", nil)
	rootRec := httptest.NewRecorder()
	handler.ServeHTTP(rootRec, rootReq)
	if rootRec.Code != http.StatusOK || !bytes.Contains(rootRec.Body.Bytes(), []byte("control-plane")) {
		t.Fatalf("expected root to serve index.html, got %d and %q", rootRec.Code, rootRec.Body.String())
	}

	assetReq := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	assetRec := httptest.NewRecorder()
	handler.ServeHTTP(assetRec, assetReq)
	if assetRec.Code != http.StatusOK || !bytes.Contains(assetRec.Body.Bytes(), []byte("console.log")) {
		t.Fatalf("expected asset to be served, got %d and %q", assetRec.Code, assetRec.Body.String())
	}

	spaReq := httptest.NewRequest(http.MethodGet, "/clusters/cluster-a", nil)
	spaRec := httptest.NewRecorder()
	handler.ServeHTTP(spaRec, spaReq)
	if spaRec.Code != http.StatusOK || !bytes.Contains(spaRec.Body.Bytes(), []byte("control-plane")) {
		t.Fatalf("expected client route to fall back to index.html, got %d and %q", spaRec.Code, spaRec.Body.String())
	}
}

type handlerFakeAuthService struct {
	allow bool
}

func (f handlerFakeAuthService) Authenticate(_ context.Context, username string, password string) (bool, error) {
	return f.allow && username != "" && password != "", nil
}

type handlerFakeClusterService struct {
	list []models.ClusterRecord
}

func (f handlerFakeClusterService) List(_ context.Context) ([]models.ClusterRecord, error) {
	return f.list, nil
}

func (f handlerFakeClusterService) Create(_ context.Context, _ handlers.ClusterMutationRequest) (models.ClusterRecord, error) {
	return models.ClusterRecord{}, nil
}

func (f handlerFakeClusterService) Import(_ context.Context, _ handlers.ClusterMutationRequest) (models.ClusterRecord, error) {
	return models.ClusterRecord{}, nil
}

type handlerFakeConfigService struct{}

func (handlerFakeConfigService) GetSnapshot(_ context.Context, _ string) (models.ClusterConfigSnapshot, error) {
	return models.ClusterConfigSnapshot{}, nil
}

func (handlerFakeConfigService) SaveSnapshot(_ context.Context, _ string, _ models.ClusterConfigSnapshot) error {
	return nil
}

type handlerFakeRuntimeService struct{}

func (handlerFakeRuntimeService) RunAction(_ context.Context, _ string, _ string, _ string) (models.JobRecord, error) {
	return models.JobRecord{}, nil
}

type handlerFakeJobsService struct{}

func (handlerFakeJobsService) List(_ context.Context, _ int) ([]models.JobRecord, error) {
	return []models.JobRecord{}, nil
}

func issueServerSessionCookie(t *testing.T, secret []byte) *http.Cookie {
	t.Helper()

	token, err := auth.IssueSessionToken("admin", time.Date(2026, 3, 28, 12, 0, 0, 0, time.UTC), 2*time.Hour, secret)
	if err != nil {
		t.Fatalf("expected session token, got error: %v", err)
	}

	return &http.Cookie{
		Name:  handlers.SessionCookieName,
		Value: token,
	}
}

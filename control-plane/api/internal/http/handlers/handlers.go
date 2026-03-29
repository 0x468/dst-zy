package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/auth"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/middleware"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

const SessionCookieName = middleware.SessionCookieName

type Dependencies struct {
	SessionSecret       []byte
	SessionTTL          time.Duration
	SessionCookieSecure bool
	Auth                AuthService
	LoginLimiter        LoginLimiter
	Audit               AuditService
	Clusters            ClusterService
	Config              ConfigService
	Runtime             RuntimeService
	Jobs                JobsService
	Backups             BackupService
}

type AuthService interface {
	Authenticate(ctx context.Context, username string, password string) (bool, error)
}

type LoginLimiter interface {
	Allow(key string) bool
	RegisterFailure(key string)
	Reset(key string)
}

type AuditService interface {
	Record(actor string, action string, targetType string, targetID int64, summary string) (models.AuditRecord, error)
	List(limit int) ([]models.AuditRecord, error)
}

type ClusterService interface {
	List(ctx context.Context) ([]models.ClusterRecord, error)
	Create(ctx context.Context, req ClusterMutationRequest) (models.ClusterRecord, error)
	Import(ctx context.Context, req ClusterMutationRequest) (models.ClusterRecord, error)
	Delete(ctx context.Context, slug string) (models.ClusterRecord, error)
}

type ConfigService interface {
	GetSnapshot(ctx context.Context, slug string) (models.ClusterConfigSnapshot, error)
	SaveSnapshot(ctx context.Context, slug string, snapshot models.ClusterConfigSnapshot) error
}

type RuntimeService interface {
	RunAction(ctx context.Context, slug string, action string, actor string) (models.JobRecord, error)
}

type JobsService interface {
	List(ctx context.Context, limit int) ([]models.JobRecord, error)
}

type BackupService interface {
	List(ctx context.Context, slug string) ([]models.BackupRecord, error)
	ResolveArchivePath(ctx context.Context, slug string, name string) (string, error)
}

type ClusterMutationRequest struct {
	Mode        string `json:"mode"`
	Slug        string `json:"slug"`
	DisplayName string `json:"display_name"`
	ClusterName string `json:"cluster_name"`
	BaseDir     string `json:"base_dir"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type actionRequest struct {
	Action string `json:"action"`
}

func NewRouter(deps Dependencies) http.Handler {
	mux := http.NewServeMux()
	withCSRF := middleware.RequireCSRFFetchHeader

	mux.Handle("POST /api/login", withCSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		clientKey := loginClientKey(r)
		if deps.LoginLimiter != nil && !deps.LoginLimiter.Allow(clientKey) {
			recordLoginAudit(deps.Audit, req.Username, "login_rate_limited", clientKey)
			writeError(w, http.StatusTooManyRequests, "too many login attempts")
			return
		}

		ok, err := deps.Auth.Authenticate(r.Context(), req.Username, req.Password)
		if err != nil {
			writeMappedError(w, err)
			return
		}
		if !ok {
			if deps.LoginLimiter != nil {
				deps.LoginLimiter.RegisterFailure(clientKey)
			}
			recordLoginAudit(deps.Audit, req.Username, "login_failed", clientKey)
			writeError(w, http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized))
			return
		}
		if deps.LoginLimiter != nil {
			deps.LoginLimiter.Reset(clientKey)
		}

		sessionTTL := deps.SessionTTL
		if sessionTTL <= 0 {
			sessionTTL = 12 * time.Hour
		}
		issuedAt := time.Now().UTC()

		token, err := auth.IssueSessionToken(req.Username, issuedAt, sessionTTL, deps.SessionSecret)
		if err != nil {
			writeMappedError(w, err)
			return
		}
		expiresAt := issuedAt.Add(sessionTTL)

		http.SetCookie(w, &http.Cookie{
			Name:     SessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   deps.SessionCookieSecure,
			SameSite: http.SameSiteLaxMode,
			Expires:  expiresAt,
			MaxAge:   int(sessionTTL.Seconds()),
		})
		recordLoginAudit(deps.Audit, req.Username, "login_success", clientKey)
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})))

	mux.HandleFunc("GET /api/session", func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(SessionCookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized))
			return
		}

		session, err := auth.ParseSessionToken(cookie.Value, time.Now().UTC(), deps.SessionSecret)
		if err != nil {
			writeError(w, http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized))
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"authenticated": true,
			"username":      session.Username,
		})
	})

	protected := middleware.AuthRequired(deps.SessionSecret)

	mux.Handle("POST /api/logout", protected(withCSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recordLoginAudit(deps.Audit, sessionActor(r, deps.SessionSecret), "logout_success", loginClientKey(r))
		http.SetCookie(w, &http.Cookie{
			Name:     SessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   deps.SessionCookieSecure,
			MaxAge:   -1,
			SameSite: http.SameSiteLaxMode,
		})
		w.WriteHeader(http.StatusNoContent)
	}))))

	mux.Handle("GET /api/clusters", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clusters, err := deps.Clusters.List(r.Context())
		if err != nil {
			writeMappedError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, clusters)
	})))

	mux.Handle("POST /api/clusters", protected(withCSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req ClusterMutationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		var (
			record models.ClusterRecord
			err    error
		)
		switch req.Mode {
		case "create":
			record, err = deps.Clusters.Create(r.Context(), req)
		case "import":
			record, err = deps.Clusters.Import(r.Context(), req)
		default:
			writeError(w, http.StatusBadRequest, "invalid cluster mutation mode")
			return
		}
		if err != nil {
			writeMappedError(w, err)
			return
		}

		switch req.Mode {
		case "create":
			recordClusterAudit(deps.Audit, sessionActor(r, deps.SessionSecret), "cluster_create", record.ID, req.Slug)
		case "import":
			recordClusterAudit(deps.Audit, sessionActor(r, deps.SessionSecret), "cluster_import", record.ID, req.Slug)
		}

		writeJSON(w, http.StatusCreated, record)
	}))))

	mux.Handle("DELETE /api/clusters/{slug}", protected(withCSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		record, err := deps.Clusters.Delete(r.Context(), r.PathValue("slug"))
		if err != nil {
			writeMappedError(w, err)
			return
		}

		recordClusterAudit(deps.Audit, sessionActor(r, deps.SessionSecret), "cluster_delete", record.ID, record.Slug)
		w.WriteHeader(http.StatusNoContent)
	}))))

	mux.Handle("GET /api/clusters/{slug}/config", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		snapshot, err := deps.Config.GetSnapshot(r.Context(), r.PathValue("slug"))
		if err != nil {
			writeMappedError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, snapshot)
	})))

	mux.Handle("PUT /api/clusters/{slug}/config", protected(withCSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var snapshot models.ClusterConfigSnapshot
		if err := json.NewDecoder(r.Body).Decode(&snapshot); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if err := deps.Config.SaveSnapshot(r.Context(), r.PathValue("slug"), snapshot); err != nil {
			writeMappedError(w, err)
			return
		}

		recordClusterAudit(deps.Audit, sessionActor(r, deps.SessionSecret), "config_save", 0, r.PathValue("slug"))
		w.WriteHeader(http.StatusNoContent)
	}))))

	mux.Handle("GET /api/clusters/{slug}/backups", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if deps.Backups == nil {
			writeJSON(w, http.StatusOK, []models.BackupRecord{})
			return
		}

		backups, err := deps.Backups.List(r.Context(), r.PathValue("slug"))
		if err != nil {
			writeMappedError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, backups)
	})))

	mux.Handle("GET /api/clusters/{slug}/backups/{name}", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if deps.Backups == nil {
			writeError(w, http.StatusNotFound, "backup not found")
			return
		}

		archivePath, err := deps.Backups.ResolveArchivePath(r.Context(), r.PathValue("slug"), r.PathValue("name"))
		if err != nil {
			writeMappedError(w, err)
			return
		}

		w.Header().Set("Content-Disposition", `attachment; filename="`+r.PathValue("name")+`"`)
		http.ServeFile(w, r, archivePath)
	})))

	mux.Handle("POST /api/clusters/{slug}/actions", protected(withCSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req actionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		actor := sessionActor(r, deps.SessionSecret)
		job, err := deps.Runtime.RunAction(r.Context(), r.PathValue("slug"), req.Action, actor)
		if err != nil {
			writeMappedError(w, err)
			return
		}

		recordClusterAudit(deps.Audit, actor, "cluster_action_"+req.Action, job.ClusterID, r.PathValue("slug"))
		writeJSON(w, http.StatusAccepted, job)
	}))))

	mux.Handle("GET /api/jobs", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jobs, err := deps.Jobs.List(r.Context(), 20)
		if err != nil {
			writeMappedError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, jobs)
	})))

	mux.Handle("GET /api/audit", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if deps.Audit == nil {
			writeJSON(w, http.StatusOK, []models.AuditRecord{})
			return
		}

		records, err := deps.Audit.List(auditLimit(r.URL.Query().Get("limit")))
		if err != nil {
			writeMappedError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, filterAuditRecords(records, r.URL.Query().Get("slug")))
	})))

	return mux
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{
		"error": message,
	})
}

func writeMappedError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeError(w, http.StatusNotFound, "cluster not found")
	case apierror.IsKind(err, apierror.KindNotFound):
		writeError(w, http.StatusNotFound, apierror.Message(err))
	case apierror.IsKind(err, apierror.KindInvalid):
		writeError(w, http.StatusBadRequest, apierror.Message(err))
	default:
		writeError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
	}
}

func loginClientKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}

	return r.RemoteAddr
}

func recordLoginAudit(auditService AuditService, username string, action string, clientKey string) {
	if auditService == nil {
		return
	}

	actor := username
	if actor == "" {
		actor = "unknown"
	}

	_, _ = auditService.Record(actor, action, "auth", 0, "client="+clientKey)
}

func recordClusterAudit(auditService AuditService, actor string, action string, targetID int64, slug string) {
	if auditService == nil {
		return
	}

	if actor == "" {
		actor = "unknown"
	}

	_, _ = auditService.Record(actor, action, "cluster", targetID, "slug="+slug)
}

func sessionActor(r *http.Request, secret []byte) string {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil || cookie.Value == "" {
		return "unknown"
	}

	session, err := auth.ParseSessionToken(cookie.Value, time.Now().UTC(), secret)
	if err != nil || session.Username == "" {
		return "unknown"
	}

	return session.Username
}

func filterAuditRecords(records []models.AuditRecord, slug string) []models.AuditRecord {
	if slug == "" {
		return records
	}

	filtered := make([]models.AuditRecord, 0, len(records))
	for _, record := range records {
		if record.TargetType == "auth" || record.Summary == "slug="+slug {
			filtered = append(filtered, record)
		}
	}

	return filtered
}

func auditLimit(raw string) int {
	if raw == "" {
		return 50
	}

	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return 50
	}
	if parsed > 100 {
		return 100
	}

	return parsed
}

package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/apierror"
	"github.com/gwf/dst-docker/control-plane/api/internal/auth"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/middleware"
	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

const SessionCookieName = middleware.SessionCookieName

type Dependencies struct {
	SessionSecret []byte
	Auth          AuthService
	LoginLimiter  LoginLimiter
	Audit         AuditService
	Clusters      ClusterService
	Config        ConfigService
	Runtime       RuntimeService
	Jobs          JobsService
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
}

type ClusterService interface {
	List(ctx context.Context) ([]models.ClusterRecord, error)
	Create(ctx context.Context, req ClusterMutationRequest) (models.ClusterRecord, error)
	Import(ctx context.Context, req ClusterMutationRequest) (models.ClusterRecord, error)
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

	mux.HandleFunc("POST /api/login", func(w http.ResponseWriter, r *http.Request) {
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

		token, err := auth.IssueSessionToken(req.Username, time.Now().UTC(), 12*time.Hour, deps.SessionSecret)
		if err != nil {
			writeMappedError(w, err)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     SessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})
		recordLoginAudit(deps.Audit, req.Username, "login_success", clientKey)
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

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

	mux.Handle("POST /api/logout", protected(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     SessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			MaxAge:   -1,
			SameSite: http.SameSiteLaxMode,
		})
		w.WriteHeader(http.StatusNoContent)
	})))

	mux.Handle("GET /api/clusters", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clusters, err := deps.Clusters.List(r.Context())
		if err != nil {
			writeMappedError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, clusters)
	})))

	mux.Handle("POST /api/clusters", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

		writeJSON(w, http.StatusCreated, record)
	})))

	mux.Handle("GET /api/clusters/{slug}/config", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		snapshot, err := deps.Config.GetSnapshot(r.Context(), r.PathValue("slug"))
		if err != nil {
			writeMappedError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, snapshot)
	})))

	mux.Handle("PUT /api/clusters/{slug}/config", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var snapshot models.ClusterConfigSnapshot
		if err := json.NewDecoder(r.Body).Decode(&snapshot); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if err := deps.Config.SaveSnapshot(r.Context(), r.PathValue("slug"), snapshot); err != nil {
			writeMappedError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})))

	mux.Handle("POST /api/clusters/{slug}/actions", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req actionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		job, err := deps.Runtime.RunAction(r.Context(), r.PathValue("slug"), req.Action, "admin")
		if err != nil {
			writeMappedError(w, err)
			return
		}

		writeJSON(w, http.StatusAccepted, job)
	})))

	mux.Handle("GET /api/jobs", protected(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jobs, err := deps.Jobs.List(r.Context(), 20)
		if err != nil {
			writeMappedError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, jobs)
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

package middleware

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/auth"
)

const SessionCookieName = "dst_control_plane_session"
const CSRFHeaderName = "X-DST-Control-Plane-CSRF"

func AuthRequired(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil || cookie.Value == "" {
				writeUnauthorized(w)
				return
			}

			if _, err := auth.ParseSessionToken(cookie.Value, time.Now().UTC(), secret); err != nil {
				writeUnauthorized(w)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func RequireCSRFFetchHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get(CSRFHeaderName) == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "missing csrf header",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": http.StatusText(http.StatusUnauthorized),
	})
}

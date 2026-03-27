package middleware

import (
	"net/http"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/auth"
)

const SessionCookieName = "dst_control_plane_session"

func AuthRequired(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil || cookie.Value == "" {
				http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
				return
			}

			if _, err := auth.ParseSessionToken(cookie.Value, time.Now().UTC(), secret); err != nil {
				http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

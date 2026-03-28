package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/auth"
)

func TestAuthRequiredRejectsUnauthenticatedWriteRequest(t *testing.T) {
	handler := AuthRequired([]byte("0123456789abcdef0123456789abcdef"))(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/clusters", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated write request, got %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected json content type for unauthenticated response, got %q", got)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"error":"Unauthorized"`)) {
		t.Fatalf("expected json unauthorized body, got %q", rec.Body.String())
	}
}

func TestAuthRequiredAllowsAuthenticatedWriteRequest(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	now := time.Date(2026, 3, 28, 12, 0, 0, 0, time.UTC)
	token, err := auth.IssueSessionToken("admin", now, 2*time.Hour, secret)
	if err != nil {
		t.Fatalf("expected session token, got error: %v", err)
	}

	handler := AuthRequired(secret)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/clusters", nil)
	req.AddCookie(&http.Cookie{
		Name:  SessionCookieName,
		Value: token,
	})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected authenticated request to pass through, got %d", rec.Code)
	}
}

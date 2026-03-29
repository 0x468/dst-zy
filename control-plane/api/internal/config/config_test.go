package config

import (
	"os"
	"testing"
	"time"
)

func TestLoadConfigDefaults(t *testing.T) {
	cfg := Load()
	if cfg.ListenAddr == "" {
		t.Fatal("expected default listen addr")
	}
	if cfg.DataRoot == "" {
		t.Fatal("expected default data root")
	}
	if cfg.SessionSecret == "" {
		t.Fatal("expected default session secret")
	}
	if cfg.AdminUsername == "" {
		t.Fatal("expected default admin username")
	}
	if cfg.ExecutionMode == "" {
		t.Fatal("expected default execution mode")
	}
	if cfg.WebStaticDir == "" {
		t.Fatal("expected default web static dir")
	}
	if cfg.LoginRateLimitMaxAttempts <= 0 {
		t.Fatal("expected positive default login rate limit attempts")
	}
	if cfg.LoginRateLimitWindow <= 0 {
		t.Fatal("expected positive default login rate limit window")
	}
	if cfg.SessionTTL <= 0 {
		t.Fatal("expected positive default session ttl")
	}
	if cfg.SessionCookieSecure {
		t.Fatal("expected default session cookie secure to be false")
	}
}

func TestLoadConfigSessionCookieOverrides(t *testing.T) {
	t.Setenv("DST_CONTROL_PLANE_SESSION_TTL", "2h30m")
	t.Setenv("DST_CONTROL_PLANE_SESSION_COOKIE_SECURE", "true")

	cfg := Load()

	if cfg.SessionTTL != 150*time.Minute {
		t.Fatalf("expected session ttl override to be 150m, got %s", cfg.SessionTTL)
	}
	if !cfg.SessionCookieSecure {
		t.Fatal("expected session cookie secure override to be true")
	}
}

func TestLoadConfigInvalidSessionCookieOverridesFallBackToDefaults(t *testing.T) {
	os.Setenv("DST_CONTROL_PLANE_SESSION_TTL", "not-a-duration")
	os.Setenv("DST_CONTROL_PLANE_SESSION_COOKIE_SECURE", "not-a-bool")
	t.Cleanup(func() {
		os.Unsetenv("DST_CONTROL_PLANE_SESSION_TTL")
		os.Unsetenv("DST_CONTROL_PLANE_SESSION_COOKIE_SECURE")
	})

	cfg := Load()

	if cfg.SessionTTL != 12*time.Hour {
		t.Fatalf("expected invalid session ttl to fall back to 12h, got %s", cfg.SessionTTL)
	}
	if cfg.SessionCookieSecure {
		t.Fatal("expected invalid session cookie secure to fall back to false")
	}
}

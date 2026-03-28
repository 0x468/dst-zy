package config

import "testing"

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
}

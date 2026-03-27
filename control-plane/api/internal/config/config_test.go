package config

import "testing"

func TestLoadConfigDefaults(t *testing.T) {
	cfg := Load()
	if cfg.ListenAddr == "" {
		t.Fatal("expected default listen addr")
	}
}

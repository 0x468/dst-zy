package files

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseAndWriteServerINI(t *testing.T) {
	path := filepath.Join(t.TempDir(), "server.ini")
	contents := `[NETWORK]
server_port = 11000

[SHARD]
is_master = true
name = Master
id = 1

[ACCOUNT]
encode_user_path = true

[STEAM]
master_server_port = 27018
authentication_port = 8768
`

	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("expected server.ini to be written, got error: %v", err)
	}

	cfg, err := ParseServerINI(path)
	if err != nil {
		t.Fatalf("expected server.ini to parse, got error: %v", err)
	}

	if cfg.Network.ServerPort != 11000 {
		t.Fatalf("expected server port to parse, got %d", cfg.Network.ServerPort)
	}

	if cfg.Steam.MasterServerPort != 27018 {
		t.Fatalf("expected master_server_port to parse, got %d", cfg.Steam.MasterServerPort)
	}

	cfg.Steam.MasterServerPort = 28018
	if err := WriteServerINI(path, cfg); err != nil {
		t.Fatalf("expected server.ini to be written back, got error: %v", err)
	}

	updated, err := ParseServerINI(path)
	if err != nil {
		t.Fatalf("expected updated server.ini to parse, got error: %v", err)
	}

	if updated.Steam.MasterServerPort != 28018 {
		t.Fatalf("expected updated master_server_port, got %d", updated.Steam.MasterServerPort)
	}
}

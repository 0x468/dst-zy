package files

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestGuardClusterDirBuildsPathInsideManagedRoot(t *testing.T) {
	root := filepath.Join(t.TempDir(), "dst-control-plane")
	guard, err := NewGuard(root)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	clusterDir, err := guard.ClusterDir("cluster-a")
	if err != nil {
		t.Fatalf("expected cluster dir to resolve, got error: %v", err)
	}

	if !strings.HasPrefix(clusterDir, filepath.Join(root, "clusters")) {
		t.Fatalf("expected cluster dir to stay inside managed root, got %q", clusterDir)
	}
}

func TestGuardRejectsPathTraversal(t *testing.T) {
	root := filepath.Join(t.TempDir(), "dst-control-plane")
	guard, err := NewGuard(root)
	if err != nil {
		t.Fatalf("expected guard to initialize, got error: %v", err)
	}

	if _, err := guard.ClusterDir("../escape"); err == nil {
		t.Fatal("expected traversal slug to be rejected")
	}

	if err := guard.EnsureWithinRoot(filepath.Join(root, "..", "escape")); err == nil {
		t.Fatal("expected path outside managed root to be rejected")
	}
}

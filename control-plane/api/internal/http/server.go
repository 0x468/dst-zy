package httpapi

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
)

func NewServerHandler(deps handlers.Dependencies, staticDir string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.Handle("/api/", NewRouter(deps))

	if strings.TrimSpace(staticDir) != "" {
		mux.Handle("/", newSPAHandler(staticDir))
	}

	return mux
}

func newSPAHandler(staticDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(staticDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		cleanedPath := path.Clean("/" + r.URL.Path)
		if cleanedPath == "/" {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}

		relativePath := strings.TrimPrefix(cleanedPath, "/")
		if strings.HasPrefix(relativePath, "..") {
			http.NotFound(w, r)
			return
		}

		targetPath := filepath.Join(staticDir, filepath.FromSlash(relativePath))
		if info, err := os.Stat(targetPath); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		if path.Ext(relativePath) == "" {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}

		http.NotFound(w, r)
	})
}

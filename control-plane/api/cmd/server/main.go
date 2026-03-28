package main

import (
	"log"
	"net/http"
	"path/filepath"

	"github.com/gwf/dst-docker/control-plane/api/internal/cluster"
	"github.com/gwf/dst-docker/control-plane/api/internal/config"
	"github.com/gwf/dst-docker/control-plane/api/internal/db"
	"github.com/gwf/dst-docker/control-plane/api/internal/files"
	httpapi "github.com/gwf/dst-docker/control-plane/api/internal/http"
	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
	"github.com/gwf/dst-docker/control-plane/api/internal/jobs"
	"github.com/gwf/dst-docker/control-plane/api/internal/service"
)

func main() {
	cfg := config.Load()
	database, err := db.Open(filepath.Join(cfg.DataRoot, "app.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()

	guard, err := files.NewGuard(cfg.DataRoot)
	if err != nil {
		log.Fatal(err)
	}

	clusterRepo := cluster.NewRepository(database)
	jobsRepo := jobs.NewService(database)

	deps := handlers.Dependencies{
		SessionSecret: []byte(cfg.SessionSecret),
		Auth: service.StaticAuthService{
			Username: cfg.AdminUsername,
			Password: cfg.AdminPassword,
		},
		Clusters: service.NewClusterService(clusterRepo, guard, "dst-docker:v1"),
		Config:   service.NewConfigService(clusterRepo),
		Runtime:  service.NewRuntimeService(clusterRepo, jobsRepo, cfg.ExecutionMode),
		Jobs:     service.NewJobsService(jobsRepo),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.Handle("/api/", httpapi.NewRouter(deps))

	log.Printf("dst control plane api listening on %s", cfg.ListenAddr)
	if err := http.ListenAndServe(cfg.ListenAddr, mux); err != nil {
		log.Fatal(err)
	}
}

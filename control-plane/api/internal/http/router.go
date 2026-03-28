package httpapi

import (
	"net/http"

	"github.com/gwf/dst-docker/control-plane/api/internal/http/handlers"
)

func NewRouter(deps handlers.Dependencies) http.Handler {
	return handlers.NewRouter(deps)
}

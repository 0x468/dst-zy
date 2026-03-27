package files

import (
	"errors"
	"path/filepath"
	"strings"
)

var ErrPathOutsideRoot = errors.New("path outside managed root")
var ErrInvalidSlug = errors.New("invalid cluster slug")

type Guard struct {
	root string
}

func NewGuard(root string) (Guard, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return Guard{}, err
	}

	return Guard{root: filepath.Clean(absRoot)}, nil
}

func (g Guard) ClusterDir(slug string) (string, error) {
	if slug == "" || slug == "." || slug == ".." || strings.Contains(slug, "/") || strings.Contains(slug, `\`) {
		return "", ErrInvalidSlug
	}

	clusterDir := filepath.Join(g.root, "clusters", slug)
	if err := g.EnsureWithinRoot(clusterDir); err != nil {
		return "", err
	}

	return clusterDir, nil
}

func (g Guard) EnsureWithinRoot(candidate string) error {
	absCandidate, err := filepath.Abs(candidate)
	if err != nil {
		return err
	}

	rel, err := filepath.Rel(g.root, absCandidate)
	if err != nil {
		return err
	}

	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return ErrPathOutsideRoot
	}

	return nil
}

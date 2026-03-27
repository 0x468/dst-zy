package files

import "path/filepath"

type ManagedLayout struct {
	RootDir    string
	ComposeDir string
	RuntimeDir string
	MetaDir    string
}

func BuildManagedLayout(clusterDir string) ManagedLayout {
	return ManagedLayout{
		RootDir:    clusterDir,
		ComposeDir: filepath.Join(clusterDir, "compose"),
		RuntimeDir: filepath.Join(clusterDir, "runtime"),
		MetaDir:    filepath.Join(clusterDir, "meta"),
	}
}

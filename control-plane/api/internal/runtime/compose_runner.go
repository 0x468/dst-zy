package runtime

import (
	"os"
	"os/exec"
)

type ComposeRunner struct {
	projectDir  string
	composeFile string
	envFile     string
}

func NewComposeRunner(projectDir string, composeFile string, envFile string) ComposeRunner {
	return ComposeRunner{
		projectDir:  projectDir,
		composeFile: composeFile,
		envFile:     envFile,
	}
}

func (r ComposeRunner) StartCommand() *exec.Cmd {
	return r.composeCommand(nil, "up", "-d")
}

func (r ComposeRunner) StopCommand() *exec.Cmd {
	return r.composeCommand(nil, "stop")
}

func (r ComposeRunner) RestartCommand() *exec.Cmd {
	return r.composeCommand(nil, "restart")
}

func (r ComposeRunner) UpdateCommand() *exec.Cmd {
	return r.composeCommand([]string{"DST_UPDATE_MODE=update"}, "up", "-d", "--force-recreate")
}

func (r ComposeRunner) ValidateCommand() *exec.Cmd {
	return r.composeCommand([]string{"DST_UPDATE_MODE=validate"}, "up", "-d", "--force-recreate")
}

func (r ComposeRunner) composeCommand(extraEnv []string, args ...string) *exec.Cmd {
	baseArgs := []string{"compose", "-f", r.composeFile, "--env-file", r.envFile}
	baseArgs = append(baseArgs, args...)

	cmd := exec.Command("docker", baseArgs...)
	cmd.Dir = r.projectDir
	cmd.Env = append(os.Environ(), extraEnv...)
	return cmd
}

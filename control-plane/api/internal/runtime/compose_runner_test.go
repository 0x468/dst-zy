package runtime

import "testing"

func TestComposeRunnerBuildsLifecycleCommands(t *testing.T) {
	runner := NewComposeRunner("/srv/control-plane/clusters/cluster-a/compose", "/srv/control-plane/clusters/cluster-a/compose/docker-compose.yml", "/srv/control-plane/clusters/cluster-a/compose/.env")

	start := runner.StartCommand()
	if got, want := start.Args, []string{"docker", "compose", "-f", "/srv/control-plane/clusters/cluster-a/compose/docker-compose.yml", "--env-file", "/srv/control-plane/clusters/cluster-a/compose/.env", "up", "-d"}; !sameStrings(got, want) {
		t.Fatalf("expected start command %v, got %v", want, got)
	}

	stop := runner.StopCommand()
	if got, want := stop.Args, []string{"docker", "compose", "-f", "/srv/control-plane/clusters/cluster-a/compose/docker-compose.yml", "--env-file", "/srv/control-plane/clusters/cluster-a/compose/.env", "stop"}; !sameStrings(got, want) {
		t.Fatalf("expected stop command %v, got %v", want, got)
	}

	restart := runner.RestartCommand()
	if got, want := restart.Args, []string{"docker", "compose", "-f", "/srv/control-plane/clusters/cluster-a/compose/docker-compose.yml", "--env-file", "/srv/control-plane/clusters/cluster-a/compose/.env", "restart"}; !sameStrings(got, want) {
		t.Fatalf("expected restart command %v, got %v", want, got)
	}
}

func TestComposeRunnerBuildsUpdateAndValidateCommands(t *testing.T) {
	runner := NewComposeRunner("/srv/control-plane/clusters/cluster-a/compose", "/srv/control-plane/clusters/cluster-a/compose/docker-compose.yml", "/srv/control-plane/clusters/cluster-a/compose/.env")

	update := runner.UpdateCommand()
	if got, want := update.Args, []string{"docker", "compose", "-f", "/srv/control-plane/clusters/cluster-a/compose/docker-compose.yml", "--env-file", "/srv/control-plane/clusters/cluster-a/compose/.env", "up", "-d", "--force-recreate"}; !sameStrings(got, want) {
		t.Fatalf("expected update command %v, got %v", want, got)
	}

	if !envContains(update.Env, "DST_UPDATE_MODE=update") {
		t.Fatal("expected update command env to override DST_UPDATE_MODE=update")
	}

	validate := runner.ValidateCommand()
	if !envContains(validate.Env, "DST_UPDATE_MODE=validate") {
		t.Fatal("expected validate command env to override DST_UPDATE_MODE=validate")
	}
}

func sameStrings(left []string, right []string) bool {
	if len(left) != len(right) {
		return false
	}

	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}

	return true
}

func envContains(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}

	return false
}

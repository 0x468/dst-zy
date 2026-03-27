package runtime

import "testing"

func TestParseComposePSJSON(t *testing.T) {
	raw := []byte(`[
  {"Name":"cluster-a-dst-1","Service":"dst","State":"running"},
  {"Name":"cluster-b-dst-1","Service":"dst","State":"exited"}
]`)

	statuses, err := ParseComposePSJSON(raw)
	if err != nil {
		t.Fatalf("expected compose ps json to parse, got error: %v", err)
	}

	if len(statuses) != 2 {
		t.Fatalf("expected 2 statuses, got %d", len(statuses))
	}

	if statuses[0].State != "running" {
		t.Fatalf("expected first status to be running, got %q", statuses[0].State)
	}
}

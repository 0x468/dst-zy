package auth

import (
	"testing"
	"time"
)

func TestIssueAndParseSessionToken(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	now := time.Date(2026, 3, 28, 12, 0, 0, 0, time.UTC)

	token, err := IssueSessionToken("admin", now, 2*time.Hour, secret)
	if err != nil {
		t.Fatalf("expected session token, got error: %v", err)
	}

	session, err := ParseSessionToken(token, now.Add(time.Hour), secret)
	if err != nil {
		t.Fatalf("expected valid session token, got error: %v", err)
	}

	if session.Username != "admin" {
		t.Fatalf("expected username admin, got %q", session.Username)
	}

	if session.ExpiresAt.Before(now.Add(2 * time.Hour)) {
		t.Fatal("expected expiration to be at least now + ttl")
	}
}

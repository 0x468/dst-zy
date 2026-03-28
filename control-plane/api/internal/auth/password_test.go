package auth

import "testing"

func TestHashPasswordAndVerify(t *testing.T) {
	hash, err := HashPassword("correct-horse-battery-staple")
	if err != nil {
		t.Fatalf("expected password hash, got error: %v", err)
	}

	if hash == "" {
		t.Fatal("expected non-empty password hash")
	}

	if !VerifyPassword(hash, "correct-horse-battery-staple") {
		t.Fatal("expected password verification to succeed")
	}

	if VerifyPassword(hash, "wrong-password") {
		t.Fatal("expected password verification to fail for wrong password")
	}
}

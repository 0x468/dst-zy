package auth

import (
	"testing"
	"time"
)

func TestLoginLimiterBlocksAfterMaxFailuresWithinWindow(t *testing.T) {
	now := time.Date(2026, 3, 28, 12, 0, 0, 0, time.UTC)
	limiter := NewLoginLimiter(2, time.Minute, func() time.Time {
		return now
	})

	if !limiter.Allow("127.0.0.1") {
		t.Fatal("expected first attempt to be allowed")
	}

	limiter.RegisterFailure("127.0.0.1")
	limiter.RegisterFailure("127.0.0.1")

	if limiter.Allow("127.0.0.1") {
		t.Fatal("expected limiter to block after max failures")
	}
}

func TestLoginLimiterResetsOnSuccess(t *testing.T) {
	now := time.Date(2026, 3, 28, 12, 0, 0, 0, time.UTC)
	limiter := NewLoginLimiter(2, time.Minute, func() time.Time {
		return now
	})

	limiter.RegisterFailure("127.0.0.1")
	limiter.RegisterFailure("127.0.0.1")
	limiter.Reset("127.0.0.1")

	if !limiter.Allow("127.0.0.1") {
		t.Fatal("expected limiter to allow after reset")
	}
}

func TestLoginLimiterExpiresOldFailures(t *testing.T) {
	now := time.Date(2026, 3, 28, 12, 0, 0, 0, time.UTC)
	limiter := NewLoginLimiter(2, time.Minute, func() time.Time {
		return now
	})

	limiter.RegisterFailure("127.0.0.1")
	limiter.RegisterFailure("127.0.0.1")

	now = now.Add(2 * time.Minute)

	if !limiter.Allow("127.0.0.1") {
		t.Fatal("expected limiter to allow after failure window expires")
	}
}

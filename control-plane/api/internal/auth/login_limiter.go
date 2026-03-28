package auth

import (
	"sync"
	"time"
)

type LoginLimiter struct {
	mu          sync.Mutex
	maxAttempts int
	window      time.Duration
	now         func() time.Time
	failures    map[string][]time.Time
}

func NewLoginLimiter(maxAttempts int, window time.Duration, now func() time.Time) *LoginLimiter {
	if now == nil {
		now = func() time.Time {
			return time.Now().UTC()
		}
	}

	return &LoginLimiter{
		maxAttempts: maxAttempts,
		window:      window,
		now:         now,
		failures:    map[string][]time.Time{},
	}
}

func (l *LoginLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.maxAttempts <= 0 || key == "" {
		return true
	}

	l.trim(key)
	return len(l.failures[key]) < l.maxAttempts
}

func (l *LoginLimiter) RegisterFailure(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.maxAttempts <= 0 || key == "" {
		return
	}

	l.trim(key)
	l.failures[key] = append(l.failures[key], l.now())
}

func (l *LoginLimiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if key == "" {
		return
	}

	delete(l.failures, key)
}

func (l *LoginLimiter) trim(key string) {
	threshold := l.now().Add(-l.window)
	failures := l.failures[key]
	kept := failures[:0]
	for _, attempt := range failures {
		if attempt.After(threshold) {
			kept = append(kept, attempt)
		}
	}
	if len(kept) == 0 {
		delete(l.failures, key)
		return
	}
	l.failures[key] = kept
}

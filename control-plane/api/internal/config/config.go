package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ListenAddr    string
	DataRoot      string
	SessionSecret string
	AdminUsername string
	AdminPassword string
	ExecutionMode string
	WebStaticDir  string
	LoginRateLimitMaxAttempts int
	LoginRateLimitWindow time.Duration
}

func Load() Config {
	return Config{
		ListenAddr:    envOrDefault("DST_CONTROL_PLANE_LISTEN_ADDR", ":8080"),
		DataRoot:      envOrDefault("DST_CONTROL_PLANE_DATA_ROOT", "/opt/dst-control-plane/data"),
		SessionSecret: envOrDefault("DST_CONTROL_PLANE_SESSION_SECRET", "0123456789abcdef0123456789abcdef"),
		AdminUsername: envOrDefault("DST_CONTROL_PLANE_ADMIN_USERNAME", "admin"),
		AdminPassword: envOrDefault("DST_CONTROL_PLANE_ADMIN_PASSWORD", "admin"),
		ExecutionMode: envOrDefault("DST_CONTROL_PLANE_EXECUTION_MODE", "compose"),
		WebStaticDir:  envOrDefault("DST_CONTROL_PLANE_WEB_STATIC_DIR", "/opt/dst-control-plane/web"),
		LoginRateLimitMaxAttempts: envOrDefaultInt("DST_CONTROL_PLANE_LOGIN_RATE_LIMIT_MAX_ATTEMPTS", 5),
		LoginRateLimitWindow: envOrDefaultDuration("DST_CONTROL_PLANE_LOGIN_RATE_LIMIT_WINDOW", 5*time.Minute),
	}
}

func envOrDefault(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envOrDefaultInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envOrDefaultDuration(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

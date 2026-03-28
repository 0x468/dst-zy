package config

import "os"

type Config struct {
	ListenAddr    string
	DataRoot      string
	SessionSecret string
	AdminUsername string
	AdminPassword string
	ExecutionMode string
}

func Load() Config {
	return Config{
		ListenAddr:    envOrDefault("DST_CONTROL_PLANE_LISTEN_ADDR", ":8080"),
		DataRoot:      envOrDefault("DST_CONTROL_PLANE_DATA_ROOT", "/opt/dst-control-plane/data"),
		SessionSecret: envOrDefault("DST_CONTROL_PLANE_SESSION_SECRET", "0123456789abcdef0123456789abcdef"),
		AdminUsername: envOrDefault("DST_CONTROL_PLANE_ADMIN_USERNAME", "admin"),
		AdminPassword: envOrDefault("DST_CONTROL_PLANE_ADMIN_PASSWORD", "admin"),
		ExecutionMode: envOrDefault("DST_CONTROL_PLANE_EXECUTION_MODE", "compose"),
	}
}

func envOrDefault(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

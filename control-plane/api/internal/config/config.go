package config

import "os"

type Config struct {
	ListenAddr string
	DataRoot   string
}

func Load() Config {
	return Config{
		ListenAddr: envOrDefault("DST_CONTROL_PLANE_LISTEN_ADDR", ":8080"),
		DataRoot:   envOrDefault("DST_CONTROL_PLANE_DATA_ROOT", "/opt/dst-control-plane/data"),
	}
}

func envOrDefault(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

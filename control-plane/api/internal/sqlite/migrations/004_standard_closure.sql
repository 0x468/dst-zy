CREATE TABLE IF NOT EXISTS cluster_runtime_metadata (
  cluster_id INTEGER PRIMARY KEY REFERENCES cluster_records(id) ON DELETE CASCADE,
  update_mode TEXT NOT NULL DEFAULT 'install-only',
  server_mods_update_mode TEXT NOT NULL DEFAULT 'runtime',
  time_zone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  master_host_port INTEGER NOT NULL DEFAULT 11000,
  caves_host_port INTEGER NOT NULL DEFAULT 11001,
  master_steam_host_port INTEGER NOT NULL DEFAULT 27018,
  caves_steam_host_port INTEGER NOT NULL DEFAULT 27019
);

INSERT OR IGNORE INTO cluster_runtime_metadata (cluster_id)
SELECT id
FROM cluster_records;

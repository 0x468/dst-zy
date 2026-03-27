CREATE TABLE IF NOT EXISTS cluster_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  cluster_name TEXT NOT NULL,
  base_dir TEXT NOT NULL,
  compose_file TEXT NOT NULL DEFAULT '',
  env_file TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'stopped',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

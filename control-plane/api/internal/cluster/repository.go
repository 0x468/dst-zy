package cluster

import (
	"database/sql"
	"time"

	"github.com/gwf/dst-docker/control-plane/api/internal/models"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(record models.ClusterRecord) (models.ClusterRecord, error) {
	now := time.Now().UTC()
	record = applyStandardClosureDefaults(record)

	tx, err := r.db.Begin()
	if err != nil {
		return models.ClusterRecord{}, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO cluster_records (
			slug,
			display_name,
			note,
			cluster_name,
			base_dir,
			compose_file,
			env_file,
			status,
			created_at,
			updated_at
		) VALUES (
			?, ?, ?, ?, ?, ?, ?, ?, ?, ?
		)`,
		record.Slug,
		record.DisplayName,
		record.Note,
		record.ClusterName,
		record.BaseDir,
		record.ComposeFile,
		record.EnvFile,
		record.Status,
		now.Format(time.RFC3339Nano),
		now.Format(time.RFC3339Nano),
	)
	if err != nil {
		return models.ClusterRecord{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return models.ClusterRecord{}, err
	}

	if _, err := tx.Exec(
		`INSERT INTO cluster_runtime_metadata (
			cluster_id,
			update_mode,
			server_mods_update_mode,
			time_zone,
			master_host_port,
			caves_host_port,
			master_steam_host_port,
			caves_steam_host_port
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id,
		record.UpdateMode,
		record.ServerModsUpdateMode,
		record.TimeZone,
		record.MasterHostPort,
		record.CavesHostPort,
		record.MasterSteamHostPort,
		record.CavesSteamHostPort,
	); err != nil {
		return models.ClusterRecord{}, err
	}

	if err := tx.Commit(); err != nil {
		return models.ClusterRecord{}, err
	}

	record.ID = id
	record.CreatedAt = now
	record.UpdatedAt = now
	return record, nil
}

func (r *Repository) List() ([]models.ClusterRecord, error) {
	rows, err := r.db.Query(
		`SELECT
			id, slug, display_name, note, cluster_name, base_dir, compose_file, env_file, status,
			COALESCE(m.update_mode, ?),
			COALESCE(m.server_mods_update_mode, ?),
			COALESCE(m.time_zone, ?),
			COALESCE(m.master_host_port, ?),
			COALESCE(m.caves_host_port, ?),
			COALESCE(m.master_steam_host_port, ?),
			COALESCE(m.caves_steam_host_port, ?),
			created_at, updated_at
		 FROM cluster_records c
		 LEFT JOIN cluster_runtime_metadata m ON m.cluster_id = c.id
		 ORDER BY id ASC`,
		models.StandardClosureDefaultUpdateMode,
		models.StandardClosureDefaultServerModsUpdateMode,
		models.StandardClosureDefaultTimeZone,
		models.StandardClosureDefaultMasterHostPort,
		models.StandardClosureDefaultCavesHostPort,
		models.StandardClosureDefaultMasterSteamHostPort,
		models.StandardClosureDefaultCavesSteamHostPort,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []models.ClusterRecord{}
	for rows.Next() {
		record, err := scanClusterRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	return records, rows.Err()
}

func (r *Repository) GetBySlug(slug string) (models.ClusterRecord, error) {
	row := r.db.QueryRow(
		`SELECT
			id, slug, display_name, note, cluster_name, base_dir, compose_file, env_file, status,
			COALESCE(m.update_mode, ?),
			COALESCE(m.server_mods_update_mode, ?),
			COALESCE(m.time_zone, ?),
			COALESCE(m.master_host_port, ?),
			COALESCE(m.caves_host_port, ?),
			COALESCE(m.master_steam_host_port, ?),
			COALESCE(m.caves_steam_host_port, ?),
			created_at, updated_at
		 FROM cluster_records c
		 LEFT JOIN cluster_runtime_metadata m ON m.cluster_id = c.id
		 WHERE slug = ?`,
		models.StandardClosureDefaultUpdateMode,
		models.StandardClosureDefaultServerModsUpdateMode,
		models.StandardClosureDefaultTimeZone,
		models.StandardClosureDefaultMasterHostPort,
		models.StandardClosureDefaultCavesHostPort,
		models.StandardClosureDefaultMasterSteamHostPort,
		models.StandardClosureDefaultCavesSteamHostPort,
		slug,
	)

	return scanClusterRecord(row)
}

func (r *Repository) UpdateStatus(id int64, status string) error {
	_, err := r.db.Exec(
		`UPDATE cluster_records
		 SET status = ?, updated_at = ?
		 WHERE id = ?`,
		status,
		time.Now().UTC().Format(time.RFC3339Nano),
		id,
	)

	return err
}

func (r *Repository) UpdateRuntimeMetadata(record models.ClusterRecord) error {
	record = applyStandardClosureDefaults(record)

	_, err := r.db.Exec(
		`UPDATE cluster_runtime_metadata
		 SET update_mode = ?,
		     server_mods_update_mode = ?,
		     time_zone = ?,
		     master_host_port = ?,
		     caves_host_port = ?,
		     master_steam_host_port = ?,
		     caves_steam_host_port = ?
		 WHERE cluster_id = ?`,
		record.UpdateMode,
		record.ServerModsUpdateMode,
		record.TimeZone,
		record.MasterHostPort,
		record.CavesHostPort,
		record.MasterSteamHostPort,
		record.CavesSteamHostPort,
		record.ID,
	)

	return err
}

func (r *Repository) Delete(id int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM cluster_runtime_metadata WHERE cluster_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM cluster_records WHERE id = ?`, id); err != nil {
		return err
	}

	return tx.Commit()
}

type clusterScanner interface {
	Scan(dest ...any) error
}

func applyStandardClosureDefaults(record models.ClusterRecord) models.ClusterRecord {
	if record.UpdateMode == "" {
		record.UpdateMode = models.StandardClosureDefaultUpdateMode
	}
	if record.ServerModsUpdateMode == "" {
		record.ServerModsUpdateMode = models.StandardClosureDefaultServerModsUpdateMode
	}
	if record.TimeZone == "" {
		record.TimeZone = models.StandardClosureDefaultTimeZone
	}
	if record.MasterHostPort == 0 {
		record.MasterHostPort = models.StandardClosureDefaultMasterHostPort
	}
	if record.CavesHostPort == 0 {
		record.CavesHostPort = models.StandardClosureDefaultCavesHostPort
	}
	if record.MasterSteamHostPort == 0 {
		record.MasterSteamHostPort = models.StandardClosureDefaultMasterSteamHostPort
	}
	if record.CavesSteamHostPort == 0 {
		record.CavesSteamHostPort = models.StandardClosureDefaultCavesSteamHostPort
	}
	return record
}

func scanClusterRecord(scanner clusterScanner) (models.ClusterRecord, error) {
	var record models.ClusterRecord
	var createdAt string
	var updatedAt string

	if err := scanner.Scan(
		&record.ID,
		&record.Slug,
		&record.DisplayName,
		&record.Note,
		&record.ClusterName,
		&record.BaseDir,
		&record.ComposeFile,
		&record.EnvFile,
		&record.Status,
		&record.UpdateMode,
		&record.ServerModsUpdateMode,
		&record.TimeZone,
		&record.MasterHostPort,
		&record.CavesHostPort,
		&record.MasterSteamHostPort,
		&record.CavesSteamHostPort,
		&createdAt,
		&updatedAt,
	); err != nil {
		return models.ClusterRecord{}, err
	}

	parsedCreatedAt, err := time.Parse(time.RFC3339Nano, createdAt)
	if err != nil {
		return models.ClusterRecord{}, err
	}
	parsedUpdatedAt, err := time.Parse(time.RFC3339Nano, updatedAt)
	if err != nil {
		return models.ClusterRecord{}, err
	}

	record.CreatedAt = parsedCreatedAt
	record.UpdatedAt = parsedUpdatedAt
	return record, nil
}

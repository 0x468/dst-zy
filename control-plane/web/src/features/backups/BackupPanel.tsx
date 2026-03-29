import type { BackupSummary } from "../../lib/api";

type BackupPanelProps = {
  clusterSlug: string;
  backups: BackupSummary[];
};

export function BackupPanel({ clusterSlug, backups }: BackupPanelProps) {
  return (
    <section>
      <h2>Backups</h2>
      {backups.length === 0 ? (
        <p>No backups yet.</p>
      ) : (
        <ul>
          {backups.map((backup) => (
            <li key={backup.name}>
              <a href={buildDownloadPath(clusterSlug, backup.name)}>{backup.name}</a>
              <time dateTime={backup.createdAt}>{formatBackupTimestamp(backup.createdAt)}</time>
              <span>{formatBackupSize(backup.sizeBytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function buildDownloadPath(clusterSlug: string, backupName: string) {
  return `/api/clusters/${encodeURIComponent(clusterSlug)}/backups/${encodeURIComponent(backupName)}`;
}

function formatBackupTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC");
}

function formatBackupSize(value: number) {
  return `${value} B`;
}

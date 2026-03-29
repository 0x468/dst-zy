import { useState } from "react";

import type { BackupSummary } from "../../lib/api";

type BackupPanelProps = {
  clusterSlug: string;
  backups: BackupSummary[];
  onRefresh?: () => Promise<void> | void;
};

export function BackupPanel({ clusterSlug, backups, onRefresh = () => {} }: BackupPanelProps) {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const latestBackup = backups[0];
  const olderBackups = backups.slice(1);

  return (
    <section>
      <h2>Backups</h2>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await onRefresh();
            setErrorMessage(undefined);
          } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to refresh backups"));
          } finally {
            setPending(false);
          }
        }}
      >
        Refresh backups
      </button>
      {backups.length === 0 ? (
        <p>No backups yet.</p>
      ) : (
        <>
          {latestBackup ? (
            <p>
              <strong>Latest backup</strong>
              {" "}
              <a href={buildDownloadPath(clusterSlug, latestBackup.name)}>{latestBackup.name}</a>
              {" "}
              <time dateTime={latestBackup.createdAt}>{formatBackupTimestamp(latestBackup.createdAt)}</time>
              {" "}
              <span>{formatBackupSize(latestBackup.sizeBytes)}</span>
            </p>
          ) : null}
          {olderBackups.length > 0 ? (
            <ul>
              {olderBackups.map((backup) => (
                <li key={backup.name}>
                  <a href={buildDownloadPath(clusterSlug, backup.name)}>{backup.name}</a>
                  <time dateTime={backup.createdAt}>{formatBackupTimestamp(backup.createdAt)}</time>
                  <span>{formatBackupSize(backup.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

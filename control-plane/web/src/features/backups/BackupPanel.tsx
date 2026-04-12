import { useState } from "react";

import { Panel } from "../../components/ui/Panel";
import type { BackupSummary } from "../../lib/api";

type BackupPanelProps = {
  clusterSlug: string;
  backups: BackupSummary[];
  onRefresh?: () => Promise<void> | void;
  onRestore?: (backupName: string) => Promise<void> | void;
};

export function BackupPanel({ clusterSlug, backups, onRefresh = () => {}, onRestore }: BackupPanelProps) {
  const [pending, setPending] = useState(false);
  const [restorePendingName, setRestorePendingName] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const latestBackup = backups[0];
  const olderBackups = backups.slice(1);

  return (
    <Panel
      title="Backups"
      eyebrow="Recovery points"
      className="backup-panel"
      actions={(
        <button
          type="button"
          disabled={pending || restorePendingName !== undefined}
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
      )}
    >
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {backups.length === 0 ? (
        <p className="record-panel__empty">No backups yet.</p>
      ) : (
        <>
          {latestBackup ? (
            <section className="backup-panel__latest" aria-label="Latest backup">
              <div className="backup-panel__latest-header">
                <p className="backup-panel__label">Latest backup</p>
                {onRestore ? (
                  <button
                    type="button"
                    disabled={pending || restorePendingName !== undefined}
                    onClick={() => void restoreBackup(latestBackup.name)}
                  >
                    Restore latest backup
                  </button>
                ) : null}
              </div>
              <BackupRecord clusterSlug={clusterSlug} backup={latestBackup} emphasized />
            </section>
          ) : null}
          {olderBackups.length > 0 ? (
            <ul className="backup-panel__history" aria-label="Backup history">
              {olderBackups.map((backup) => (
                <li key={backup.name}>
                  <BackupRecord
                    clusterSlug={clusterSlug}
                    backup={backup}
                    restoreDisabled={pending || restorePendingName !== undefined}
                    onRestore={onRestore ? () => void restoreBackup(backup.name) : undefined}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Panel>
  );

  async function restoreBackup(backupName: string) {
    if (!onRestore) {
      return;
    }
    setRestorePendingName(backupName);
    try {
      await onRestore(backupName);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to restore backup"));
    } finally {
      setRestorePendingName(undefined);
    }
  }
}

type BackupRecordProps = {
  clusterSlug: string;
  backup: BackupSummary;
  emphasized?: boolean;
  restoreDisabled?: boolean;
  onRestore?: () => void;
};

function BackupRecord({ clusterSlug, backup, emphasized = false, restoreDisabled = false, onRestore }: BackupRecordProps) {
  return (
    <div className={`backup-panel__record${emphasized ? " backup-panel__record--emphasized" : ""}`}>
      <div className="backup-panel__record-meta">
        <a href={buildDownloadPath(clusterSlug, backup.name)}>{backup.name}</a>
        <time dateTime={backup.createdAt}>{formatBackupTimestamp(backup.createdAt)}</time>
        <span>{formatBackupSize(backup.sizeBytes)}</span>
      </div>
      {onRestore ? (
        <button type="button" disabled={restoreDisabled} onClick={onRestore}>
          Restore {backup.name}
        </button>
      ) : null}
    </div>
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

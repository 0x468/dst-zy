import { useEffect, useRef, useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { getClusterLogs, type AuditSummary, type BackupSummary, type ClusterConfigSnapshot, type ClusterLogEntry, type ClusterLogSource, type ClusterSummary, type JobSummary } from "../../../lib/api";
import { BackupPanel } from "../../backups/BackupPanel";
import { LifecycleActions } from "../actions/LifecycleActions";
import { RawFileEditor } from "../../editor/RawFileEditor";
import { ClusterConfigForm } from "../forms/ClusterConfigForm";
import { JobPanel } from "../../jobs/JobPanel";
import { AuditPanel } from "../../jobs/AuditPanel";
import { ConnectionPanel } from "./ConnectionPanel";
import { LogsPanel } from "../../logs/LogsPanel";

type ClusterDetailPageProps = {
  cluster: ClusterSummary;
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => void;
  jobs?: JobSummary[];
  audit?: AuditSummary[];
  backups?: BackupSummary[];
  onAction?: (action: string) => void;
  onRestoreBackup?: (backupName: string) => Promise<void> | void;
  onRefreshBackups?: () => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
};

export function ClusterDetailPage({
  cluster,
  snapshot,
  onSave,
  jobs = [],
  audit = [],
  backups = [],
  onAction = () => {},
  onRestoreBackup = () => {},
  onRefreshBackups = () => {},
  onDelete = () => {},
}: ClusterDetailPageProps) {
  const [tab, setTab] = useState<"overview" | "advanced">("overview");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [selectedLogSource, setSelectedLogSource] = useState<ClusterLogSource>("jobs");
  const [logEntry, setLogEntry] = useState<ClusterLogEntry>();
  const [logsPending, setLogsPending] = useState(false);
  const [logsErrorMessage, setLogsErrorMessage] = useState<string>();
  const logsRequestID = useRef(0);
  const overviewCards = [
    {
      rows: [
        { label: "Cluster status", value: <StatusBadge status={cluster.status} /> },
        { label: "Identifier", value: `slug/${cluster.slug}` },
      ],
    },
    {
      rows: [
        { label: "Game mode", value: snapshot.gameMode },
        { label: "Cluster name", value: snapshot.clusterName },
      ],
    },
    {
      rows: [
        { label: "Master shard", value: String(snapshot.master.serverPort) },
        { label: "Master routing", value: `Steam ${snapshot.master.masterServerPort} / Auth ${snapshot.master.authenticationPort}` },
      ],
    },
    {
      rows: [
        { label: "Caves shard", value: String(snapshot.caves.serverPort) },
        { label: "Caves routing", value: `Steam ${snapshot.caves.masterServerPort} / Auth ${snapshot.caves.authenticationPort}` },
      ],
    },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      const requestID = ++logsRequestID.current;
      setLogsPending(true);
      try {
        const nextLogEntry = await getClusterLogs(cluster.slug, selectedLogSource);
        if (cancelled || requestID !== logsRequestID.current) {
          return;
        }
        setLogEntry(nextLogEntry);
        setLogsErrorMessage(undefined);
      } catch (error) {
        if (!cancelled && requestID === logsRequestID.current) {
          setLogsErrorMessage(getErrorMessage(error, "Failed to load logs"));
        }
      } finally {
        if (!cancelled && requestID === logsRequestID.current) {
          setLogsPending(false);
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [cluster.slug, selectedLogSource]);

  return (
    <section className="cluster-detail">
      <header className="cluster-detail__hero">
        <p className="cluster-detail__eyebrow">Steel Ops workspace</p>
        <div className="cluster-detail__hero-main">
          <div>
            <h1>{cluster.displayName}</h1>
            <p className="cluster-detail__hero-copy">
              {cluster.note || "Operate shard lifecycle, config, backups, and audit records from one workspace."}
            </p>
          </div>
          <div className="cluster-detail__hero-meta">
            <span className="cluster-detail__hero-tag">Detail workspace</span>
            <span className="cluster-detail__hero-slug">slug/{cluster.slug}</span>
          </div>
        </div>
      </header>

      <div className="cluster-detail__tablist" role="group" aria-label="Cluster detail views">
        <button
          type="button"
          className={`cluster-detail__tab${tab === "overview" ? " cluster-detail__tab--active" : ""}`}
          aria-pressed={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`cluster-detail__tab${tab === "advanced" ? " cluster-detail__tab--active" : ""}`}
          aria-pressed={tab === "advanced"}
          onClick={() => setTab("advanced")}
        >
          Advanced
        </button>
      </div>

      {tab === "overview" ? (
        <div className="cluster-detail__workspace">
          <Panel title="Overview" eyebrow="Workspace status" className="cluster-detail__overview-panel">
            <p className="cluster-detail__overview-copy">
              Track live runtime state, shard lanes, and core routing before you trigger operational actions.
            </p>
            <div className="cluster-detail__summary-grid">
              {overviewCards.map((card) => (
                <article key={card.rows[0].label} className="cluster-detail__summary-card">
                  <dl className="cluster-detail__summary-list">
                    {card.rows.map((row) => (
                      <div key={row.label} className="cluster-detail__summary-row">
                        <dt className="cluster-detail__summary-label">{row.label}</dt>
                        <dd className="cluster-detail__summary-value">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </Panel>
          <div className="cluster-detail__ops-grid">
            <LifecycleActions onAction={onAction} />
            <ClusterConfigForm snapshot={snapshot} onSave={onSave} />
            <ConnectionPanel cluster={cluster} snapshot={snapshot} />
            <LogsPanel
              selectedSource={selectedLogSource}
              content={logEntry?.content ?? ""}
              updatedAt={logEntry?.updatedAt}
              pending={logsPending}
              errorMessage={logsErrorMessage}
              onSelectSource={(source) => {
                setSelectedLogSource(source);
                setLogEntry(undefined);
                setLogsErrorMessage(undefined);
              }}
              onRefresh={() => refreshLogs(cluster.slug, selectedLogSource, logsRequestID, setLogsPending, setLogEntry, setLogsErrorMessage)}
            />
          </div>
          {cluster.status === "stopped" ? (
            <Panel title="Danger zone" eyebrow="Destructive action" className="cluster-detail__danger-panel">
              <p className="cluster-detail__danger-copy">Type {cluster.slug} to unlock deletion.</p>
              <label htmlFor="delete-confirmation">Confirm cluster slug</label>
              <input
                id="delete-confirmation"
                type="text"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <button
                type="button"
                disabled={deleteConfirmation.trim() !== cluster.slug}
                onClick={() => void onDelete()}
              >
                Delete cluster
              </button>
            </Panel>
          ) : null}
          <div className="cluster-detail__records-grid">
            <BackupPanel
              clusterSlug={cluster.slug}
              backups={backups}
              onRefresh={onRefreshBackups}
              onRestore={cluster.status === "stopped" ? onRestoreBackup : undefined}
            />
            <JobPanel jobs={jobs} />
            <AuditPanel audit={audit} clusterSlug={cluster.slug} />
          </div>
        </div>
      ) : (
        <div className="cluster-detail__workspace">
          <RawFileEditor snapshot={snapshot} onSave={onSave} />
        </div>
      )}
    </section>
  );
}

async function refreshLogs(
  slug: string,
  source: ClusterLogSource,
  requestIDRef: { current: number },
  setPending: (value: boolean) => void,
  setEntry: (value: ClusterLogEntry | undefined) => void,
  setErrorMessage: (value: string | undefined) => void,
) {
  const requestID = ++requestIDRef.current;
  setPending(true);
  setEntry(undefined);
  setErrorMessage(undefined);
  try {
    const nextLogEntry = await getClusterLogs(slug, source);
    if (requestID !== requestIDRef.current) {
      return;
    }
    setEntry(nextLogEntry);
    setErrorMessage(undefined);
  } catch (error) {
    if (requestID === requestIDRef.current) {
      setErrorMessage(getErrorMessage(error, "Failed to load logs"));
    }
  } finally {
    if (requestID === requestIDRef.current) {
      setPending(false);
    }
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

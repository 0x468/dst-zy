import { useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { AuditSummary, BackupSummary, ClusterConfigSnapshot, ClusterSummary, JobSummary } from "../../../lib/api";
import { BackupPanel } from "../../backups/BackupPanel";
import { LifecycleActions } from "../actions/LifecycleActions";
import { RawFileEditor } from "../../editor/RawFileEditor";
import { ClusterConfigForm } from "../forms/ClusterConfigForm";
import { JobPanel } from "../../jobs/JobPanel";
import { AuditPanel } from "../../jobs/AuditPanel";

type ClusterDetailPageProps = {
  cluster: ClusterSummary;
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => void;
  jobs?: JobSummary[];
  audit?: AuditSummary[];
  backups?: BackupSummary[];
  onAction?: (action: string) => void;
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
  onRefreshBackups = () => {},
  onDelete = () => {},
}: ClusterDetailPageProps) {
  const [tab, setTab] = useState<"overview" | "advanced">("overview");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const overviewCards = [
    {
      label: "Cluster status",
      value: <StatusBadge status={cluster.status} />,
      detail: `slug/${cluster.slug}`,
    },
    {
      label: "Game mode",
      value: snapshot.gameMode,
      detail: snapshot.clusterName,
    },
    {
      label: "Master shard",
      value: String(snapshot.master.serverPort),
      detail: `Steam ${snapshot.master.masterServerPort} / Auth ${snapshot.master.authenticationPort}`,
    },
    {
      label: "Caves shard",
      value: String(snapshot.caves.serverPort),
      detail: `Steam ${snapshot.caves.masterServerPort} / Auth ${snapshot.caves.authenticationPort}`,
    },
  ];

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

      <nav className="cluster-detail__tablist" aria-label="Cluster detail tabs" role="tablist">
        <button
          id="cluster-detail-tab-overview"
          type="button"
          role="tab"
          className={`cluster-detail__tab${tab === "overview" ? " cluster-detail__tab--active" : ""}`}
          aria-selected={tab === "overview"}
          aria-controls="cluster-detail-panel-overview"
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          id="cluster-detail-tab-advanced"
          type="button"
          role="tab"
          className={`cluster-detail__tab${tab === "advanced" ? " cluster-detail__tab--active" : ""}`}
          aria-selected={tab === "advanced"}
          aria-controls="cluster-detail-panel-advanced"
          onClick={() => setTab("advanced")}
        >
          Advanced
        </button>
      </nav>

      {tab === "overview" ? (
        <div
          id="cluster-detail-panel-overview"
          role="tabpanel"
          aria-labelledby="cluster-detail-tab-overview"
          className="cluster-detail__workspace"
        >
          <Panel title="Overview" eyebrow="Workspace status" className="cluster-detail__overview-panel">
            <p className="cluster-detail__overview-copy">
              Track live runtime state, shard lanes, and core routing before you trigger operational actions.
            </p>
            <div className="cluster-detail__summary-grid">
              {overviewCards.map((card) => (
                <article key={card.label} className="cluster-detail__summary-card">
                  <p className="cluster-detail__summary-label">{card.label}</p>
                  <div className="cluster-detail__summary-value">{card.value}</div>
                  <p className="cluster-detail__summary-detail">{card.detail}</p>
                </article>
              ))}
            </div>
          </Panel>
          <div className="cluster-detail__overview-main">
            <LifecycleActions onAction={onAction} />
            <ClusterConfigForm snapshot={snapshot} onSave={onSave} />
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
            <BackupPanel clusterSlug={cluster.slug} backups={backups} onRefresh={onRefreshBackups} />
            <JobPanel jobs={jobs} />
            <AuditPanel audit={audit} clusterSlug={cluster.slug} />
          </div>
        </div>
      ) : (
        <div
          id="cluster-detail-panel-advanced"
          role="tabpanel"
          aria-labelledby="cluster-detail-tab-advanced"
          className="cluster-detail__workspace"
        >
          <RawFileEditor snapshot={snapshot} onSave={onSave} />
        </div>
      )}
    </section>
  );
}

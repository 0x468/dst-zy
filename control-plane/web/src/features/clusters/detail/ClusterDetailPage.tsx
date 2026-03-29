import { useState } from "react";

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

  return (
    <section>
      <header>
        <h1>{cluster.displayName}</h1>
        <p>{cluster.note}</p>
      </header>

      <nav aria-label="Cluster detail tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "advanced"}
          onClick={() => setTab("advanced")}
        >
          Advanced
        </button>
      </nav>

      {tab === "overview" ? (
        <>
          <LifecycleActions onAction={onAction} />
          <dl>
            <div>
              <dt>Cluster status</dt>
              <dd>{cluster.status}</dd>
            </div>
            <div>
              <dt>Master port</dt>
              <dd>{snapshot.master.serverPort}</dd>
            </div>
            <div>
              <dt>Caves port</dt>
              <dd>{snapshot.caves.serverPort}</dd>
            </div>
          </dl>
          <ClusterConfigForm snapshot={snapshot} onSave={onSave} />
          {cluster.status === "stopped" ? (
            <section>
              <h2>Danger zone</h2>
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
            </section>
          ) : null}
          <BackupPanel clusterSlug={cluster.slug} backups={backups} onRefresh={onRefreshBackups} />
          <JobPanel jobs={jobs} />
          <AuditPanel audit={audit} clusterSlug={cluster.slug} />
        </>
      ) : (
        <RawFileEditor snapshot={snapshot} onSave={onSave} />
      )}
    </section>
  );
}

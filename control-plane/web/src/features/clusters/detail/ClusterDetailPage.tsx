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
};

export function ClusterDetailPage({
  cluster,
  snapshot,
  onSave,
  jobs = [],
  audit = [],
  backups = [],
  onAction = () => {},
}: ClusterDetailPageProps) {
  const [tab, setTab] = useState<"overview" | "advanced">("overview");

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
          <BackupPanel clusterSlug={cluster.slug} backups={backups} />
          <JobPanel jobs={jobs} />
          <AuditPanel audit={audit} clusterSlug={cluster.slug} />
        </>
      ) : (
        <RawFileEditor snapshot={snapshot} onSave={onSave} />
      )}
    </section>
  );
}

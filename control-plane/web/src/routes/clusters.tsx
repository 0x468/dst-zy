import type { AuditSummary, BackupSummary, ClusterConfigSnapshot, ClusterMutationInput, ClusterSummary, JobSummary } from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ClusterDetailPage } from "../features/clusters/detail/ClusterDetailPage";
import { ClusterList } from "../features/clusters/list/ClusterList";

type ClustersRouteProps = {
  clusters: ClusterSummary[];
  selectedSlug?: string;
  onSignOut: () => Promise<void> | void;
  onSelectCluster: (slug: string) => void;
  onMutateCluster: (input: ClusterMutationInput) => Promise<void> | void;
  detailCluster?: ClusterSummary;
  snapshot?: ClusterConfigSnapshot;
  jobs?: JobSummary[];
  audit?: AuditSummary[];
  backups?: BackupSummary[];
  onSaveConfig: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
  onAction: (action: string) => Promise<void> | void;
  onRefreshBackups: () => Promise<void> | void;
  onDeleteCluster: () => Promise<void> | void;
};

export function ClustersRoute({
  clusters,
  selectedSlug,
  onSignOut,
  onSelectCluster,
  onMutateCluster,
  detailCluster,
  snapshot,
  jobs = [],
  audit = [],
  backups = [],
  onSaveConfig,
  onAction,
  onRefreshBackups,
  onDeleteCluster,
}: ClustersRouteProps) {
  return (
    <section className="console-shell">
      <aside className="console-sidebar" aria-label="Cluster navigation">
        <Panel className="console-sidebar__panel">
          <ClusterList
            clusters={clusters}
            selectedSlug={selectedSlug}
            onSelect={onSelectCluster}
            onMutate={onMutateCluster}
          />
        </Panel>
        <Panel tone="subtle">
          <div className="console-toolbar">
            <button type="button" onClick={() => void onSignOut()}>Sign out</button>
          </div>
        </Panel>
      </aside>
      <main className="console-main">
        {detailCluster && snapshot ? (
          <Panel
            actions={<StatusBadge status={detailCluster.status} />}
          >
            <ClusterDetailPage
              cluster={detailCluster}
              snapshot={snapshot}
              jobs={jobs}
              audit={audit}
              backups={backups}
              onSave={onSaveConfig}
              onAction={onAction}
              onRefreshBackups={onRefreshBackups}
              onDelete={onDeleteCluster}
            />
          </Panel>
        ) : (
          <Panel title="Select a cluster">
            <p>Pick a cluster from the navigation to inspect details and run actions.</p>
          </Panel>
        )}
      </main>
    </section>
  );
}

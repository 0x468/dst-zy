import type { AuditSummary, BackupSummary, ClusterConfigSnapshot, ClusterMutationInput, ClusterSummary, JobSummary } from "../lib/api";
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
    <section>
      <header>
        <button type="button" onClick={() => void onSignOut()}>Sign out</button>
      </header>
      <ClusterList
        clusters={clusters}
        selectedSlug={selectedSlug}
        onSelect={onSelectCluster}
        onMutate={onMutateCluster}
      />
      {detailCluster && snapshot ? (
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
      ) : null}
    </section>
  );
}

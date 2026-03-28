import type { ClusterConfigSnapshot, ClusterMutationInput, ClusterSummary, JobSummary } from "../lib/api";
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
  onSaveConfig: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
  onAction: (action: string) => Promise<void> | void;
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
  onSaveConfig,
  onAction,
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
          onSave={onSaveConfig}
          onAction={onAction}
        />
      ) : null}
    </section>
  );
}

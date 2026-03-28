import type { ClusterSummary } from "../lib/api";
import { ClusterList } from "../features/clusters/list/ClusterList";

type ClustersRouteProps = {
  clusters: ClusterSummary[];
};

export function ClustersRoute({ clusters }: ClustersRouteProps) {
  return <ClusterList clusters={clusters} />;
}

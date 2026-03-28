import type { ClusterSummary } from "../../../lib/api";

type ClusterListProps = {
  clusters: ClusterSummary[];
};

export function ClusterList({ clusters }: ClusterListProps) {
  return (
    <section>
      <h2>Clusters</h2>
      <ul>
        {clusters.map((cluster) => (
          <li key={cluster.id}>
            <strong>{cluster.displayName}</strong>
            <span>{cluster.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

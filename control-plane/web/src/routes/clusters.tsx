import type {
  AuditSummary,
  BackupSummary,
  ClusterConfigSnapshot,
  ClusterMutationInput,
  ClusterSummary,
  DiscoveredClusterSummary,
  JobSummary,
} from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ClusterDetailPage } from "../features/clusters/detail/ClusterDetailPage";
import { ClusterList } from "../features/clusters/list/ClusterList";
import { ClusterWorkspaceHome } from "../features/clusters/workspace/ClusterWorkspaceHome";

type ClustersRouteProps = {
  clusters: ClusterSummary[];
  discoveredClusters: DiscoveredClusterSummary[];
  selectedSlug?: string;
  onSignOut: () => Promise<void> | void;
  onSelectCluster: (slug: string) => void;
  onOpenWorkspace: () => void;
  onCreateCluster: (input: ClusterMutationInput) => Promise<void> | void;
  onImportCluster: (input: ClusterMutationInput) => Promise<void> | void;
  onAdoptDiscoveredCluster: (slug: string) => Promise<void> | void;
  detailCluster?: ClusterSummary;
  snapshot?: ClusterConfigSnapshot;
  jobs?: JobSummary[];
  audit?: AuditSummary[];
  backups?: BackupSummary[];
  preflightRefreshKey?: number;
  onSaveConfig: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
  onAction: (action: string) => Promise<void> | void;
  onRestoreBackup: (backupName: string) => Promise<void> | void;
  onRefreshBackups: () => Promise<void> | void;
  onDeleteCluster: () => Promise<void> | void;
};

export function ClustersRoute({
  clusters,
  discoveredClusters,
  selectedSlug,
  onSignOut,
  onSelectCluster,
  onOpenWorkspace,
  onCreateCluster,
  onImportCluster,
  onAdoptDiscoveredCluster,
  detailCluster,
  snapshot,
  jobs = [],
  audit = [],
  backups = [],
  preflightRefreshKey = 0,
  onSaveConfig,
  onAction,
  onRestoreBackup,
  onRefreshBackups,
  onDeleteCluster,
}: ClustersRouteProps) {
  return (
    <section className="console-shell">
      <aside className="console-sidebar" aria-label="Cluster navigation">
        <Panel className="console-sidebar__panel">
          <ClusterList
            clusters={clusters}
            jobs={jobs}
            selectedSlug={selectedSlug}
            onSelect={onSelectCluster}
            onOpenWorkspace={onOpenWorkspace}
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
              key={detailCluster.slug}
              cluster={detailCluster}
              snapshot={snapshot}
              preflightRefreshKey={preflightRefreshKey}
              jobs={jobs.filter((job) => job.clusterId === detailCluster.id)}
              audit={audit}
              backups={backups}
              onSave={onSaveConfig}
              onAction={onAction}
              onRestoreBackup={onRestoreBackup}
              onRefreshBackups={onRefreshBackups}
              onDelete={onDeleteCluster}
            />
          </Panel>
        ) : (
          <ClusterWorkspaceHome
            clusters={clusters}
            discoveredClusters={discoveredClusters}
            onOpenCluster={onSelectCluster}
            onCreate={onCreateCluster}
            onImport={onImportCluster}
            onAdopt={onAdoptDiscoveredCluster}
          />
        )}
      </main>
    </section>
  );
}

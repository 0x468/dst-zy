import { Panel } from "../../../components/ui/Panel";
import type { ClusterConfigSnapshot, ClusterSummary } from "../../../lib/api";

type ConnectionPanelProps = {
  cluster: ClusterSummary;
  snapshot: ClusterConfigSnapshot;
};

export function ConnectionPanel({ cluster, snapshot }: ConnectionPanelProps) {
  return (
    <Panel title="Ports and connection" eyebrow="Runtime routing" className="connection-panel">
      <dl className="connection-panel__grid">
        <div className="connection-panel__item">
          <dt>Master host port</dt>
          <dd>{cluster.masterHostPort || snapshot.master.serverPort}</dd>
        </div>
        <div className="connection-panel__item">
          <dt>Caves host port</dt>
          <dd>{cluster.cavesHostPort || snapshot.caves.serverPort}</dd>
        </div>
        <div className="connection-panel__item">
          <dt>Cluster bus port</dt>
          <dd>{snapshot.masterPort}</dd>
        </div>
        <div className="connection-panel__item">
          <dt>Master Steam port</dt>
          <dd>{cluster.masterSteamHostPort || snapshot.master.masterServerPort}</dd>
        </div>
        <div className="connection-panel__item">
          <dt>Caves Steam port</dt>
          <dd>{cluster.cavesSteamHostPort || snapshot.caves.masterServerPort}</dd>
        </div>
        <div className="connection-panel__item">
          <dt>Auth lanes</dt>
          <dd>{snapshot.master.authenticationPort} / {snapshot.caves.authenticationPort}</dd>
        </div>
      </dl>
    </Panel>
  );
}

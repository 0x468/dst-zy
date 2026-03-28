import { useState } from "react";

import type { ClusterConfigSnapshot, ClusterSummary } from "../../../lib/api";
import { RawFileEditor } from "../../editor/RawFileEditor";
import { ClusterConfigForm } from "../forms/ClusterConfigForm";

type ClusterDetailPageProps = {
  cluster: ClusterSummary;
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => void;
};

export function ClusterDetailPage({ cluster, snapshot, onSave }: ClusterDetailPageProps) {
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
        </>
      ) : (
        <RawFileEditor snapshot={snapshot} onSave={onSave} />
      )}
    </section>
  );
}

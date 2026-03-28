import { useState } from "react";

import { listClusters, signIn, type ClusterSummary } from "../lib/api";
import { ClustersRoute } from "../routes/clusters";
import { LoginRoute } from "../routes/login";

export function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);

  async function handleSignIn(username: string, password: string) {
    const ok = await signIn(username, password);
    if (!ok) {
      return;
    }

    const nextClusters = await listClusters();
    setClusters(nextClusters);
    setAuthenticated(true);
  }

  return (
    <main>
      {authenticated ? (
        <ClustersRoute clusters={clusters} />
      ) : (
        <LoginRoute onSubmit={handleSignIn} />
      )}
    </main>
  );
}

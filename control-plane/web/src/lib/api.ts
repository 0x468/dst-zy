export type ClusterSummary = {
  id: number;
  slug: string;
  displayName: string;
  status: string;
  note?: string;
  clusterName?: string;
};

export type ShardSnapshot = {
  serverPort: number;
  masterServerPort: number;
  authenticationPort: number;
};

export type ClusterConfigSnapshot = {
  clusterName: string;
  clusterDescription: string;
  gameMode: string;
  clusterKey: string;
  masterPort: number;
  master: ShardSnapshot;
  caves: ShardSnapshot;
  rawFiles?: {
    clusterIni: string;
  };
};

export async function signIn(username: string, password: string): Promise<boolean> {
  return username.trim() !== "" && password.trim() !== "";
}

export async function listClusters(): Promise<ClusterSummary[]> {
  return [
    {
      id: 1,
      slug: "cluster-a",
      displayName: "Cluster A",
      status: "running",
    },
  ];
}

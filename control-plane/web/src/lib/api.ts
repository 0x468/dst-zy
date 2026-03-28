export type ClusterSummary = {
  id: number;
  slug: string;
  displayName: string;
  status: string;
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

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

export type JobSummary = {
  id: number;
  clusterId: number;
  jobType: string;
  status: string;
  stdoutExcerpt: string;
  stderrExcerpt: string;
};

export type AuditSummary = {
  id: number;
  actor: string;
  action: string;
  targetType: string;
  targetId: number;
  summary: string;
  createdAt: string;
};

export type ClusterMutationInput = {
  mode: "create" | "import";
  slug: string;
  displayName: string;
  clusterName: string;
  baseDir?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ClusterSummaryResponse = {
  id: number;
  slug: string;
  display_name: string;
  status: string;
  note?: string;
  cluster_name?: string;
};

type ClusterConfigSnapshotResponse = {
  cluster_name: string;
  cluster_description: string;
  game_mode: string;
  cluster_key: string;
  master_port: number;
  master: {
    server_port: number;
    master_server_port: number;
    authentication_port: number;
  };
  caves: {
    server_port: number;
    master_server_port: number;
    authentication_port: number;
  };
  raw_files?: {
    cluster_ini: string;
  };
};

type JobSummaryResponse = {
  id: number;
  cluster_id: number;
  job_type: string;
  status: string;
  stdout_excerpt: string;
  stderr_excerpt: string;
};

type AuditSummaryResponse = {
  id: number;
  actor: string;
  action: string;
  target_type: string;
  target_id: number;
  summary: string;
  created_at: string;
};

export async function signIn(username: string, password: string): Promise<boolean> {
  const response = await fetch("/api/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (response.status === 401) {
    return false;
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return response.ok;
}

export async function getSession(): Promise<boolean> {
  const response = await fetch("/api/session", {
    credentials: "include",
  });

  if (response.status === 401) {
    return false;
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return true;
}

export async function signOut(): Promise<void> {
  const response = await fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok && response.status !== 204) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
}

export async function listClusters(): Promise<ClusterSummary[]> {
  const response = await request("/api/clusters");
  return mapClusters(await response.json() as ClusterSummaryResponse[]);
}

export async function getClusterConfig(slug: string): Promise<ClusterConfigSnapshot> {
  const response = await request(`/api/clusters/${slug}/config`);
  return mapSnapshot(await response.json() as ClusterConfigSnapshotResponse);
}

export async function saveClusterConfig(slug: string, snapshot: ClusterConfigSnapshot): Promise<void> {
  await request(`/api/clusters/${slug}/config`, {
    method: "PUT",
    body: JSON.stringify(encodeSnapshot(snapshot)),
  });
}

export async function listJobs(): Promise<JobSummary[]> {
  const response = await request("/api/jobs");
  return mapJobs(await response.json() as JobSummaryResponse[]);
}

export async function listAudit(): Promise<AuditSummary[]> {
  const response = await request("/api/audit");
  return mapAudit(await response.json() as AuditSummaryResponse[]);
}

export async function runClusterAction(slug: string, action: string): Promise<JobSummary> {
  const response = await request(`/api/clusters/${slug}/actions`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  return mapJob(await response.json() as JobSummaryResponse);
}

export async function mutateCluster(input: ClusterMutationInput): Promise<ClusterSummary> {
  const response = await request("/api/clusters", {
    method: "POST",
    body: JSON.stringify({
      mode: input.mode,
      slug: input.slug,
      display_name: input.displayName,
      cluster_name: input.clusterName,
      base_dir: input.baseDir ?? "",
    }),
  });

  return mapCluster(await response.json() as ClusterSummaryResponse);
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return response;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json() as { error?: unknown };
      if (typeof payload.error === "string" && payload.error.trim() !== "") {
        return payload.error;
      }
    } catch {
      // Fall back to text parsing below when the body is not valid JSON.
    }
  }

  const text = await response.text();
  if (text.trim() !== "") {
    return text.trim();
  }

  return `request failed: ${response.status}`;
}

function mapClusters(clusters: ClusterSummaryResponse[]): ClusterSummary[] {
  return clusters.map(mapCluster);
}

function mapCluster(cluster: ClusterSummaryResponse): ClusterSummary {
  return {
    id: cluster.id,
    slug: cluster.slug,
    displayName: cluster.display_name,
    status: cluster.status,
    note: cluster.note ?? "",
    clusterName: cluster.cluster_name ?? "",
  };
}

function mapSnapshot(snapshot: ClusterConfigSnapshotResponse): ClusterConfigSnapshot {
  return {
    clusterName: snapshot.cluster_name,
    clusterDescription: snapshot.cluster_description,
    gameMode: snapshot.game_mode,
    clusterKey: snapshot.cluster_key,
    masterPort: snapshot.master_port,
    master: {
      serverPort: snapshot.master.server_port,
      masterServerPort: snapshot.master.master_server_port,
      authenticationPort: snapshot.master.authentication_port,
    },
    caves: {
      serverPort: snapshot.caves.server_port,
      masterServerPort: snapshot.caves.master_server_port,
      authenticationPort: snapshot.caves.authentication_port,
    },
    rawFiles: snapshot.raw_files ? {
      clusterIni: snapshot.raw_files.cluster_ini,
    } : undefined,
  };
}

function mapAudit(records: AuditSummaryResponse[]): AuditSummary[] {
  return records.map((record) => ({
    id: record.id,
    actor: record.actor,
    action: record.action,
    targetType: record.target_type,
    targetId: record.target_id,
    summary: record.summary,
    createdAt: record.created_at,
  }));
}

function encodeSnapshot(snapshot: ClusterConfigSnapshot): ClusterConfigSnapshotResponse {
  return {
    cluster_name: snapshot.clusterName,
    cluster_description: snapshot.clusterDescription,
    game_mode: snapshot.gameMode,
    cluster_key: snapshot.clusterKey,
    master_port: snapshot.masterPort,
    master: {
      server_port: snapshot.master.serverPort,
      master_server_port: snapshot.master.masterServerPort,
      authentication_port: snapshot.master.authenticationPort,
    },
    caves: {
      server_port: snapshot.caves.serverPort,
      master_server_port: snapshot.caves.masterServerPort,
      authentication_port: snapshot.caves.authenticationPort,
    },
    raw_files: snapshot.rawFiles ? {
      cluster_ini: snapshot.rawFiles.clusterIni,
    } : undefined,
  };
}

function mapJobs(jobs: JobSummaryResponse[]): JobSummary[] {
  return jobs.map(mapJob);
}

function mapJob(job: JobSummaryResponse): JobSummary {
  return {
    id: job.id,
    clusterId: job.cluster_id,
    jobType: job.job_type,
    status: job.status,
    stdoutExcerpt: job.stdout_excerpt,
    stderrExcerpt: job.stderr_excerpt,
  };
}

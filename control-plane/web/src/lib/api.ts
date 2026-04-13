export type ClusterSummary = {
  id: number;
  slug: string;
  displayName: string;
  status: string;
  note?: string;
  clusterName?: string;
  masterHostPort?: number;
  cavesHostPort?: number;
  masterSteamHostPort?: number;
  cavesSteamHostPort?: number;
  updatedAt?: string;
};

export type ShardSnapshot = {
  serverPort: number;
  masterServerPort: number;
  authenticationPort: number;
};

export type ClusterConfigSnapshot = {
  clusterName: string;
  clusterDescription: string;
  clusterPassword?: string;
  clusterToken?: string;
  gameMode: string;
  clusterKey: string;
  maxPlayers?: number;
  clusterIntention?: string;
  pvp?: boolean;
  pauseWhenEmpty?: boolean;
  shardEnabled?: boolean;
  bindIP?: string;
  masterIP?: string;
  timeZone?: string;
  updateMode?: string;
  serverModsUpdateMode?: string;
  masterHostPort?: number;
  cavesHostPort?: number;
  masterSteamHostPort?: number;
  cavesSteamHostPort?: number;
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
  startedAt?: string;
  finishedAt?: string;
};

export type ClusterLogSource = "jobs" | "master" | "caves";

export type ClusterLogEntry = {
  source: ClusterLogSource;
  content: string;
  updatedAt: string;
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

export type BackupSummary = {
  name: string;
  sizeBytes: number;
  createdAt: string;
  clusterSlug: string;
};

export type PreflightCheck = {
  code: string;
  severity: string;
  summary: string;
  detail: string;
  hint: string;
};

export type PreflightReport = {
  status: string;
  fatalCount: number;
  warningCount: number;
  checks: PreflightCheck[];
};

export type ClusterMutationInput = {
  mode: "create" | "import";
  slug: string;
  displayName: string;
  clusterName: string;
  clusterDescription?: string;
  clusterPassword?: string;
  gameMode?: string;
  maxPlayers?: number;
  pvp?: boolean;
  pauseWhenEmpty?: boolean;
  clusterToken?: string;
  clusterKey?: string;
  intent?: string;
  timeZone?: string;
  masterHostPort?: number;
  cavesHostPort?: number;
  steamHostPort?: number;
  cavesSteamHostPort?: number;
  autoStart?: boolean;
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

const CSRF_HEADER_NAME = "X-DST-Control-Plane-CSRF";
const CSRF_HEADER_VALUE = "1";

type ClusterSummaryResponse = {
  id: number;
  slug: string;
  display_name: string;
  status: string;
  note?: string;
  cluster_name?: string;
  master_host_port?: number;
  caves_host_port?: number;
  master_steam_host_port?: number;
  caves_steam_host_port?: number;
  updated_at?: string;
};

type ClusterConfigSnapshotResponse = {
  cluster_name: string;
  cluster_description: string;
  cluster_password?: string;
  cluster_token?: string;
  game_mode: string;
  cluster_key: string;
  max_players?: number;
  cluster_intention?: string;
  pvp?: boolean;
  pause_when_empty?: boolean;
  shard_enabled?: boolean;
  bind_ip?: string;
  master_ip?: string;
  time_zone?: string;
  update_mode?: string;
  server_mods_update_mode?: string;
  master_host_port?: number;
  caves_host_port?: number;
  master_steam_host_port?: number;
  caves_steam_host_port?: number;
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
  started_at?: string;
  finished_at?: string;
};

type ClusterLogEntryResponse = {
  source: ClusterLogSource;
  content: string;
  updated_at: string;
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

type BackupSummaryResponse = {
  name: string;
  size_bytes: number;
  created_at: string;
  cluster_slug: string;
};

type PreflightCheckResponse = {
  code: string;
  severity: string;
  summary: string;
  detail: string;
  hint: string;
};

type PreflightReportResponse = {
  status: string;
  fatal_count: number;
  warning_count: number;
  checks: PreflightCheckResponse[];
};

export async function signIn(username: string, password: string): Promise<boolean> {
  const response = await fetch("/api/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
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
    headers: {
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
    },
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

export async function listAudit(slug?: string, limit = 20): Promise<AuditSummary[]> {
  const query = new URLSearchParams();
  if (slug) {
    query.set("slug", slug);
  }
  query.set("limit", String(limit));

  const response = await request(`/api/audit?${query.toString()}`);
  return mapAudit(await response.json() as AuditSummaryResponse[]);
}

export async function listBackups(slug: string): Promise<BackupSummary[]> {
  const response = await request(`/api/clusters/${slug}/backups`);
  return mapBackups(await response.json() as BackupSummaryResponse[]);
}

export async function getClusterLogs(slug: string, source: ClusterLogSource): Promise<ClusterLogEntry> {
  const query = new URLSearchParams({ source });
  const response = await request(`/api/clusters/${slug}/logs?${query.toString()}`);
  return mapClusterLog(await response.json() as ClusterLogEntryResponse);
}

export async function previewClusterPreflight(input: ClusterMutationInput): Promise<PreflightReport> {
  const response = await request("/api/preflight", {
    method: "POST",
    body: JSON.stringify(encodeClusterMutation(input)),
  });
  return mapPreflight(await response.json() as PreflightReportResponse);
}

export async function getClusterPreflight(slug: string): Promise<PreflightReport> {
  const response = await request(`/api/clusters/${slug}/preflight`);
  return mapPreflight(await response.json() as PreflightReportResponse);
}

export async function runClusterAction(slug: string, action: string, backupName?: string): Promise<JobSummary> {
  const response = await request(`/api/clusters/${slug}/actions`, {
    method: "POST",
    body: JSON.stringify({
      action,
      ...(backupName ? { backup_name: backupName } : {}),
    }),
  });
  return mapJob(await response.json() as JobSummaryResponse);
}

export async function mutateCluster(input: ClusterMutationInput): Promise<ClusterSummary> {
  const response = await request("/api/clusters", {
    method: "POST",
    body: JSON.stringify(encodeClusterMutation(input)),
  });

  return mapCluster(await response.json() as ClusterSummaryResponse);
}

export async function deleteCluster(slug: string): Promise<void> {
  await request(`/api/clusters/${slug}`, {
    method: "DELETE",
  });
}

async function request(path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" && method !== "HEAD" ? { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE } : {}),
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
    masterHostPort: cluster.master_host_port ?? 0,
    cavesHostPort: cluster.caves_host_port ?? 0,
    masterSteamHostPort: cluster.master_steam_host_port ?? 0,
    cavesSteamHostPort: cluster.caves_steam_host_port ?? 0,
    updatedAt: cluster.updated_at ?? "",
  };
}

function mapSnapshot(snapshot: ClusterConfigSnapshotResponse): ClusterConfigSnapshot {
  return {
    clusterName: snapshot.cluster_name,
    clusterDescription: snapshot.cluster_description,
    clusterPassword: snapshot.cluster_password ?? "",
    clusterToken: snapshot.cluster_token ?? "",
    gameMode: snapshot.game_mode,
    clusterKey: snapshot.cluster_key,
    maxPlayers: snapshot.max_players,
    clusterIntention: snapshot.cluster_intention ?? "",
    pvp: snapshot.pvp,
    pauseWhenEmpty: snapshot.pause_when_empty,
    shardEnabled: snapshot.shard_enabled,
    bindIP: snapshot.bind_ip ?? "",
    masterIP: snapshot.master_ip ?? "",
    timeZone: snapshot.time_zone ?? "",
    updateMode: snapshot.update_mode ?? "",
    serverModsUpdateMode: snapshot.server_mods_update_mode ?? "",
    masterHostPort: snapshot.master_host_port ?? 0,
    cavesHostPort: snapshot.caves_host_port ?? 0,
    masterSteamHostPort: snapshot.master_steam_host_port ?? 0,
    cavesSteamHostPort: snapshot.caves_steam_host_port ?? 0,
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

function mapBackups(records: BackupSummaryResponse[]): BackupSummary[] {
  return records.map((record) => ({
    name: record.name,
    sizeBytes: record.size_bytes,
    createdAt: record.created_at,
    clusterSlug: record.cluster_slug,
  }));
}

function mapPreflight(report: PreflightReportResponse): PreflightReport {
  return {
    status: report.status,
    fatalCount: report.fatal_count,
    warningCount: report.warning_count,
    checks: report.checks.map((check) => ({
      code: check.code,
      severity: check.severity,
      summary: check.summary,
      detail: check.detail,
      hint: check.hint,
    })),
  };
}

function encodeClusterMutation(input: ClusterMutationInput) {
  return {
    mode: input.mode,
    slug: input.slug,
    display_name: input.displayName,
    cluster_name: input.clusterName,
    cluster_description: input.clusterDescription ?? "",
    cluster_password: input.clusterPassword ?? "",
    game_mode: input.gameMode ?? "",
    max_players: input.maxPlayers ?? 0,
    pvp: input.pvp ?? false,
    pause_when_empty: input.pauseWhenEmpty ?? false,
    cluster_token: input.clusterToken ?? "",
    cluster_key: input.clusterKey ?? "",
    intent: input.intent ?? "",
    time_zone: input.timeZone ?? "",
    master_host_port: input.masterHostPort ?? 0,
    caves_host_port: input.cavesHostPort ?? 0,
    steam_host_port: input.steamHostPort ?? 0,
    caves_steam_host_port: input.cavesSteamHostPort ?? 0,
    auto_start: input.autoStart ?? false,
    base_dir: input.baseDir ?? "",
  };
}

function encodeSnapshot(snapshot: ClusterConfigSnapshot): ClusterConfigSnapshotResponse {
  return {
    cluster_name: snapshot.clusterName,
    cluster_description: snapshot.clusterDescription,
    cluster_password: snapshot.clusterPassword,
    cluster_token: snapshot.clusterToken,
    game_mode: snapshot.gameMode,
    cluster_key: snapshot.clusterKey,
    max_players: snapshot.maxPlayers,
    cluster_intention: snapshot.clusterIntention,
    pvp: snapshot.pvp,
    pause_when_empty: snapshot.pauseWhenEmpty,
    shard_enabled: snapshot.shardEnabled,
    bind_ip: snapshot.bindIP,
    master_ip: snapshot.masterIP,
    time_zone: snapshot.timeZone,
    update_mode: snapshot.updateMode,
    server_mods_update_mode: snapshot.serverModsUpdateMode,
    master_host_port: snapshot.masterHostPort,
    caves_host_port: snapshot.cavesHostPort,
    master_steam_host_port: snapshot.masterSteamHostPort,
    caves_steam_host_port: snapshot.cavesSteamHostPort,
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
    startedAt: job.started_at,
    finishedAt: job.finished_at,
  };
}

function mapClusterLog(entry: ClusterLogEntryResponse): ClusterLogEntry {
  return {
    source: entry.source,
    content: entry.content,
    updatedAt: entry.updated_at,
  };
}

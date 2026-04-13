import { useEffect, useState } from "react";

import {
  deleteCluster,
  getClusterConfig,
  getSession,
  listAudit,
  listBackups,
  listClusters,
  listJobs,
  mutateCluster,
  runClusterAction,
  saveClusterConfig,
  signIn,
  signOut,
  ApiError,
  type AuditSummary,
  type BackupSummary,
  type ClusterConfigSnapshot,
  type ClusterMutationInput,
  type ClusterSummary,
  type JobSummary,
} from "../lib/api";
import { ClustersRoute } from "../routes/clusters";
import { LoginRoute } from "../routes/login";

export function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [snapshot, setSnapshot] = useState<ClusterConfigSnapshot>();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [audit, setAudit] = useState<AuditSummary[]>([]);
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [preflightRefreshKey, setPreflightRefreshKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>();

  const selectedCluster = clusters.find((cluster) => cluster.slug === selectedSlug);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const hasSession = await getSession();
        if (!hasSession || cancelled) {
          return;
        }

        setErrorMessage(undefined);
        await refreshClusters();
        if (cancelled) {
          return;
        }
        setAuthenticated(true);
      } catch (error) {
        if (!cancelled) {
          handleAppError(error, "Failed to restore session");
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSnapshot(undefined);
    setAudit([]);
    setBackups([]);
    setPreflightRefreshKey(0);
  }, [selectedSlug]);

  function handleAppError(error: unknown, fallback: string) {
    if (isUnauthorizedError(error)) {
      clearAuthenticatedState(
        setAuthenticated,
        setClusters,
        setSelectedSlug,
        setSnapshot,
        setJobs,
        setAudit,
        setBackups,
        setErrorMessage,
        "Session expired",
      );
      return;
    }

    setErrorMessage(getErrorMessage(error, fallback));
  }

  async function handleSignIn(username: string, password: string) {
    try {
      const ok = await signIn(username, password);
      if (!ok) {
        setErrorMessage("Invalid username or password");
        return;
      }

      setErrorMessage(undefined);
      await refreshClusters();
      setAuthenticated(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to sign in"));
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      setAuthenticated(false);
      setClusters([]);
      setSelectedSlug(undefined);
      setSnapshot(undefined);
      setJobs([]);
      setAudit([]);
      setBackups([]);
      setErrorMessage(undefined);
    }
  }

  async function refreshClusters(preferredSlug?: string) {
    const nextClusters = await listClusters();
    setClusters(nextClusters);

    if (nextClusters.length === 0) {
      setSelectedSlug(undefined);
      setSnapshot(undefined);
      setJobs([]);
      setAudit([]);
      setBackups([]);
      return;
    }

    const nextSelectedSlug = preferredSlug && nextClusters.some((cluster) => cluster.slug === preferredSlug)
      ? preferredSlug
      : nextClusters[0].slug;
    setSelectedSlug(nextSelectedSlug);
  }

  async function handleMutateCluster(input: ClusterMutationInput) {
    try {
      const createdCluster = await mutateCluster(input);
      setErrorMessage(undefined);
      // The backend accepts auto_start but does not currently change lifecycle state during create,
      // so the UI bridges the gap by issuing a start action only when the new record is still stopped.
      if (input.mode === "create" && input.autoStart && createdCluster.status === "stopped") {
        try {
          await runClusterAction(createdCluster.slug, "start");
        } catch (error) {
          setErrorMessage(getErrorMessage(error, "Cluster created but failed to auto-start"));
        }
      }
      await refreshClusters(createdCluster.slug);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleAppError(error, `Failed to ${input.mode} cluster`);
        return;
      }
      throw error;
    }
  }

  async function handleCreateCluster(input: ClusterMutationInput) {
    await handleMutateCluster({ ...input, mode: "create" });
  }

  async function handleImportCluster(input: ClusterMutationInput) {
    await handleMutateCluster({ ...input, mode: "import" });
  }

  async function handleDeleteCluster() {
    if (!selectedSlug) {
      return;
    }

    try {
      await deleteCluster(selectedSlug);
      setErrorMessage(undefined);
      await refreshClusters();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleAppError(error, "Failed to delete cluster");
        return;
      }
      throw error;
    }
  }

  async function handleSaveConfig(nextSnapshot: ClusterConfigSnapshot) {
    if (!selectedSlug) {
      return;
    }

    try {
      await saveClusterConfig(selectedSlug, nextSnapshot);
      setErrorMessage(undefined);
      const [nextConfigSnapshot, nextAudit] = await Promise.all([
        getClusterConfig(selectedSlug),
        listAudit(selectedSlug),
      ]);
      setSnapshot(nextConfigSnapshot);
      setAudit(nextAudit);
      setClusters((current) => current.map((cluster) => (
        cluster.slug === selectedSlug
          ? {
              ...cluster,
              displayName: nextConfigSnapshot.displayName?.trim() || cluster.displayName,
              note: nextConfigSnapshot.note?.trim() ?? "",
            }
          : cluster
      )));
      setPreflightRefreshKey((current) => current + 1);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleAppError(error, "Failed to save config");
        return;
      }
      throw error;
    }
  }

  async function handleAction(action: string) {
    if (!selectedSlug) {
      return;
    }

    try {
      await runClusterAction(selectedSlug, action);
      setErrorMessage(undefined);
      const nextJobs = await listJobs();
      setJobs(nextJobs);
      await refreshClusters(selectedSlug);
      setPreflightRefreshKey((current) => current + 1);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleAppError(error, `Failed to run ${action}`);
        return;
      }
      throw error;
    }
  }

  async function handleRefreshBackups() {
    if (!selectedSlug) {
      return;
    }

    try {
      const nextBackups = await listBackups(selectedSlug);
      setBackups(nextBackups);
      setErrorMessage(undefined);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleAppError(error, "Failed to refresh backups");
        return;
      }
      throw error;
    }
  }

  async function handleRestoreBackup(backupName: string) {
    if (!selectedSlug) {
      return;
    }

    try {
      await runClusterAction(selectedSlug, "restore", backupName);
      setErrorMessage(undefined);
      const [nextJobs, nextAudit, nextBackups] = await Promise.all([
        listJobs(),
        listAudit(selectedSlug),
        listBackups(selectedSlug),
      ]);
      setJobs(nextJobs);
      setAudit(nextAudit);
      setBackups(nextBackups);
      await refreshClusters(selectedSlug);
      setPreflightRefreshKey((current) => current + 1);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleAppError(error, "Failed to restore backup");
        return;
      }
      throw error;
    }
  }

  useEffect(() => {
    if (!authenticated || !selectedSlug || !selectedCluster) {
      return;
    }

    const activeSlug = selectedSlug;
    let cancelled = false;

    async function loadClusterDetails() {
      try {
        const [nextSnapshot, nextJobs, nextAudit, nextBackups] = await Promise.all([
          getClusterConfig(activeSlug),
          listJobs(),
          listAudit(activeSlug),
          listBackups(activeSlug),
        ]);

        if (cancelled) {
          return;
        }

        setSnapshot(nextSnapshot);
        setJobs(nextJobs);
        setAudit(nextAudit);
        setBackups(nextBackups);
      } catch (error) {
        if (!cancelled) {
          handleAppError(error, "Failed to load cluster details");
        }
      }
    }

    void loadClusterDetails();

    return () => {
      cancelled = true;
    };
  }, [authenticated, selectedCluster, selectedSlug]);

  return (
    <div className="app-root">
      {errorMessage ? <p role="alert" className="app-error">{errorMessage}</p> : null}
      {authenticated ? (
        <ClustersRoute
          clusters={clusters}
          selectedSlug={selectedSlug}
          onSignOut={handleSignOut}
          onSelectCluster={setSelectedSlug}
          onOpenWorkspace={() => setSelectedSlug(undefined)}
          onCreateCluster={handleCreateCluster}
          onImportCluster={handleImportCluster}
          detailCluster={selectedCluster}
          snapshot={snapshot}
          jobs={jobs}
          audit={audit}
          backups={backups}
          preflightRefreshKey={preflightRefreshKey}
          onSaveConfig={handleSaveConfig}
          onAction={handleAction}
          onRestoreBackup={handleRestoreBackup}
          onRefreshBackups={handleRefreshBackups}
          onDeleteCluster={handleDeleteCluster}
        />
      ) : (
        <LoginRoute onSubmit={handleSignIn} />
      )}
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function clearAuthenticatedState(
  setAuthenticated: (value: boolean) => void,
  setClusters: (value: ClusterSummary[]) => void,
  setSelectedSlug: (value: string | undefined) => void,
  setSnapshot: (value: ClusterConfigSnapshot | undefined) => void,
  setJobs: (value: JobSummary[]) => void,
  setAudit: (value: AuditSummary[]) => void,
  setBackups: (value: BackupSummary[]) => void,
  setErrorMessage: (value: string | undefined) => void,
  message: string,
) {
  setAuthenticated(false);
  setClusters([]);
  setSelectedSlug(undefined);
  setSnapshot(undefined);
  setJobs([]);
  setAudit([]);
  setBackups([]);
  setErrorMessage(message);
}

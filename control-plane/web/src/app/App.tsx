import { useEffect, useState } from "react";

import {
  getClusterConfig,
  getSession,
  listClusters,
  listJobs,
  mutateCluster,
  runClusterAction,
  saveClusterConfig,
  signIn,
  signOut,
  ApiError,
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
    setJobs([]);
  }, [selectedSlug]);

  function handleAppError(error: unknown, fallback: string) {
    if (isUnauthorizedError(error)) {
      clearAuthenticatedState(
        setAuthenticated,
        setClusters,
        setSelectedSlug,
        setSnapshot,
        setJobs,
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
      await refreshClusters(createdCluster.slug);
    } catch (error) {
      handleAppError(error, `Failed to ${input.mode} cluster`);
    }
  }

  async function handleSaveConfig(nextSnapshot: ClusterConfigSnapshot) {
    if (!selectedSlug) {
      return;
    }

    try {
      await saveClusterConfig(selectedSlug, nextSnapshot);
      setErrorMessage(undefined);
      setSnapshot(await getClusterConfig(selectedSlug));
    } catch (error) {
      handleAppError(error, "Failed to save config");
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
      setJobs(filterJobsForCluster(nextJobs, selectedCluster?.id));
      await refreshClusters(selectedSlug);
    } catch (error) {
      handleAppError(error, `Failed to run ${action}`);
    }
  }

  useEffect(() => {
    if (!authenticated || !selectedSlug || !selectedCluster) {
      return;
    }

    const activeSlug = selectedSlug;
    const activeClusterID = selectedCluster.id;
    let cancelled = false;

    async function loadClusterDetails() {
      try {
        const [nextSnapshot, nextJobs] = await Promise.all([
          getClusterConfig(activeSlug),
          listJobs(),
        ]);

        if (cancelled) {
          return;
        }

        setSnapshot(nextSnapshot);
        setJobs(filterJobsForCluster(nextJobs, activeClusterID));
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
    <main>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {authenticated ? (
        <ClustersRoute
          clusters={clusters}
          selectedSlug={selectedSlug}
          onSignOut={handleSignOut}
          onSelectCluster={setSelectedSlug}
          onMutateCluster={handleMutateCluster}
          detailCluster={selectedCluster}
          snapshot={snapshot}
          jobs={jobs}
          onSaveConfig={handleSaveConfig}
          onAction={handleAction}
        />
      ) : (
        <LoginRoute onSubmit={handleSignIn} />
      )}
    </main>
  );
}

function filterJobsForCluster(jobs: JobSummary[], clusterID?: number) {
  if (!clusterID) {
    return [];
  }

  return jobs.filter((job) => job.clusterId === clusterID);
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
  setErrorMessage: (value: string | undefined) => void,
  message: string,
) {
  setAuthenticated(false);
  setClusters([]);
  setSelectedSlug(undefined);
  setSnapshot(undefined);
  setJobs([]);
  setErrorMessage(message);
}

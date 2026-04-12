import { useState } from "react";

import { CreateClusterWizard } from "../create/CreateClusterWizard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { ClusterMutationInput, ClusterSummary, JobSummary } from "../../../lib/api";

type ClusterListProps = {
  clusters: ClusterSummary[];
  jobs?: JobSummary[];
  selectedSlug?: string;
  onSelect: (slug: string) => void;
  onCreate: (input: ClusterMutationInput) => Promise<void> | void;
  onImport: (input: ClusterMutationInput) => Promise<void> | void;
};

export function ClusterList({ clusters, jobs = [], selectedSlug, onSelect, onCreate, onImport }: ClusterListProps) {
  const latestJobs = new Map<number, JobSummary>();
  for (const job of jobs) {
    const current = latestJobs.get(job.clusterId);
    if (!current || isJobNewer(job, current)) {
      latestJobs.set(job.clusterId, job);
    }
  }

  return (
    <>
      <nav className="cluster-nav" aria-label="Cluster navigation">
        <h2 id="cluster-nav-heading">Clusters</h2>
        <ul className="cluster-nav__list">
          {clusters.map((cluster) => (
            <li key={cluster.id} className="cluster-nav__item">
              <label className="cluster-nav__choice">
                <input
                  className="cluster-nav__radio"
                  type="radio"
                  name="selected-cluster"
                  checked={selectedSlug === cluster.slug}
                  onChange={() => onSelect(cluster.slug)}
                />
                <span className="cluster-nav__button">
                  <strong className="cluster-nav__display-name">{cluster.displayName}</strong>
                  <span className="cluster-nav__meta">
                    <span className="cluster-nav__slug">{cluster.slug}</span>
                    <StatusBadge status={cluster.status} />
                  </span>
                  <span className="cluster-nav__summary">
                    <span className="cluster-nav__summary-line">
                      {formatLatestAction(latestJobs.get(cluster.id))}
                    </span>
                    <span className="cluster-nav__summary-line">
                      {formatUpdatedAt(cluster.updatedAt)}
                    </span>
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </nav>
      <section className="cluster-management" aria-labelledby="cluster-management-heading">
        <h2 id="cluster-management-heading">Create cluster</h2>
        <p className="cluster-management__copy">
          Standard closure is the primary path. Use guided steps to create a playable Master/Caves layout.
        </p>
        <CreateClusterWizard onSubmit={onCreate} />
        <ImportClusterForm onSubmit={onImport} />
      </section>
    </>
  );
}

type ImportClusterFormProps = {
  onSubmit: (input: ClusterMutationInput) => Promise<void> | void;
};

function ImportClusterForm({ onSubmit }: ImportClusterFormProps) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const formID = "cluster-import-form";

  function toggleOpen() {
    setOpen((current) => !current);
    if (errorMessage) {
      setErrorMessage(undefined);
    }
  }

  return (
    <section className="cluster-import" aria-label="Import existing cluster">
      <div className="cluster-import__header">
        <h3>Import existing cluster</h3>
        <button
          type="button"
          disabled={pending}
          aria-expanded={open}
          aria-controls={formID}
          onClick={toggleOpen}
        >
          {open ? "Hide import form" : "Open import form"}
        </button>
      </div>
      <p className="cluster-import__copy">Keep this path for existing worlds that already live on disk.</p>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {open ? (
        <form
          id={formID}
          className="cluster-management__form cluster-import__form"
          onChange={() => {
            if (errorMessage) {
              setErrorMessage(undefined);
            }
          }}
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const slug = String(formData.get("slug") ?? "").trim();
            const displayName = String(formData.get("displayName") ?? "").trim();
            const clusterName = String(formData.get("clusterName") ?? "").trim();
            const baseDir = String(formData.get("baseDir") ?? "").trim();

            if (slug === "") {
              setErrorMessage("Slug is required");
              return;
            }
            if (displayName === "") {
              setErrorMessage("Display name is required");
              return;
            }
            if (clusterName === "") {
              setErrorMessage("Cluster name is required");
              return;
            }
            if (baseDir === "") {
              setErrorMessage("Import path is required");
              return;
            }

            try {
              setPending(true);
              await onSubmit({
                mode: "import",
                slug,
                displayName,
                clusterName,
                baseDir,
              });
              setErrorMessage(undefined);
              form.reset();
              setOpen(false);
            } catch (error) {
              setErrorMessage(getErrorMessage(error, "Failed to import cluster"));
            } finally {
              setPending(false);
            }
          }}
        >
          <div>
            <label htmlFor="import-slug">Import slug</label>
            <input id="import-slug" name="slug" type="text" disabled={pending} />
          </div>
          <div>
            <label htmlFor="import-display-name">Import display name</label>
            <input id="import-display-name" name="displayName" type="text" disabled={pending} />
          </div>
          <div>
            <label htmlFor="import-cluster-name">Import cluster name</label>
            <input id="import-cluster-name" name="clusterName" type="text" disabled={pending} />
          </div>
          <div>
            <label htmlFor="import-base-dir">Import path</label>
            <input id="import-base-dir" name="baseDir" type="text" disabled={pending} />
          </div>
          <button type="submit" disabled={pending}>Import cluster</button>
        </form>
      ) : null}
    </section>
  );
}

function formatLatestAction(job?: JobSummary) {
  if (!job) {
    return "No recent actions";
  }

  return `${toSentenceCase(job.jobType)} ${job.status}`;
}

function formatUpdatedAt(value?: string) {
  if (!value) {
    return "Updated time unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Updated time unavailable";
  }

  return `Updated ${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function toSentenceCase(value: string) {
  if (value.trim() === "") {
    return "Unknown action";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isJobNewer(candidate: JobSummary, current: JobSummary) {
  const candidateTime = getJobTimestamp(candidate);
  const currentTime = getJobTimestamp(current);

  if (candidateTime === currentTime) {
    return candidate.id > current.id;
  }

  return candidateTime > currentTime;
}

function getJobTimestamp(job: JobSummary) {
  const value = job.finishedAt ?? job.startedAt;
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

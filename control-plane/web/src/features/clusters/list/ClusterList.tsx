import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { ClusterSummary, JobSummary } from "../../../lib/api";

type ClusterListProps = {
  clusters: ClusterSummary[];
  jobs?: JobSummary[];
  selectedSlug?: string;
  onSelect: (slug: string) => void;
  onOpenWorkspace: () => void;
};

export function ClusterList({ clusters, jobs = [], selectedSlug, onSelect, onOpenWorkspace }: ClusterListProps) {
  const latestJobs = new Map<number, JobSummary>();
  for (const job of jobs) {
    const current = latestJobs.get(job.clusterId);
    if (!current || isJobNewer(job, current)) {
      latestJobs.set(job.clusterId, job);
    }
  }

  return (
    <>
      <div className="cluster-nav__workspace-entry">
        <button type="button" className="cluster-nav__workspace-button" onClick={onOpenWorkspace}>Open workspace</button>
        <p className="cluster-nav__workspace-copy">Create new clusters or import existing worlds from the main workspace.</p>
      </div>
      <nav className="cluster-nav" aria-label="Cluster navigation">
        <h2 id="cluster-nav-heading">Clusters</h2>
        {clusters.length > 0 ? (
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
        ) : (
          <p className="cluster-nav__empty">No managed clusters yet. Open the workspace to provision or import one.</p>
        )}
      </nav>
    </>
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

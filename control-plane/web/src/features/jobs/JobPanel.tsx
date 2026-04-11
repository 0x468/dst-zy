import { Panel } from "../../components/ui/Panel";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { JobSummary } from "../../lib/api";

type JobPanelProps = {
  jobs: JobSummary[];
};

export function JobPanel({ jobs }: JobPanelProps) {
  return (
    <Panel title="Recent jobs" eyebrow="Operations log" className="record-panel">
      {jobs.length === 0 ? (
        <p className="record-panel__empty">No jobs have been recorded for this cluster yet.</p>
      ) : (
        <ul className="record-panel__list">
          {jobs.map((job) => (
            <li key={job.id} className="record-panel__item">
              <div className="record-panel__summary">
                <strong>{job.jobType}</strong>
                <StatusBadge status={job.status} />
              </div>
              {job.stderrExcerpt ? <p className="record-panel__excerpt record-panel__excerpt--error">{job.stderrExcerpt}</p> : null}
              {job.stdoutExcerpt ? <p className="record-panel__excerpt">{job.stdoutExcerpt}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

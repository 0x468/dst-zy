import type { JobSummary } from "../../lib/api";

type JobPanelProps = {
  jobs: JobSummary[];
};

export function JobPanel({ jobs }: JobPanelProps) {
  return (
    <section>
      <h2>Recent jobs</h2>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            <strong>{job.jobType}</strong>
            <span>{job.status}</span>
            {job.stderrExcerpt ? <p>{job.stderrExcerpt}</p> : null}
            {job.stdoutExcerpt ? <p>{job.stdoutExcerpt}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

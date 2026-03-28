import type { AuditSummary } from "../../lib/api";

type AuditPanelProps = {
  audit: AuditSummary[];
};

export function AuditPanel({ audit }: AuditPanelProps) {
  return (
    <section>
      <h2>Recent audit</h2>
      {audit.length === 0 ? (
        <p>No audit entries yet.</p>
      ) : (
        <ul>
          {audit.map((record) => (
            <li key={record.id}>
              <strong>{record.action}</strong>
              <span>{record.actor}</span>
              {record.summary ? <p>{record.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

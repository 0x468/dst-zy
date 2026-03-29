import type { AuditSummary } from "../../lib/api";

type AuditPanelProps = {
  audit: AuditSummary[];
  clusterSlug?: string;
};

export function AuditPanel({ audit, clusterSlug }: AuditPanelProps) {
  const visibleAudit = audit.filter((record) => {
    if (record.targetType === "auth") {
      return true;
    }
    if (!clusterSlug) {
      return true;
    }

    return record.summary.includes(`slug=${clusterSlug}`);
  });

  return (
    <section>
      <h2>Recent audit</h2>
      {visibleAudit.length === 0 ? (
        <p>No audit entries yet.</p>
      ) : (
        <ul>
          {visibleAudit.map((record) => (
            <li key={record.id}>
              <strong>{record.action}</strong>
              <span>{record.actor}</span>
              <time dateTime={record.createdAt}>{formatAuditTimestamp(record.createdAt)}</time>
              {record.summary ? <p>{record.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatAuditTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC");
}

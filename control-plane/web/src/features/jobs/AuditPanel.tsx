import { Panel } from "../../components/ui/Panel";
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
  const authAudit = visibleAudit.filter((record) => record.targetType === "auth");
  const clusterAudit = visibleAudit.filter((record) => record.targetType !== "auth");

  return (
    <Panel title="Recent audit" eyebrow="Event stream" className="audit-panel">
      {visibleAudit.length === 0 ? (
        <p className="record-panel__empty">No audit entries yet.</p>
      ) : (
        <>
          {authAudit.length > 0 ? <AuditGroup title="Auth events" audit={authAudit} /> : null}
          {clusterAudit.length > 0 ? <AuditGroup title="Cluster events" audit={clusterAudit} /> : null}
        </>
      )}
    </Panel>
  );
}

type AuditGroupProps = {
  title: string;
  audit: AuditSummary[];
};

function AuditGroup({ title, audit }: AuditGroupProps) {
  const streamLabel = `${title} stream`;

  return (
    <section className="audit-panel__group">
      <div className="audit-panel__group-header">
        <h3>{title}</h3>
        <span>{formatEventCount(audit.length)}</span>
      </div>
      <ul className="audit-panel__stream" aria-label={streamLabel}>
        {audit.map((record) => (
          <li key={record.id} className="audit-panel__item">
            <div className="record-panel__summary">
              <strong>{labelAuditAction(record.action)}</strong>
              <span>{record.actor}</span>
            </div>
            <time dateTime={record.createdAt}>{formatAuditTimestamp(record.createdAt)}</time>
            {record.summary ? <p className="record-panel__excerpt">{record.summary}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatEventCount(count: number) {
  return count === 1 ? "1 event" : `${count} events`;
}

function formatAuditTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC");
}

function labelAuditAction(action: string) {
  switch (action) {
    case "login_success":
      return "Signed in";
    case "login_failed":
      return "Sign-in failed";
    case "login_rate_limited":
      return "Sign-in rate limited";
    case "logout_success":
      return "Signed out";
    case "cluster_create":
      return "Created cluster";
    case "cluster_import":
      return "Imported cluster";
    case "config_save":
      return "Saved config";
    case "cluster_action_start":
      return "Started cluster";
    case "cluster_action_stop":
      return "Stopped cluster";
    case "cluster_action_restart":
      return "Restarted cluster";
    case "cluster_action_update":
      return "Updated cluster";
    case "cluster_action_validate":
      return "Validated cluster";
    case "cluster_action_backup":
      return "Created backup";
    default:
      return action;
  }
}

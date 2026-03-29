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
    <section>
      <h2>Recent audit</h2>
      {visibleAudit.length === 0 ? (
        <p>No audit entries yet.</p>
      ) : (
        <>
          {authAudit.length > 0 ? <AuditGroup title="Auth events" audit={authAudit} /> : null}
          {clusterAudit.length > 0 ? <AuditGroup title="Cluster events" audit={clusterAudit} /> : null}
        </>
      )}
    </section>
  );
}

type AuditGroupProps = {
  title: string;
  audit: AuditSummary[];
};

function AuditGroup({ title, audit }: AuditGroupProps) {
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {audit.map((record) => (
          <li key={record.id}>
            <strong>{labelAuditAction(record.action)}</strong>
            <span>{record.actor}</span>
            <time dateTime={record.createdAt}>{formatAuditTimestamp(record.createdAt)}</time>
            {record.summary ? <p>{record.summary}</p> : null}
          </li>
        ))}
      </ul>
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
    default:
      return action;
  }
}

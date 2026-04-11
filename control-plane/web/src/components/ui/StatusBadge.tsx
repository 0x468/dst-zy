type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = getStatusTone(status);

  return <span className={`status-badge status-badge--${tone}`}>{status}</span>;
}

function getStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "running" || normalized === "ready" || normalized === "ok") {
    return "success";
  }
  if (normalized === "stopped" || normalized === "paused") {
    return "warning";
  }
  if (normalized === "failed" || normalized === "error" || normalized === "offline") {
    return "danger";
  }

  return "neutral";
}

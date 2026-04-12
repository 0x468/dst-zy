import { Panel } from "../../components/ui/Panel";
import type { ClusterLogSource } from "../../lib/api";

type LogsPanelProps = {
  selectedSource: ClusterLogSource;
  content: string;
  updatedAt?: string;
  pending?: boolean;
  errorMessage?: string;
  onSelectSource: (source: ClusterLogSource) => void;
  onRefresh: () => Promise<void> | void;
};

const sourceOptions: Array<{ value: ClusterLogSource; label: string }> = [
  { value: "jobs", label: "Task logs" },
  { value: "master", label: "Master logs" },
  { value: "caves", label: "Caves logs" },
];

export function LogsPanel({
  selectedSource,
  content,
  updatedAt,
  pending = false,
  errorMessage,
  onSelectSource,
  onRefresh,
}: LogsPanelProps) {
  return (
    <Panel
      title="Logs"
      eyebrow="Recent output"
      className="logs-panel"
      actions={(
        <button type="button" disabled={pending} onClick={() => void onRefresh()}>
          Refresh logs
        </button>
      )}
    >
      <div className="logs-panel__toolbar" role="group" aria-label="Log sources">
        {sourceOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`logs-panel__source${selectedSource === option.value ? " logs-panel__source--active" : ""}`}
            aria-pressed={selectedSource === option.value}
            disabled={pending}
            onClick={() => onSelectSource(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {updatedAt ? <p className="logs-panel__meta">Updated {formatTimestamp(updatedAt)}</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <pre className="logs-panel__content">{content.trim() !== "" ? content : "No log output yet."}</pre>
    </Panel>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC");
}

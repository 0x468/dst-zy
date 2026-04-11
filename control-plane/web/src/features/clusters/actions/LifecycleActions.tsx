import { useState } from "react";

import { Panel } from "../../../components/ui/Panel";

type LifecycleActionsProps = {
  onAction: (action: string) => Promise<void> | void;
};

const lifecycleActions = [
  { label: "Start", action: "start", description: "Bring the cluster stack online." },
  { label: "Stop", action: "stop", description: "Drain and stop running shard services." },
  { label: "Restart", action: "restart", description: "Recycle the full stack with one job." },
  { label: "Update", action: "update", description: "Pull the latest server binaries." },
  { label: "Validate", action: "validate", description: "Run the current config validation pass." },
  { label: "Backup", action: "backup", description: "Queue a fresh restore point for this cluster." },
];

export function LifecycleActions({ onAction }: LifecycleActionsProps) {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  return (
    <Panel title="Actions" eyebrow="Control surface" className="lifecycle-actions">
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <p className="lifecycle-actions__copy">
        Run cluster operations from a single control surface without leaving the detail workspace.
      </p>
      <div className="lifecycle-actions__grid">
        {lifecycleActions.map((action) => (
          <div key={action.action} className="lifecycle-actions__item">
            <button
              className="lifecycle-actions__button"
              type="button"
              disabled={pending}
              onClick={async () => {
                setPending(true);

                try {
                  await onAction(action.action);
                  setErrorMessage(undefined);
                } catch (error) {
                  setErrorMessage(getErrorMessage(error, `Failed to run ${action.action}`));
                } finally {
                  setPending(false);
                }
              }}
            >
              {action.label}
            </button>
            <p className="lifecycle-actions__hint">{action.description}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

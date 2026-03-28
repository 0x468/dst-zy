import { useState } from "react";

type LifecycleActionsProps = {
  onAction: (action: string) => Promise<void> | void;
};

const lifecycleActions = ["Start", "Stop", "Restart", "Update", "Validate"];

export function LifecycleActions({ onAction }: LifecycleActionsProps) {
  const [pending, setPending] = useState(false);

  return (
    <section>
      <h2>Actions</h2>
      <div>
        {lifecycleActions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);

              try {
                await onAction(action.toLowerCase());
              } finally {
                setPending(false);
              }
            }}
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}

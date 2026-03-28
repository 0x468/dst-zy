import { useState } from "react";

type LifecycleActionsProps = {
  onAction: (action: string) => Promise<void> | void;
};

const lifecycleActions = ["Start", "Stop", "Restart", "Update", "Validate"];

export function LifecycleActions({ onAction }: LifecycleActionsProps) {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  return (
    <section>
      <h2>Actions</h2>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
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
                setErrorMessage(undefined);
              } catch (error) {
                setErrorMessage(getErrorMessage(error, `Failed to run ${action.toLowerCase()}`));
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

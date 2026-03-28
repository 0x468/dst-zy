type LifecycleActionsProps = {
  onAction: (action: string) => void;
};

const lifecycleActions = ["Start", "Stop", "Restart", "Update", "Validate"];

export function LifecycleActions({ onAction }: LifecycleActionsProps) {
  return (
    <section>
      <h2>Actions</h2>
      <div>
        {lifecycleActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => {
              onAction(action.toLowerCase());
            }}
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}

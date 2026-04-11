import { useEffect, useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import type { ClusterConfigSnapshot } from "../../../lib/api";

type ClusterConfigFormProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

export function ClusterConfigForm({ snapshot, onSave }: ClusterConfigFormProps) {
  const [draft, setDraft] = useState(snapshot);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    setDraft(snapshot);
    setErrorMessage(undefined);
  }, [snapshot]);

  return (
    <Panel title="Config panel" eyebrow="Cluster settings" className="cluster-config-panel">
      <form
        className="cluster-config-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);

          try {
            await onSave(draft);
            setErrorMessage(undefined);
          } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to save config"));
          } finally {
            setPending(false);
          }
        }}
      >
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <p className="cluster-config-form__copy">
          Update the identity players see first while keeping the current shard wiring intact.
        </p>
        <div className="cluster-config-form__meta">
          <div className="cluster-config-form__meta-item">
            <span>Game mode</span>
            <strong>{snapshot.gameMode}</strong>
          </div>
          <div className="cluster-config-form__meta-item">
            <span>Master port</span>
            <strong>{snapshot.master.serverPort}</strong>
          </div>
          <div className="cluster-config-form__meta-item">
            <span>Caves port</span>
            <strong>{snapshot.caves.serverPort}</strong>
          </div>
        </div>
        <div className="cluster-config-form__grid">
          <div className="cluster-config-form__field">
            <label htmlFor="cluster-name">Cluster name</label>
            <input
              id="cluster-name"
              value={draft.clusterName}
              disabled={pending}
              onChange={(event) => {
                setDraft({ ...draft, clusterName: event.target.value });
              }}
            />
          </div>

          <div className="cluster-config-form__field">
            <label htmlFor="cluster-description">Cluster description</label>
            <input
              id="cluster-description"
              aria-label="Cluster description"
              value={draft.clusterDescription}
              disabled={pending}
              onChange={(event) => {
                setDraft({ ...draft, clusterDescription: event.target.value });
              }}
            />
          </div>
        </div>

        <div className="cluster-config-form__actions">
          <button type="submit" disabled={pending}>Save config</button>
        </div>
      </form>
    </Panel>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

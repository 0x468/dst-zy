import { useEffect, useState } from "react";

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
    <form
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
      <div>
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

      <div>
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

      <button type="submit" disabled={pending}>Save config</button>
    </form>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

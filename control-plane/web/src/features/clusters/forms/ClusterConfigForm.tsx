import { useEffect, useState } from "react";

import type { ClusterConfigSnapshot } from "../../../lib/api";

type ClusterConfigFormProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

export function ClusterConfigForm({ snapshot, onSave }: ClusterConfigFormProps) {
  const [draft, setDraft] = useState(snapshot);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setDraft(snapshot);
  }, [snapshot]);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);

        try {
          await onSave(draft);
        } finally {
          setPending(false);
        }
      }}
    >
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

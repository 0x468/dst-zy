import { useState } from "react";

import type { ClusterConfigSnapshot } from "../../../lib/api";

type ClusterConfigFormProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => void;
};

export function ClusterConfigForm({ snapshot, onSave }: ClusterConfigFormProps) {
  const [draft, setDraft] = useState(snapshot);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <div>
        <label htmlFor="cluster-name">Cluster name</label>
        <input
          id="cluster-name"
          value={draft.clusterName}
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
          onChange={(event) => {
            setDraft({ ...draft, clusterDescription: event.target.value });
          }}
        />
      </div>

      <button type="submit">Save config</button>
    </form>
  );
}

import { useState } from "react";

import type { ClusterConfigSnapshot } from "../../lib/api";

type RawFileEditorProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => void;
};

export function RawFileEditor({ snapshot, onSave }: RawFileEditorProps) {
  const [clusterIni, setClusterIni] = useState(snapshot.rawFiles?.clusterIni ?? "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...snapshot,
          rawFiles: {
            clusterIni: clusterIni.trim(),
          },
        });
      }}
    >
      <div>
        <label htmlFor="cluster-ini">cluster.ini</label>
        <textarea
          id="cluster-ini"
          aria-label="cluster.ini"
          value={clusterIni}
          onChange={(event) => {
            setClusterIni(event.target.value);
          }}
          rows={10}
        />
      </div>

      <button type="submit">Save raw file</button>
    </form>
  );
}

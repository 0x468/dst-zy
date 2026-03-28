import { useEffect, useState } from "react";

import type { ClusterConfigSnapshot } from "../../lib/api";

type RawFileEditorProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

export function RawFileEditor({ snapshot, onSave }: RawFileEditorProps) {
  const [clusterIni, setClusterIni] = useState(snapshot.rawFiles?.clusterIni ?? "");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setClusterIni(snapshot.rawFiles?.clusterIni ?? "");
  }, [snapshot]);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);

        try {
          await onSave({
            ...snapshot,
            rawFiles: {
              clusterIni: clusterIni.trim(),
            },
          });
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <label htmlFor="cluster-ini">cluster.ini</label>
        <textarea
          id="cluster-ini"
          aria-label="cluster.ini"
          value={clusterIni}
          disabled={pending}
          onChange={(event) => {
            setClusterIni(event.target.value);
          }}
          rows={10}
        />
      </div>

      <button type="submit" disabled={pending}>Save raw file</button>
    </form>
  );
}

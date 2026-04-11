import { useEffect, useState } from "react";

import { Panel } from "../../components/ui/Panel";
import type { ClusterConfigSnapshot } from "../../lib/api";

type RawFileEditorProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

export function RawFileEditor({ snapshot, onSave }: RawFileEditorProps) {
  const [clusterIni, setClusterIni] = useState(snapshot.rawFiles?.clusterIni ?? "");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    setClusterIni(snapshot.rawFiles?.clusterIni ?? "");
    setErrorMessage(undefined);
  }, [snapshot]);

  return (
    <Panel title="Advanced editor" eyebrow="Raw configuration" tone="subtle" className="advanced-editor">
      <form
        className="advanced-editor__form"
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
            setErrorMessage(undefined);
          } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to save raw file"));
          } finally {
            setPending(false);
          }
        }}
      >
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <p className="advanced-editor__banner">Directly edit raw cluster.ini content.</p>
        <p className="advanced-editor__copy">
          Use advanced mode for direct file-level updates that should bypass the guided form.
        </p>
        <div className="advanced-editor__field">
          <label htmlFor="cluster-ini">cluster.ini</label>
          <textarea
            id="cluster-ini"
            aria-label="cluster.ini"
            value={clusterIni}
            disabled={pending}
            onChange={(event) => {
              setClusterIni(event.target.value);
            }}
            rows={14}
          />
        </div>

        <div className="advanced-editor__actions">
          <button type="submit" disabled={pending}>Save raw file</button>
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

import { useEffect, useRef, useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import type { ClusterConfigSnapshot } from "../../../lib/api";

type ClusterMetadataPanelProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

type ClusterMetadataDraft = {
  displayName: string;
  note: string;
};

export function ClusterMetadataPanel({ snapshot, onSave }: ClusterMetadataPanelProps) {
  const [draft, setDraft] = useState(() => buildDraft(snapshot));
  const draftRef = useRef(draft);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    const nextDraft = buildDraft(snapshot);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setErrorMessage(undefined);
  }, [snapshot]);

  function updateDraft(nextDraft: ClusterMetadataDraft) {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  return (
    <Panel title="Cluster metadata" eyebrow="Workspace identity" className="cluster-config-panel">
      <form
        className="cluster-config-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);

          try {
            await onSave(applyDraft(snapshot, draftRef.current));
            setErrorMessage(undefined);
          } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to save metadata"));
          } finally {
            setPending(false);
          }
        }}
      >
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <p className="cluster-config-form__copy">
          Control the operator-facing title and note shown across the workspace without reopening the cluster wizard.
        </p>
        <div className="cluster-config-form__grid">
          <div className="cluster-config-form__field">
            <label htmlFor="display-name">Display name</label>
            <input
              id="display-name"
              value={draft.displayName}
              disabled={pending}
              onChange={(event) => updateDraft({ ...draftRef.current, displayName: event.target.value })}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="operator-note">Operator note</label>
            <input
              id="operator-note"
              value={draft.note}
              disabled={pending}
              onChange={(event) => updateDraft({ ...draftRef.current, note: event.target.value })}
            />
          </div>
        </div>
        <div className="cluster-config-form__actions">
          <button type="submit" disabled={pending}>Save metadata</button>
        </div>
      </form>
    </Panel>
  );
}

function buildDraft(snapshot: ClusterConfigSnapshot): ClusterMetadataDraft {
  return {
    displayName: snapshot.displayName ?? "",
    note: snapshot.note ?? "",
  };
}

function applyDraft(snapshot: ClusterConfigSnapshot, draft: ClusterMetadataDraft): ClusterConfigSnapshot {
  return {
    ...snapshot,
    displayName: draft.displayName.trim(),
    note: draft.note.trim(),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

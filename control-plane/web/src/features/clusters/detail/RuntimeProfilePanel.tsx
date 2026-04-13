import { useEffect, useRef, useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import type { ClusterConfigSnapshot } from "../../../lib/api";

type RuntimeProfilePanelProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

type RuntimeProfileDraft = {
  timeZone: string;
  updateMode: string;
  serverModsUpdateMode: string;
};

const updateModeOptions = ["install-only", "update", "validate", "never"];
const serverModsUpdateModeOptions = ["runtime", "prewarm", "skip"];

export function RuntimeProfilePanel({ snapshot, onSave }: RuntimeProfilePanelProps) {
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

  function updateDraft(nextDraft: RuntimeProfileDraft) {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  return (
    <Panel title="Runtime profile" eyebrow="Managed env" className="cluster-config-panel">
      <form
        className="cluster-config-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);

          try {
            await onSave(applyDraft(snapshot, draftRef.current));
            setErrorMessage(undefined);
          } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to save runtime profile"));
          } finally {
            setPending(false);
          }
        }}
      >
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <p className="cluster-config-form__copy">
          Keep env-backed runtime settings inside the control plane instead of editing compose variables by hand.
        </p>
        <div className="cluster-config-form__grid">
          <div className="cluster-config-form__field">
            <label htmlFor="time-zone">Time zone</label>
            <input
              id="time-zone"
              value={draft.timeZone}
              disabled={pending}
              onChange={(event) => updateDraft({ ...draftRef.current, timeZone: event.target.value })}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="update-mode">Update mode</label>
            <select
              id="update-mode"
              value={draft.updateMode}
              disabled={pending}
              onChange={(event) => updateDraft({ ...draftRef.current, updateMode: event.target.value })}
            >
              {updateModeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="server-mods-update-mode">Server mods update mode</label>
            <select
              id="server-mods-update-mode"
              value={draft.serverModsUpdateMode}
              disabled={pending}
              onChange={(event) => updateDraft({ ...draftRef.current, serverModsUpdateMode: event.target.value })}
            >
              {serverModsUpdateModeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="cluster-config-form__actions">
          <button type="submit" disabled={pending}>Save runtime profile</button>
        </div>
      </form>
    </Panel>
  );
}

function buildDraft(snapshot: ClusterConfigSnapshot): RuntimeProfileDraft {
  return {
    timeZone: snapshot.timeZone ?? "Asia/Shanghai",
    updateMode: snapshot.updateMode ?? "install-only",
    serverModsUpdateMode: snapshot.serverModsUpdateMode ?? "runtime",
  };
}

function applyDraft(snapshot: ClusterConfigSnapshot, draft: RuntimeProfileDraft): ClusterConfigSnapshot {
  return {
    ...snapshot,
    timeZone: draft.timeZone.trim(),
    updateMode: draft.updateMode,
    serverModsUpdateMode: draft.serverModsUpdateMode,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

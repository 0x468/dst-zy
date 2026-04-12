import { useEffect, useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import type { ClusterConfigSnapshot } from "../../../lib/api";

type ClusterConfigFormProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

export function ClusterConfigForm({ snapshot, onSave }: ClusterConfigFormProps) {
  const [draft, setDraft] = useState(() => normalizeSnapshot(snapshot));
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const gameModeOptions = withCurrentOption(["survival", "endless", "wilderness", "relaxed"], draft.gameMode);
  const clusterIntentionOptions = withCurrentOption(
    ["", "cooperative", "social", "competitive", "madness"],
    draft.clusterIntention ?? "",
  );

  useEffect(() => {
    setDraft(normalizeSnapshot(snapshot));
    setErrorMessage(undefined);
  }, [snapshot]);

  return (
    <Panel title="Base configuration" eyebrow="Cluster settings" className="cluster-config-panel">
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
            <strong>{draft.gameMode}</strong>
          </div>
          <div className="cluster-config-form__meta-item">
            <span>Max players</span>
            <strong>{draft.maxPlayers ?? 0}</strong>
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
            <label htmlFor="game-mode">Game mode</label>
            <select
              id="game-mode"
              value={draft.gameMode}
              disabled={pending}
              onChange={(event) => {
                setDraft({ ...draft, gameMode: event.target.value });
              }}
            >
              {gameModeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="cluster-config-form__field">
            <label htmlFor="max-players">Max players</label>
            <input
              id="max-players"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.maxPlayers ?? ""}
              disabled={pending}
              onChange={(event) => {
                const value = event.target.value.trim();
                if (value === "") {
                  setDraft({ ...draft, maxPlayers: undefined });
                  return;
                }
                if (!/^\d+$/.test(value)) {
                  return;
                }
                setDraft({ ...draft, maxPlayers: Number(value) });
              }}
            />
          </div>

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

          <div className="cluster-config-form__field">
            <label htmlFor="cluster-key">Cluster key</label>
            <input
              id="cluster-key"
              value={draft.clusterKey}
              disabled={pending}
              onChange={(event) => {
                setDraft({ ...draft, clusterKey: event.target.value });
              }}
            />
          </div>

          <div className="cluster-config-form__field">
            <label htmlFor="cluster-intention">Cluster intention</label>
            <select
              id="cluster-intention"
              value={draft.clusterIntention ?? ""}
              disabled={pending}
              onChange={(event) => {
                setDraft({ ...draft, clusterIntention: event.target.value });
              }}
            >
              {clusterIntentionOptions.map((option) => (
                <option key={option || "unset"} value={option}>
                  {option === "" ? "unset" : option}
                </option>
              ))}
            </select>
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

function normalizeSnapshot(snapshot: ClusterConfigSnapshot): ClusterConfigSnapshot {
  return {
    ...snapshot,
    maxPlayers: snapshot.maxPlayers ?? 6,
    clusterIntention: snapshot.clusterIntention ?? "",
  };
}

function withCurrentOption(options: string[], current: string) {
  if (current.trim() === "" || options.includes(current)) {
    return options;
  }

  return [current, ...options];
}

import { useEffect, useRef, useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import type { ClusterConfigSnapshot, ClusterSummary } from "../../../lib/api";

type ConnectionPanelProps = {
  cluster: ClusterSummary;
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

type PortDraft = {
  masterPort: string;
  masterShardPort: string;
  cavesShardPort: string;
  masterSteamPort: string;
  cavesSteamPort: string;
  masterAuthPort: string;
  cavesAuthPort: string;
};

export function ConnectionPanel({ cluster, snapshot, onSave }: ConnectionPanelProps) {
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

  function updatePort(updater: (current: PortDraft) => PortDraft) {
    setDraft((current) => {
      const nextDraft = updater(current);
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }

  return (
    <Panel title="Ports and connection" eyebrow="Runtime routing" className="connection-panel">
      <form
        className="cluster-config-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);

          try {
            await onSave(applyDraft(snapshot, draftRef.current));
            setErrorMessage(undefined);
          } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to save ports"));
          } finally {
            setPending(false);
          }
        }}
      >
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <p className="cluster-config-form__copy">
          Host mapping stays read-only here. Edit shard listen ports and Steam/Auth lanes that live inside cluster files.
        </p>
        <dl className="connection-panel__grid">
          <div className="connection-panel__item">
            <dt>Master host port</dt>
            <dd>{cluster.masterHostPort || snapshot.master.serverPort}</dd>
          </div>
          <div className="connection-panel__item">
            <dt>Caves host port</dt>
            <dd>{cluster.cavesHostPort || snapshot.caves.serverPort}</dd>
          </div>
          <div className="connection-panel__item">
            <dt>Master Steam host port</dt>
            <dd>{cluster.masterSteamHostPort || snapshot.master.masterServerPort}</dd>
          </div>
          <div className="connection-panel__item">
            <dt>Caves Steam host port</dt>
            <dd>{cluster.cavesSteamHostPort || snapshot.caves.masterServerPort}</dd>
          </div>
        </dl>
        <div className="cluster-config-form__grid">
          <div className="cluster-config-form__field">
            <label htmlFor="cluster-bus-port">Cluster bus port</label>
            <input
              id="cluster-bus-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.masterPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "masterPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="master-shard-port">Master shard port</label>
            <input
              id="master-shard-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.masterShardPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "masterShardPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="caves-shard-port">Caves shard port</label>
            <input
              id="caves-shard-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.cavesShardPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "cavesShardPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="master-steam-port">Master Steam port</label>
            <input
              id="master-steam-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.masterSteamPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "masterSteamPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="caves-steam-port">Caves Steam port</label>
            <input
              id="caves-steam-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.cavesSteamPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "cavesSteamPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="master-auth-port">Master auth port</label>
            <input
              id="master-auth-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.masterAuthPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "masterAuthPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="caves-auth-port">Caves auth port</label>
            <input
              id="caves-auth-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.cavesAuthPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "cavesAuthPort", updatePort)}
            />
          </div>
        </div>
        <div className="cluster-config-form__actions">
          <button type="submit" disabled={pending}>Save ports</button>
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

function buildDraft(snapshot: ClusterConfigSnapshot): PortDraft {
  return {
    masterPort: String(snapshot.masterPort),
    masterShardPort: String(snapshot.master.serverPort),
    cavesShardPort: String(snapshot.caves.serverPort),
    masterSteamPort: String(snapshot.master.masterServerPort),
    cavesSteamPort: String(snapshot.caves.masterServerPort),
    masterAuthPort: String(snapshot.master.authenticationPort),
    cavesAuthPort: String(snapshot.caves.authenticationPort),
  };
}

function updateDraftValue(
  value: string,
  key: keyof PortDraft,
  updatePort: (updater: (current: PortDraft) => PortDraft) => void,
) {
  if (!/^\d*$/.test(value)) {
    return;
  }

  updatePort((current) => ({ ...current, [key]: value }));
}

function applyDraft(snapshot: ClusterConfigSnapshot, draft: PortDraft): ClusterConfigSnapshot {
  return {
    ...snapshot,
    masterPort: parsePort(draft.masterPort),
    master: {
      ...snapshot.master,
      serverPort: parsePort(draft.masterShardPort),
      masterServerPort: parsePort(draft.masterSteamPort),
      authenticationPort: parsePort(draft.masterAuthPort),
    },
    caves: {
      ...snapshot.caves,
      serverPort: parsePort(draft.cavesShardPort),
      masterServerPort: parsePort(draft.cavesSteamPort),
      authenticationPort: parsePort(draft.cavesAuthPort),
    },
  };
}

function parsePort(value: string) {
  const trimmed = value.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) {
    return 0;
  }

  return Number(trimmed);
}

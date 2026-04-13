import { useEffect, useRef, useState } from "react";

import { Panel } from "../../../components/ui/Panel";
import type { ClusterConfigSnapshot } from "../../../lib/api";

type ConnectionPanelProps = {
  snapshot: ClusterConfigSnapshot;
  onSave: (snapshot: ClusterConfigSnapshot) => Promise<void> | void;
};

type PortDraft = {
  masterHostPort: string;
  cavesHostPort: string;
  masterSteamHostPort: string;
  cavesSteamHostPort: string;
  masterPort: string;
  masterShardPort: string;
  cavesShardPort: string;
  masterSteamPort: string;
  cavesSteamPort: string;
  masterAuthPort: string;
  cavesAuthPort: string;
};

export function ConnectionPanel({ snapshot, onSave }: ConnectionPanelProps) {
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
          Adjust both host mapping and shard listen ports from one form so runtime routing and published ports stay aligned.
        </p>
        <div className="cluster-config-form__grid">
          <div className="cluster-config-form__field">
            <label htmlFor="master-host-port">Master host port</label>
            <input
              id="master-host-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.masterHostPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "masterHostPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="caves-host-port">Caves host port</label>
            <input
              id="caves-host-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.cavesHostPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "cavesHostPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="master-steam-host-port">Master Steam host port</label>
            <input
              id="master-steam-host-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.masterSteamHostPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "masterSteamHostPort", updatePort)}
            />
          </div>
          <div className="cluster-config-form__field">
            <label htmlFor="caves-steam-host-port">Caves Steam host port</label>
            <input
              id="caves-steam-host-port"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.cavesSteamHostPort}
              disabled={pending}
              onChange={(event) => updateDraftValue(event.target.value, "cavesSteamHostPort", updatePort)}
            />
          </div>
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
    masterHostPort: String(snapshot.masterHostPort ?? 0),
    cavesHostPort: String(snapshot.cavesHostPort ?? 0),
    masterSteamHostPort: String(snapshot.masterSteamHostPort ?? 0),
    cavesSteamHostPort: String(snapshot.cavesSteamHostPort ?? 0),
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
    masterHostPort: parsePort(draft.masterHostPort),
    cavesHostPort: parsePort(draft.cavesHostPort),
    masterSteamHostPort: parsePort(draft.masterSteamHostPort),
    cavesSteamHostPort: parsePort(draft.cavesSteamHostPort),
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

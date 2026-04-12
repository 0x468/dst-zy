import { useEffect, useState } from "react";

import {
  previewClusterPreflight,
  type ClusterMutationInput,
  type PreflightReport,
} from "../../../lib/api";
import { PreflightPanel } from "../../preflight/PreflightPanel";

type CreateClusterWizardProps = {
  onSubmit: (input: ClusterMutationInput) => Promise<void> | void;
};

type WizardStep = "basics" | "network" | "auth" | "review";

type WizardState = {
  slug: string;
  displayName: string;
  clusterName: string;
  clusterDescription: string;
  clusterPassword: string;
  gameMode: string;
  maxPlayers: string;
  pvp: boolean;
  pauseWhenEmpty: boolean;
  intent: string;
  timeZone: string;
  masterHostPort: string;
  cavesHostPort: string;
  steamHostPort: string;
  cavesSteamHostPort: string;
  clusterToken: string;
  clusterKey: string;
  autoStart: boolean;
};

const stepOrder: WizardStep[] = ["basics", "network", "auth", "review"];

const initialState: WizardState = {
  slug: "",
  displayName: "",
  clusterName: "",
  clusterDescription: "",
  clusterPassword: "",
  gameMode: "survival",
  maxPlayers: "6",
  pvp: false,
  pauseWhenEmpty: true,
  intent: "cooperative",
  timeZone: "Asia/Shanghai",
  masterHostPort: "11000",
  cavesHostPort: "11001",
  steamHostPort: "27018",
  cavesSteamHostPort: "27019",
  clusterToken: "",
  clusterKey: "",
  autoStart: true,
};

export function CreateClusterWizard({ onSubmit }: CreateClusterWizardProps) {
  const [step, setStep] = useState<WizardStep>("basics");
  const [state, setState] = useState<WizardState>(initialState);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [preflightReport, setPreflightReport] = useState<PreflightReport>();
  const [preflightPending, setPreflightPending] = useState(false);
  const [preflightErrorMessage, setPreflightErrorMessage] = useState<string>();

  const stepIndex = stepOrder.indexOf(step);

  useEffect(() => {
    if (step !== "review") {
      return;
    }

    let cancelled = false;

    async function loadPreflight() {
      let nextInput: ClusterMutationInput;
      try {
        nextInput = buildCreateInput(state, parsePort, parseMaxPlayers);
      } catch (error) {
        if (!cancelled) {
          setPreflightReport(undefined);
          setPreflightErrorMessage(getErrorMessage(error, "Failed to prepare preflight preview"));
        }
        return;
      }

      setPreflightPending(true);
      try {
        const nextReport = await previewClusterPreflight(nextInput);
        if (cancelled) {
          return;
        }
        setPreflightReport(nextReport);
        setPreflightErrorMessage(undefined);
      } catch (error) {
        if (!cancelled) {
          setPreflightReport(undefined);
          setPreflightErrorMessage(getErrorMessage(error, "Failed to load preflight preview"));
        }
      } finally {
        if (!cancelled) {
          setPreflightPending(false);
        }
      }
    }

    void loadPreflight();

    return () => {
      cancelled = true;
    };
  }, [state, step]);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errorMessage) {
      setErrorMessage(undefined);
    }
    if (preflightErrorMessage) {
      setPreflightErrorMessage(undefined);
    }
  }

  function parsePort(raw: string, label: string) {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(`${label} must be a valid port`);
    }
    return value;
  }

  function parseMaxPlayers(raw: string) {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 64) {
      throw new Error("Max players must be an integer between 1 and 64");
    }
    return value;
  }

  function validateStep(current: WizardStep): string | undefined {
    if (current === "basics") {
      if (state.slug.trim() === "") {
        return "Slug is required";
      }
      if (state.displayName.trim() === "") {
        return "Display name is required";
      }
      if (state.clusterName.trim() === "") {
        return "Cluster name is required";
      }
      try {
        parseMaxPlayers(state.maxPlayers);
      } catch (error) {
        return getErrorMessage(error, "Invalid basic settings");
      }
    }
    if (current === "network") {
      try {
        const ports = [
          parsePort(state.masterHostPort, "Master host UDP port"),
          parsePort(state.cavesHostPort, "Caves host UDP port"),
          parsePort(state.steamHostPort, "Master Steam port"),
          parsePort(state.cavesSteamHostPort, "Caves Steam port"),
        ];
        const seen = new Set(ports);
        if (seen.size !== ports.length) {
          return "Ports must be unique";
        }
      } catch (error) {
        return getErrorMessage(error, "Invalid network settings");
      }
    }
    if (current === "auth") {
      if (state.clusterToken.trim() === "") {
        return "Cluster token is required";
      }
      if (state.clusterKey.trim() === "") {
        return "Cluster key is required";
      }
    }
    return undefined;
  }

  async function moveNext() {
    const error = validateStep(step);
    if (error) {
      setErrorMessage(error);
      return;
    }
    const nextStep = stepOrder[stepIndex + 1];
    if (nextStep) {
      setErrorMessage(undefined);
      setStep(nextStep);
    }
  }

  function moveBack() {
    const previousStep = stepOrder[stepIndex - 1];
    if (previousStep) {
      setErrorMessage(undefined);
      setStep(previousStep);
    }
  }

  async function submitCreate() {
    const error = validateStep("auth");
    if (error) {
      setErrorMessage(error);
      setStep("auth");
      return;
    }

    try {
      setPending(true);
      await onSubmit(buildCreateInput(state, parsePort, parseMaxPlayers));
      setErrorMessage(undefined);
      setPreflightReport(undefined);
      setPreflightErrorMessage(undefined);
      setStep("basics");
      setState(initialState);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to create cluster"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="cluster-wizard" aria-labelledby="cluster-wizard-heading">
      <div className="cluster-wizard__header">
        <h3 id="cluster-wizard-heading">Standard closure wizard</h3>
        <p className="cluster-wizard__copy">Create a playable Master/Caves pair with guided defaults.</p>
      </div>
      <ol className="cluster-wizard__steps" aria-label="Create cluster steps">
        {stepOrder.map((item, index) => (
          <li key={item} className={`cluster-wizard__step${index <= stepIndex ? " cluster-wizard__step--active" : ""}`}>
            {labelForStep(item)}
          </li>
        ))}
      </ol>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {step === "basics" ? (
        <div className="cluster-wizard__panel">
          <h4>Basics</h4>
          <div className="cluster-wizard__grid">
            <label className="cluster-wizard__field">
              <span>Slug</span>
              <input value={state.slug} disabled={pending} onChange={(event) => update("slug", event.target.value)} />
            </label>
            <label className="cluster-wizard__field">
              <span>Display name</span>
              <input value={state.displayName} disabled={pending} onChange={(event) => update("displayName", event.target.value)} />
            </label>
            <label className="cluster-wizard__field">
              <span>Cluster name</span>
              <input value={state.clusterName} disabled={pending} onChange={(event) => update("clusterName", event.target.value)} />
            </label>
            <label className="cluster-wizard__field">
              <span>Description</span>
              <input
                value={state.clusterDescription}
                disabled={pending}
                onChange={(event) => update("clusterDescription", event.target.value)}
              />
            </label>
            <label className="cluster-wizard__field">
              <span>Game mode</span>
              <select value={state.gameMode} disabled={pending} onChange={(event) => update("gameMode", event.target.value)}>
                <option value="survival">survival</option>
                <option value="endless">endless</option>
                <option value="wilderness">wilderness</option>
              </select>
            </label>
            <label className="cluster-wizard__field">
              <span>Max players</span>
              <input
                type="number"
                min={1}
                max={64}
                value={state.maxPlayers}
                disabled={pending}
                onChange={(event) => update("maxPlayers", event.target.value)}
              />
            </label>
            <label className="cluster-wizard__checkbox">
              <input
                type="checkbox"
                checked={state.pvp}
                disabled={pending}
                onChange={(event) => update("pvp", event.target.checked)}
              />
              <span>PVP</span>
            </label>
            <label className="cluster-wizard__checkbox">
              <input
                type="checkbox"
                checked={state.pauseWhenEmpty}
                disabled={pending}
                onChange={(event) => update("pauseWhenEmpty", event.target.checked)}
              />
              <span>Pause when empty</span>
            </label>
            <label className="cluster-wizard__field">
              <span>Intent</span>
              <select value={state.intent} disabled={pending} onChange={(event) => update("intent", event.target.value)}>
                <option value="cooperative">cooperative</option>
                <option value="social">social</option>
                <option value="competitive">competitive</option>
                <option value="madness">madness</option>
              </select>
            </label>
            <label className="cluster-wizard__field">
              <span>Time zone</span>
              <input value={state.timeZone} disabled={pending} onChange={(event) => update("timeZone", event.target.value)} />
            </label>
          </div>
        </div>
      ) : null}
      {step === "network" ? (
        <div className="cluster-wizard__panel">
          <h4>Network</h4>
          <div className="cluster-wizard__grid">
            <label className="cluster-wizard__field">
              <span>Master host UDP port</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={state.masterHostPort}
                disabled={pending}
                onChange={(event) => update("masterHostPort", event.target.value)}
              />
            </label>
            <label className="cluster-wizard__field">
              <span>Caves host UDP port</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={state.cavesHostPort}
                disabled={pending}
                onChange={(event) => update("cavesHostPort", event.target.value)}
              />
            </label>
            <label className="cluster-wizard__field">
              <span>Master Steam port</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={state.steamHostPort}
                disabled={pending}
                onChange={(event) => update("steamHostPort", event.target.value)}
              />
            </label>
            <label className="cluster-wizard__field">
              <span>Caves Steam port</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={state.cavesSteamHostPort}
                disabled={pending}
                onChange={(event) => update("cavesSteamHostPort", event.target.value)}
              />
            </label>
          </div>
        </div>
      ) : null}
      {step === "auth" ? (
        <div className="cluster-wizard__panel">
          <h4>Authentication</h4>
          <div className="cluster-wizard__grid">
            <label className="cluster-wizard__field">
              <span>Cluster password</span>
              <input
                value={state.clusterPassword}
                disabled={pending}
                onChange={(event) => update("clusterPassword", event.target.value)}
              />
            </label>
            <label className="cluster-wizard__field">
              <span>Cluster token</span>
              <input
                value={state.clusterToken}
                disabled={pending}
                onChange={(event) => update("clusterToken", event.target.value)}
              />
            </label>
            <label className="cluster-wizard__field">
              <span>Cluster key</span>
              <input value={state.clusterKey} disabled={pending} onChange={(event) => update("clusterKey", event.target.value)} />
            </label>
            <label className="cluster-wizard__checkbox">
              <input
                type="checkbox"
                checked={state.autoStart}
                disabled={pending}
                onChange={(event) => update("autoStart", event.target.checked)}
              />
              <span>Auto start after creation</span>
            </label>
          </div>
        </div>
      ) : null}
      {step === "review" ? (
        <div className="cluster-wizard__panel">
          <h4>Review</h4>
          <p className="cluster-wizard__copy">playable Master + Caves managed layout</p>
          <dl className="cluster-wizard__review">
            <div>
              <dt>Slug</dt>
              <dd>{state.slug}</dd>
            </div>
            <div>
              <dt>Display name</dt>
              <dd>{state.displayName}</dd>
            </div>
            <div>
              <dt>Cluster name</dt>
              <dd>{state.clusterName}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{state.clusterDescription || "Not set"}</dd>
            </div>
            <div>
              <dt>Game mode</dt>
              <dd>{state.gameMode}</dd>
            </div>
            <div>
              <dt>Max players</dt>
              <dd>{state.maxPlayers}</dd>
            </div>
            <div>
              <dt>PVP</dt>
              <dd>{state.pvp ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Pause when empty</dt>
              <dd>{state.pauseWhenEmpty ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Intent</dt>
              <dd>{state.intent}</dd>
            </div>
            <div>
              <dt>Time zone</dt>
              <dd>{state.timeZone}</dd>
            </div>
            <div>
              <dt>Cluster password</dt>
              <dd>{state.clusterPassword.trim() === "" ? "Not configured" : "Configured"}</dd>
            </div>
            <div>
              <dt>Cluster key</dt>
              <dd>{state.clusterKey || "Not set"}</dd>
            </div>
            <div>
              <dt>Auto start</dt>
              <dd>{state.autoStart ? "Start after create" : "Manual start"}</dd>
            </div>
            <div>
              <dt>Master host UDP port</dt>
              <dd>{state.masterHostPort}</dd>
            </div>
            <div>
              <dt>Caves host UDP port</dt>
              <dd>{state.cavesHostPort}</dd>
            </div>
            <div>
              <dt>Master Steam port</dt>
              <dd>{state.steamHostPort}</dd>
            </div>
            <div>
              <dt>Caves Steam port</dt>
              <dd>{state.cavesSteamHostPort}</dd>
            </div>
            <div>
              <dt>Managed layout</dt>
              <dd className="cluster-wizard__review-stack">
                <span>runtime/data/{state.clusterName}</span>
                <span>runtime/ugc</span>
                <span>runtime/dst</span>
                <span>runtime/steam-state</span>
                <span>compose/.env + compose/docker-compose.yml</span>
              </dd>
            </div>
          </dl>
          <p className="cluster-wizard__handoff">Switch to the new cluster workspace after creation to continue long-term management.</p>
          {preflightReport?.status === "blocked" && state.autoStart ? (
            <p className="cluster-wizard__warning">Auto-start will be blocked until fatal preflight issues are fixed.</p>
          ) : null}
          <PreflightPanel
            title="Preflight"
            eyebrow="Create preview"
            report={preflightReport}
            pending={preflightPending}
            errorMessage={preflightErrorMessage}
            onRefresh={async () => {
              const nextInput = buildCreateInput(state, parsePort, parseMaxPlayers);
              setPreflightPending(true);
              try {
                const nextReport = await previewClusterPreflight(nextInput);
                setPreflightReport(nextReport);
                setPreflightErrorMessage(undefined);
              } catch (error) {
                setPreflightReport(undefined);
                setPreflightErrorMessage(getErrorMessage(error, "Failed to load preflight preview"));
              } finally {
                setPreflightPending(false);
              }
            }}
          />
        </div>
      ) : null}
      <div className="cluster-wizard__actions">
        <button type="button" disabled={pending || stepIndex === 0} onClick={moveBack}>Back</button>
        {step !== "review" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void moveNext()}
          >
            {nextButtonLabel(step)}
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => void submitCreate()}>Create cluster</button>
        )}
      </div>
    </section>
  );
}

function labelForStep(step: WizardStep) {
  if (step === "basics") {
    return "Basics";
  }
  if (step === "network") {
    return "Network";
  }
  if (step === "auth") {
    return "Authentication";
  }
  return "Review";
}

function nextButtonLabel(step: WizardStep) {
  if (step === "basics") {
    return "Next: Network";
  }
  if (step === "network") {
    return "Next: Authentication";
  }
  return "Next: Review";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

function buildCreateInput(
  state: WizardState,
  parsePort: (raw: string, label: string) => number,
  parseMaxPlayers: (raw: string) => number,
): ClusterMutationInput {
  return {
    mode: "create",
    slug: state.slug.trim(),
    displayName: state.displayName.trim(),
    clusterName: state.clusterName.trim(),
    clusterDescription: state.clusterDescription.trim(),
    clusterPassword: state.clusterPassword.trim(),
    gameMode: state.gameMode,
    maxPlayers: parseMaxPlayers(state.maxPlayers),
    pvp: state.pvp,
    pauseWhenEmpty: state.pauseWhenEmpty,
    clusterToken: state.clusterToken.trim(),
    clusterKey: state.clusterKey.trim(),
    intent: state.intent,
    timeZone: state.timeZone.trim(),
    masterHostPort: parsePort(state.masterHostPort, "Master host UDP port"),
    cavesHostPort: parsePort(state.cavesHostPort, "Caves host UDP port"),
    steamHostPort: parsePort(state.steamHostPort, "Master Steam port"),
    cavesSteamHostPort: parsePort(state.cavesSteamHostPort, "Caves Steam port"),
    autoStart: state.autoStart,
  };
}

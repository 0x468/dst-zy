import { useState } from "react";

import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { ClusterMutationInput, ClusterSummary, DiscoveredClusterSummary } from "../../../lib/api";
import { CreateClusterWizard } from "../create/CreateClusterWizard";

type ClusterWorkspaceHomeProps = {
  clusters: ClusterSummary[];
  discoveredClusters: DiscoveredClusterSummary[];
  onOpenCluster: (slug: string) => void;
  onCreate: (input: ClusterMutationInput) => Promise<void> | void;
  onImport: (input: ClusterMutationInput) => Promise<void> | void;
  onAdopt: (slug: string) => Promise<void> | void;
};

export function ClusterWorkspaceHome({
  clusters,
  discoveredClusters,
  onOpenCluster,
  onCreate,
  onImport,
  onAdopt,
}: ClusterWorkspaceHomeProps) {
  const stats = [
    { label: "Managed", value: String(clusters.length), tone: "neutral" },
    { label: "Running", value: String(clusters.filter((cluster) => cluster.status === "running").length), tone: "success" },
    { label: "Stopped", value: String(clusters.filter((cluster) => cluster.status === "stopped").length), tone: "warning" },
    { label: "Discovered", value: String(discoveredClusters.length), tone: discoveredClusters.length > 0 ? "warning" : "neutral" },
  ] as const;

  return (
    <section className="cluster-workspace-home" aria-labelledby="cluster-workspace-heading">
      <header className="cluster-workspace-home__hero">
        <p className="cluster-workspace-home__eyebrow">Provisioning workspace</p>
        <div className="cluster-workspace-home__hero-main">
          <div>
            <h1 id="cluster-workspace-heading">Create cluster</h1>
            <p className="cluster-workspace-home__copy">
              Build a new managed cluster, register an existing world, and keep sight of the cluster inventory from one operations workspace.
            </p>
          </div>
          <div className="cluster-workspace-home__hero-note">
            <span className="cluster-workspace-home__hero-tag">Standard closure</span>
            <span>New clusters open directly into long-term management after provisioning.</span>
          </div>
        </div>
      </header>

      <section className="cluster-workspace-home__stats" aria-label="Workspace inventory summary">
        {stats.map((stat) => (
          <article key={stat.label} className="cluster-workspace-home__stat">
            <span className="cluster-workspace-home__stat-label">{stat.label}</span>
            <strong className="cluster-workspace-home__stat-value">{stat.value}</strong>
            <span className={`cluster-workspace-home__stat-tone cluster-workspace-home__stat-tone--${stat.tone}`} />
          </article>
        ))}
      </section>

      <div className="cluster-workspace-home__inventory-grid">
        <section className="cluster-workspace-home__card">
          <div className="cluster-workspace-home__card-header">
            <p className="cluster-workspace-home__card-eyebrow">Managed fleet</p>
            <h2>Managed cluster library</h2>
            <p>Open an existing workspace directly from the control-plane home instead of returning to the navigation rail.</p>
          </div>
          {clusters.length > 0 ? (
            <div className="cluster-workspace-home__library">
              {clusters.map((cluster) => (
                <article key={cluster.slug} className="cluster-workspace-home__library-item">
                  <div className="cluster-workspace-home__library-copy">
                    <div className="cluster-workspace-home__library-title">
                      <strong>{cluster.displayName}</strong>
                      <StatusBadge status={cluster.status} />
                    </div>
                    <p>{cluster.note || `slug/${cluster.slug} · ${cluster.clusterName || "Managed cluster"}`}</p>
                  </div>
                  <button type="button" onClick={() => onOpenCluster(cluster.slug)}>Open cluster</button>
                </article>
              ))}
            </div>
          ) : (
            <p className="cluster-workspace-home__empty">
              No managed clusters yet. Use the wizard below or import an existing world to start the inventory.
            </p>
          )}
        </section>

        <DiscoveryCard discoveredClusters={discoveredClusters} onAdopt={onAdopt} />
      </div>

      <div className="cluster-workspace-home__grid">
        <section className="cluster-workspace-home__card cluster-workspace-home__card--primary">
          <div className="cluster-workspace-home__card-header">
            <p className="cluster-workspace-home__card-eyebrow">Primary path</p>
            <h2>Standard closure wizard</h2>
            <p>Create a playable Master/Caves pair with guided defaults, readiness checks, and managed runtime wiring.</p>
          </div>
          <CreateClusterWizard onSubmit={onCreate} />
        </section>

        <section className="cluster-workspace-home__card cluster-workspace-home__card--secondary">
          <ImportClusterForm onSubmit={onImport} />
        </section>
      </div>
    </section>
  );
}

type DiscoveryCardProps = {
  discoveredClusters: DiscoveredClusterSummary[];
  onAdopt: (slug: string) => Promise<void> | void;
};

function DiscoveryCard({ discoveredClusters, onAdopt }: DiscoveryCardProps) {
  const [pendingSlug, setPendingSlug] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleAdopt(slug: string) {
    try {
      setPendingSlug(slug);
      setErrorMessage(undefined);
      await onAdopt(slug);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to register managed root"));
    } finally {
      setPendingSlug(undefined);
    }
  }

  return (
    <section className="cluster-workspace-home__card cluster-workspace-home__card--discovery">
      <div className="cluster-workspace-home__card-header">
        <p className="cluster-workspace-home__card-eyebrow">Recovery lane</p>
        <h2>Discovered managed roots</h2>
        <p>Found cluster roots on disk that are not yet registered in the control-plane database.</p>
      </div>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {discoveredClusters.length > 0 ? (
        <div className="cluster-workspace-home__discovery-list">
          {discoveredClusters.map((cluster) => {
            const pending = pendingSlug === cluster.slug;

            return (
              <article key={cluster.slug} className="cluster-workspace-home__discovery-item">
                <div className="cluster-workspace-home__discovery-copy">
                  <div className="cluster-workspace-home__discovery-header">
                    <strong>{cluster.displayName}</strong>
                    <span className="cluster-workspace-home__hero-tag">{cluster.status}</span>
                  </div>
                  <dl className="cluster-workspace-home__discovery-meta">
                    <div>
                      <dt>Slug</dt>
                      <dd>{cluster.slug}</dd>
                    </div>
                    <div>
                      <dt>Cluster</dt>
                      <dd>{cluster.clusterName}</dd>
                    </div>
                    <div>
                      <dt>Path</dt>
                      <dd>{cluster.baseDir}</dd>
                    </div>
                  </dl>
                </div>
                <button type="button" disabled={pending} onClick={() => void handleAdopt(cluster.slug)}>
                  {pending ? `Registering ${cluster.slug}...` : `Register ${cluster.slug}`}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="cluster-workspace-home__empty">
          No unregistered managed roots detected under the control-plane data directory.
        </p>
      )}
    </section>
  );
}

type ImportClusterFormProps = {
  onSubmit: (input: ClusterMutationInput) => Promise<void> | void;
};

function ImportClusterForm({ onSubmit }: ImportClusterFormProps) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const formID = "cluster-import-form";

  function toggleOpen() {
    setOpen((current) => !current);
    if (errorMessage) {
      setErrorMessage(undefined);
    }
  }

  return (
    <section className="cluster-import" aria-label="Import existing cluster">
      <div className="cluster-import__header">
        <div>
          <p className="cluster-workspace-home__card-eyebrow">Existing world</p>
          <h2>Import existing cluster</h2>
        </div>
        <button
          type="button"
          disabled={pending}
          aria-expanded={open}
          aria-controls={formID}
          onClick={toggleOpen}
        >
          {open ? "Hide import form" : "Open import form"}
        </button>
      </div>
      <p className="cluster-import__copy">
        Register a world that already exists on disk so the control plane can manage lifecycle, backups, readiness, and future edits.
      </p>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {open ? (
        <form
          id={formID}
          className="cluster-management__form cluster-import__form"
          onChange={() => {
            if (errorMessage) {
              setErrorMessage(undefined);
            }
          }}
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const slug = String(formData.get("slug") ?? "").trim();
            const displayName = String(formData.get("displayName") ?? "").trim();
            const clusterName = String(formData.get("clusterName") ?? "").trim();
            const baseDir = String(formData.get("baseDir") ?? "").trim();

            if (slug === "") {
              setErrorMessage("Slug is required");
              return;
            }
            if (displayName === "") {
              setErrorMessage("Display name is required");
              return;
            }
            if (clusterName === "") {
              setErrorMessage("Cluster name is required");
              return;
            }
            if (baseDir === "") {
              setErrorMessage("Import path is required");
              return;
            }

            try {
              setPending(true);
              await onSubmit({
                mode: "import",
                slug,
                displayName,
                clusterName,
                baseDir,
              });
              setErrorMessage(undefined);
              form.reset();
              setOpen(false);
            } catch (error) {
              setErrorMessage(getErrorMessage(error, "Failed to import cluster"));
            } finally {
              setPending(false);
            }
          }}
        >
          <div>
            <label htmlFor="import-slug">Import slug</label>
            <input id="import-slug" name="slug" type="text" disabled={pending} />
          </div>
          <div>
            <label htmlFor="import-display-name">Import display name</label>
            <input id="import-display-name" name="displayName" type="text" disabled={pending} />
          </div>
          <div>
            <label htmlFor="import-cluster-name">Import cluster name</label>
            <input id="import-cluster-name" name="clusterName" type="text" disabled={pending} />
          </div>
          <div>
            <label htmlFor="import-base-dir">Import path</label>
            <input id="import-base-dir" name="baseDir" type="text" disabled={pending} />
          </div>
          <button type="submit" disabled={pending}>Import cluster</button>
        </form>
      ) : null}
    </section>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

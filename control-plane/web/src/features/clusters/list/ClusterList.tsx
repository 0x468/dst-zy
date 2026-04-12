import { useState } from "react";

import { CreateClusterWizard } from "../create/CreateClusterWizard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { ClusterMutationInput, ClusterSummary } from "../../../lib/api";

type ClusterListProps = {
  clusters: ClusterSummary[];
  selectedSlug?: string;
  onSelect: (slug: string) => void;
  onCreate: (input: ClusterMutationInput) => Promise<void> | void;
  onImport: (input: ClusterMutationInput) => Promise<void> | void;
};

export function ClusterList({ clusters, selectedSlug, onSelect, onCreate, onImport }: ClusterListProps) {
  return (
    <>
      <nav className="cluster-nav" aria-label="Cluster navigation">
        <h2 id="cluster-nav-heading">Clusters</h2>
        <ul className="cluster-nav__list">
          {clusters.map((cluster) => (
            <li key={cluster.id} className="cluster-nav__item">
              <label className="cluster-nav__choice">
                <input
                  className="cluster-nav__radio"
                  type="radio"
                  name="selected-cluster"
                  checked={selectedSlug === cluster.slug}
                  onChange={() => onSelect(cluster.slug)}
                />
                <span className="cluster-nav__button">
                  <strong className="cluster-nav__display-name">{cluster.displayName}</strong>
                  <span className="cluster-nav__meta">
                    <span className="cluster-nav__slug">{cluster.slug}</span>
                    <StatusBadge status={cluster.status} />
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </nav>
      <section className="cluster-management" aria-labelledby="cluster-management-heading">
        <h2 id="cluster-management-heading">Create cluster</h2>
        <p className="cluster-management__copy">
          Standard closure is the primary path. Use guided steps to create a playable Master/Caves layout.
        </p>
        <CreateClusterWizard onSubmit={onCreate} />
        <ImportClusterForm onSubmit={onImport} />
      </section>
    </>
  );
}

type ImportClusterFormProps = {
  onSubmit: (input: ClusterMutationInput) => Promise<void> | void;
};

function ImportClusterForm({ onSubmit }: ImportClusterFormProps) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  return (
    <section className="cluster-import" aria-label="Import existing cluster">
      <div className="cluster-import__header">
        <h3>Import existing cluster</h3>
        <button type="button" disabled={pending} onClick={() => setOpen((current) => !current)}>
          {open ? "Hide import form" : "Open import form"}
        </button>
      </div>
      <p className="cluster-import__copy">Keep this path for existing worlds that already live on disk.</p>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {open ? (
        <form
          className="cluster-management__form cluster-import__form"
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

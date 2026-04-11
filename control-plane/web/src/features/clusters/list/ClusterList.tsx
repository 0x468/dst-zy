import { useState } from "react";

import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { ClusterMutationInput, ClusterSummary } from "../../../lib/api";

type ClusterListProps = {
  clusters: ClusterSummary[];
  selectedSlug?: string;
  onSelect: (slug: string) => void;
  onMutate: (input: ClusterMutationInput) => Promise<void> | void;
};

export function ClusterList({ clusters, selectedSlug, onSelect, onMutate }: ClusterListProps) {
  return (
    <>
      <section className="cluster-nav" aria-labelledby="cluster-nav-heading">
        <h2 id="cluster-nav-heading">Clusters</h2>
        <ul className="cluster-nav__list">
          {clusters.map((cluster) => (
            <li key={cluster.id} className="cluster-nav__item">
              <button
                className="cluster-nav__button"
                type="button"
                aria-pressed={selectedSlug === cluster.slug}
                onClick={() => onSelect(cluster.slug)}
              >
                <strong className="cluster-nav__display-name">{cluster.displayName}</strong>
                <span className="cluster-nav__meta">
                  <span className="cluster-nav__slug">{cluster.slug}</span>
                  <StatusBadge status={cluster.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="cluster-management" aria-labelledby="cluster-management-heading">
        <h2 id="cluster-management-heading">Cluster management</h2>
        <p className="cluster-management__copy">Create a new cluster or import one from an existing path.</p>
        <ClusterMutationForm onSubmit={onMutate} />
      </section>
    </>
  );
}

type ClusterMutationFormProps = {
  onSubmit: (input: ClusterMutationInput) => Promise<void> | void;
};

function ClusterMutationForm({ onSubmit }: ClusterMutationFormProps) {
  const [mode, setMode] = useState<"create" | "import">("create");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  return (
    <>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <form
        className="cluster-management__form"
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
          if (mode === "import" && baseDir === "") {
            setErrorMessage("Import path is required");
            return;
          }

          try {
            setPending(true);
            await onSubmit({
              mode,
              slug,
              displayName,
              clusterName,
              baseDir,
            });
            setErrorMessage(undefined);
            form.reset();
          } catch (error) {
            setErrorMessage(getErrorMessage(error, `Failed to ${mode} cluster`));
          } finally {
            setPending(false);
          }
        }}
      >
        <div>
          <label htmlFor="mutation-mode">Mode</label>
          <select
            id="mutation-mode"
            value={mode}
            disabled={pending}
            onChange={(event) => {
              setErrorMessage(undefined);
              setMode(event.target.value as "create" | "import");
            }}
          >
            <option value="create">Create</option>
            <option value="import">Import</option>
          </select>
        </div>
        <div>
          <label htmlFor="mutation-slug">Slug</label>
          <input id="mutation-slug" name="slug" type="text" disabled={pending} />
        </div>
        <div>
          <label htmlFor="mutation-display-name">Display name</label>
          <input id="mutation-display-name" name="displayName" type="text" disabled={pending} />
        </div>
        <div>
          <label htmlFor="mutation-cluster-name">Cluster name</label>
          <input id="mutation-cluster-name" name="clusterName" type="text" disabled={pending} />
        </div>
        {mode === "import" ? (
          <div>
            <label htmlFor="mutation-base-dir">Import path</label>
            <input id="mutation-base-dir" name="baseDir" type="text" disabled={pending} />
          </div>
        ) : null}
        <button type="submit" disabled={pending}>{mode === "create" ? "Create cluster" : "Import cluster"}</button>
      </form>
    </>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

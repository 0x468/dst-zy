import { useState } from "react";

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
      <section>
        <h2>Clusters</h2>
        <ul>
          {clusters.map((cluster) => (
            <li key={cluster.id}>
              <button
                type="button"
                aria-pressed={selectedSlug === cluster.slug}
                onClick={() => onSelect(cluster.slug)}
              >
                <strong>{cluster.displayName}</strong>
                <span>{cluster.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <ClusterMutationForm onSubmit={onMutate} />
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
    <section>
      <h2>Create or import</h2>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <form
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
            setErrorMessage(`Failed to ${mode} cluster`);
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
    </section>
  );
}

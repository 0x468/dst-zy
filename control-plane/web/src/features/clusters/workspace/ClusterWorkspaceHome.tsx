import { useState } from "react";

import type { ClusterMutationInput } from "../../../lib/api";
import { CreateClusterWizard } from "../create/CreateClusterWizard";

type ClusterWorkspaceHomeProps = {
  onCreate: (input: ClusterMutationInput) => Promise<void> | void;
  onImport: (input: ClusterMutationInput) => Promise<void> | void;
};

export function ClusterWorkspaceHome({ onCreate, onImport }: ClusterWorkspaceHomeProps) {
  return (
    <section className="cluster-workspace-home" aria-labelledby="cluster-workspace-heading">
      <header className="cluster-workspace-home__hero">
        <p className="cluster-workspace-home__eyebrow">Provisioning workspace</p>
        <div className="cluster-workspace-home__hero-main">
          <div>
            <h1 id="cluster-workspace-heading">Create cluster</h1>
            <p className="cluster-workspace-home__copy">
              Build a new managed cluster or register an existing world from one workspace instead of squeezing forms into the navigation rail.
            </p>
          </div>
          <div className="cluster-workspace-home__hero-note">
            <span className="cluster-workspace-home__hero-tag">Standard closure</span>
            <span>New clusters open directly into long-term management after provisioning.</span>
          </div>
        </div>
      </header>

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

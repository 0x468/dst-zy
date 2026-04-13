import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClusterWorkspaceHome } from "./ClusterWorkspaceHome";

describe("ClusterWorkspaceHome", () => {
  it("renders the create workspace and secondary import entry", async () => {
    const user = userEvent.setup();

    render(
      <ClusterWorkspaceHome
        clusters={[
          { id: 1, slug: "cluster-a", displayName: "Cluster A", status: "running", note: "Primary world", clusterName: "Cluster_A" },
        ]}
        discoveredClusters={[
          { slug: "orphan-a", displayName: "Legacy Cluster", clusterName: "Legacy_Cluster", baseDir: "/srv/control-plane/clusters/orphan-a", status: "discovered" },
        ]}
        onOpenCluster={vi.fn()}
        onCreate={vi.fn()}
        onImport={vi.fn()}
        onAdopt={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Create cluster" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Managed cluster library" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Discovered managed roots" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Standard closure wizard" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Import existing cluster" })).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Open import form" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Hide import form" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Import cluster" })).toBeInTheDocument();
  });

  it("submits import requests from the workspace import card", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <ClusterWorkspaceHome
        clusters={[]}
        discoveredClusters={[]}
        onOpenCluster={vi.fn()}
        onCreate={vi.fn()}
        onImport={onImport}
        onAdopt={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open import form" }));
    await user.type(screen.getByLabelText("Import slug"), "legacy-cluster");
    await user.type(screen.getByLabelText("Import display name"), "Legacy Cluster");
    await user.type(screen.getByLabelText("Import cluster name"), "Legacy_Cluster");
    await user.type(screen.getByLabelText("Import path"), "/srv/legacy-cluster");
    await user.click(screen.getByRole("button", { name: "Import cluster" }));

    expect(onImport).toHaveBeenCalledWith({
      mode: "import",
      slug: "legacy-cluster",
      displayName: "Legacy Cluster",
      clusterName: "Legacy_Cluster",
      baseDir: "/srv/legacy-cluster",
    });
  });

  it("requires an import path and clears stale errors in the workspace import card", async () => {
    const user = userEvent.setup();

    render(
      <ClusterWorkspaceHome
        clusters={[]}
        discoveredClusters={[]}
        onOpenCluster={vi.fn()}
        onCreate={vi.fn()}
        onImport={vi.fn()}
        onAdopt={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open import form" }));
    await user.type(screen.getByLabelText("Import slug"), "cluster-a");
    await user.type(screen.getByLabelText("Import display name"), "Cluster A");
    await user.type(screen.getByLabelText("Import cluster name"), "Cluster_A");
    await user.click(screen.getByRole("button", { name: "Import cluster" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Import path is required");

    await user.type(screen.getByLabelText("Import path"), "/srv/cluster-a");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("registers discovered managed roots from the recovery lane", async () => {
    const user = userEvent.setup();
    const onAdopt = vi.fn();

    render(
      <ClusterWorkspaceHome
        clusters={[]}
        discoveredClusters={[
          { slug: "orphan-a", displayName: "Legacy Cluster", clusterName: "Legacy_Cluster", baseDir: "/srv/control-plane/clusters/orphan-a", status: "discovered" },
        ]}
        onOpenCluster={vi.fn()}
        onCreate={vi.fn()}
        onImport={vi.fn()}
        onAdopt={onAdopt}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Register orphan-a" }));

    expect(onAdopt).toHaveBeenCalledWith("orphan-a");
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClusterList } from "./ClusterList";

describe("ClusterList", () => {
  it("renders cluster navigation items with badge, slug, and single-selection semantics", () => {
    render(
      <ClusterList
        clusters={[
          { id: 1, slug: "alpha", displayName: "Alpha Cluster", status: "running" },
          { id: 2, slug: "beta", displayName: "Beta Cluster", status: "stopped" },
        ]}
        selectedSlug="alpha"
        onCreate={vi.fn()}
        onImport={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "Cluster navigation" });
    expect(screen.getByRole("heading", { name: "Create cluster" })).toBeInTheDocument();
    expect(within(navigation).queryByRole("heading", { name: "Create cluster" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Alpha Cluster/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Beta Cluster/i })).not.toBeChecked();
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("running")).toHaveClass("status-badge");
    expect(screen.getByText("stopped")).toHaveClass("status-badge");
  });

  it("selects a cluster through the navigation control", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ClusterList
        clusters={[
          { id: 1, slug: "alpha", displayName: "Alpha Cluster", status: "running" },
          { id: 2, slug: "beta", displayName: "Beta Cluster", status: "stopped" },
        ]}
        selectedSlug="alpha"
        onCreate={vi.fn()}
        onImport={vi.fn()}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Beta Cluster/i }));

    expect(onSelect).toHaveBeenCalledWith("beta");
  });

  it("keeps wizard as the primary create entry and import as secondary", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onImport = vi.fn();

    render(
      <ClusterList
        clusters={[
          { id: 1, slug: "alpha", displayName: "Alpha Cluster", status: "running" },
          { id: 2, slug: "beta", displayName: "Beta Cluster", status: "stopped" },
        ]}
        selectedSlug="alpha"
        onCreate={onCreate}
        onImport={onImport}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Basics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next: Network" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Open import form" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "cluster-import-form");

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Hide import form" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Import cluster" })).toBeInTheDocument();
  });

  it("submits import requests from the secondary entry", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <ClusterList
        clusters={[]}
        onCreate={vi.fn()}
        onImport={onImport}
        onSelect={vi.fn()}
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

  it("requires an import path when import mode is selected", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();

    render(
      <ClusterList
        clusters={[]}
        onCreate={vi.fn()}
        onImport={onImport}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open import form" }));
    await user.type(screen.getByLabelText("Import slug"), "cluster-a");
    await user.type(screen.getByLabelText("Import display name"), "Cluster A");
    await user.type(screen.getByLabelText("Import cluster name"), "Cluster_A");
    await user.click(screen.getByRole("button", { name: "Import cluster" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Import path is required");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("clears stale import errors when the operator edits fields or closes the form", async () => {
    const user = userEvent.setup();

    render(
      <ClusterList
        clusters={[]}
        onCreate={vi.fn()}
        onImport={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open import form" }));
    await user.click(screen.getByRole("button", { name: "Import cluster" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Slug is required");

    await user.type(screen.getByLabelText("Import slug"), "cluster-a");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide import form" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a submission error when mutation fails", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn().mockRejectedValue(new Error("request failed"));

    render(
      <ClusterList
        clusters={[]}
        onCreate={vi.fn()}
        onImport={onImport}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open import form" }));
    await user.type(screen.getByLabelText("Import slug"), "cluster-a");
    await user.type(screen.getByLabelText("Import display name"), "Cluster A");
    await user.type(screen.getByLabelText("Import cluster name"), "Cluster_A");
    await user.type(screen.getByLabelText("Import path"), "/srv/cluster-a");
    await user.click(screen.getByRole("button", { name: "Import cluster" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("request failed");
  });
});

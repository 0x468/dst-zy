import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { JobSummary } from "../../../lib/api";
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
        onSelect={vi.fn()}
        onOpenWorkspace={vi.fn()}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "Cluster navigation" });
    expect(screen.queryByRole("heading", { name: "Create cluster" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open workspace" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Alpha Cluster/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Beta Cluster/i })).not.toBeChecked();
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("running")).toHaveClass("status-badge");
    expect(screen.getByText("stopped")).toHaveClass("status-badge");
  });

  it("shows recent action and update summary for each cluster when metadata is available", () => {
    const jobs: JobSummary[] = [
      {
        id: 22,
        clusterId: 1,
        jobType: "backup",
        status: "completed",
        stdoutExcerpt: "",
        stderrExcerpt: "",
        startedAt: "2026-03-29T14:00:00Z",
      },
      {
        id: 21,
        clusterId: 1,
        jobType: "start",
        status: "failed",
        stdoutExcerpt: "",
        stderrExcerpt: "compose up failed",
        startedAt: "2026-03-29T15:30:00Z",
      },
      {
        id: 20,
        clusterId: 2,
        jobType: "backup",
        status: "completed",
        stdoutExcerpt: "",
        stderrExcerpt: "",
        startedAt: "2026-03-29T14:10:00Z",
      },
    ];

    render(
      <ClusterList
        clusters={[
          {
            id: 1,
            slug: "alpha",
            displayName: "Alpha Cluster",
            status: "running",
            updatedAt: "2026-03-29T16:00:00Z",
          },
          {
            id: 2,
            slug: "beta",
            displayName: "Beta Cluster",
            status: "stopped",
            updatedAt: "2026-03-29T14:00:00Z",
          },
        ]}
        jobs={jobs}
        selectedSlug="alpha"
        onSelect={vi.fn()}
        onOpenWorkspace={vi.fn()}
      />,
    );

    expect(screen.getByText("Start failed")).toBeInTheDocument();
    expect(screen.getByText("Backup completed")).toBeInTheDocument();
    expect(screen.getByText("Updated 2026-03-29 16:00 UTC")).toBeInTheDocument();
    expect(screen.getByText("Updated 2026-03-29 14:00 UTC")).toBeInTheDocument();
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
        onSelect={onSelect}
        onOpenWorkspace={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Beta Cluster/i }));

    expect(onSelect).toHaveBeenCalledWith("beta");
  });

  it("offers a dedicated workspace entry outside the cluster radios", async () => {
    const user = userEvent.setup();
    const onOpenWorkspace = vi.fn();

    render(
      <ClusterList
        clusters={[
          { id: 1, slug: "alpha", displayName: "Alpha Cluster", status: "running" },
          { id: 2, slug: "beta", displayName: "Beta Cluster", status: "stopped" },
        ]}
        selectedSlug="alpha"
        onSelect={vi.fn()}
        onOpenWorkspace={onOpenWorkspace}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open workspace" }));

    expect(onOpenWorkspace).toHaveBeenCalledTimes(1);
  });
});

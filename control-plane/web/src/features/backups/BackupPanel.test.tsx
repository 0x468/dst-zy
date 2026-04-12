import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BackupPanel } from "./BackupPanel";

describe("BackupPanel", () => {
  it("renders backup download links with formatted metadata", () => {
    render(
      <BackupPanel
        clusterSlug="cluster-a"
        backups={[
          {
            name: "Cluster_A-20260329T130000Z.tar.gz",
            sizeBytes: 2048,
            createdAt: "2026-03-29T13:00:00Z",
            clusterSlug: "cluster-a",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Backups" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cluster_A-20260329T130000Z.tar.gz" })).toHaveAttribute(
      "href",
      "/api/clusters/cluster-a/backups/Cluster_A-20260329T130000Z.tar.gz",
    );
    expect(screen.getByText("2026-03-29 13:00:00 UTC")).toBeInTheDocument();
    expect(screen.getByText("2048 B")).toBeInTheDocument();
  });

  it("shows an empty state when no backups exist", () => {
    render(<BackupPanel clusterSlug="cluster-a" backups={[]} />);

    expect(screen.getByText("No backups yet.")).toBeInTheDocument();
  });

  it("highlights the latest backup separately from backup history and allows manual refresh", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(
      <BackupPanel
        clusterSlug="cluster-a"
        backups={[
          {
            name: "Cluster_A-20260329T140000Z.tar.gz",
            sizeBytes: 4096,
            createdAt: "2026-03-29T14:00:00Z",
            clusterSlug: "cluster-a",
          },
          {
            name: "Cluster_A-20260329T130000Z.tar.gz",
            sizeBytes: 2048,
            createdAt: "2026-03-29T13:00:00Z",
            clusterSlug: "cluster-a",
          },
        ]}
        onRefresh={onRefresh}
      />,
    );

    const latestBackup = screen.getByRole("region", { name: "Latest backup" });
    const backupHistory = screen.getByRole("list", { name: "Backup history" });

    expect(within(latestBackup).getByText("Cluster_A-20260329T140000Z.tar.gz")).toBeInTheDocument();
    expect(within(backupHistory).queryByText("Cluster_A-20260329T140000Z.tar.gz")).not.toBeInTheDocument();
    expect(within(backupHistory).getByText("Cluster_A-20260329T130000Z.tar.gz")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh backups" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables refresh while a refresh request is in flight", async () => {
    const user = userEvent.setup();
    let resolveRefresh: (() => void) | undefined;
    const onRefresh = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    }));

    render(
      <BackupPanel
        clusterSlug="cluster-a"
        backups={[]}
        onRefresh={onRefresh}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Refresh backups" }));

    expect(screen.getByRole("button", { name: "Refresh backups" })).toBeDisabled();

    resolveRefresh?.();
  });

  it("shows a local error when refresh fails", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockRejectedValue(new Error("backup index unavailable"));

    render(
      <BackupPanel
        clusterSlug="cluster-a"
        backups={[]}
        onRefresh={onRefresh}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Refresh backups" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("backup index unavailable");
  });

  it("offers restore actions for the latest backup and history entries", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();

    render(
      <BackupPanel
        clusterSlug="cluster-a"
        backups={[
          {
            name: "Cluster_A-20260329T140000Z.tar.gz",
            sizeBytes: 4096,
            createdAt: "2026-03-29T14:00:00Z",
            clusterSlug: "cluster-a",
          },
          {
            name: "Cluster_A-20260329T130000Z.tar.gz",
            sizeBytes: 2048,
            createdAt: "2026-03-29T13:00:00Z",
            clusterSlug: "cluster-a",
          },
        ]}
        onRestore={onRestore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Restore latest backup" }));
    await user.click(screen.getByRole("button", { name: "Restore Cluster_A-20260329T130000Z.tar.gz" }));

    expect(onRestore).toHaveBeenNthCalledWith(1, "Cluster_A-20260329T140000Z.tar.gz");
    expect(onRestore).toHaveBeenNthCalledWith(2, "Cluster_A-20260329T130000Z.tar.gz");
  });
});

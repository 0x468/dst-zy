import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});

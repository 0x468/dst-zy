import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClusterDetailPage } from "./ClusterDetailPage";

describe("ClusterDetailPage", () => {
  it("shows cluster metadata and status summary", () => {
    render(
      <ClusterDetailPage
        cluster={{
          id: 1,
          slug: "cluster-a",
          displayName: "Cluster A",
          status: "running",
          note: "Primary world",
          clusterName: "Cluster_A",
        }}
        snapshot={{
          clusterName: "Cluster_A",
          clusterDescription: "A co-op world",
          gameMode: "survival",
          clusterKey: "secret-key",
          masterPort: 10889,
          master: {
            serverPort: 11000,
            masterServerPort: 27018,
            authenticationPort: 8768,
          },
          caves: {
            serverPort: 11001,
            masterServerPort: 27019,
            authenticationPort: 8769,
          },
        }}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Cluster A" })).toBeInTheDocument();
    expect(screen.getByText("Primary world")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cluster_A")).toBeInTheDocument();
  });

  it("allows editing form values and saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ClusterDetailPage
        cluster={{
          id: 1,
          slug: "cluster-a",
          displayName: "Cluster A",
          status: "running",
          note: "Primary world",
          clusterName: "Cluster_A",
        }}
        snapshot={{
          clusterName: "Cluster_A",
          clusterDescription: "A co-op world",
          gameMode: "survival",
          clusterKey: "secret-key",
          masterPort: 10889,
          master: {
            serverPort: 11000,
            masterServerPort: 27018,
            authenticationPort: 8768,
          },
          caves: {
            serverPort: 11001,
            masterServerPort: 27019,
            authenticationPort: 8769,
          },
        }}
        onSave={onSave}
      />,
    );

    const descriptionInput = screen.getByLabelText("Cluster description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated description");
    await user.click(screen.getByRole("button", { name: "Save config" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        clusterDescription: "Updated description",
      }),
    );
  });

  it("supports advanced raw file editing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ClusterDetailPage
        cluster={{
          id: 1,
          slug: "cluster-a",
          displayName: "Cluster A",
          status: "running",
          note: "Primary world",
          clusterName: "Cluster_A",
        }}
        snapshot={{
          clusterName: "Cluster_A",
          clusterDescription: "A co-op world",
          gameMode: "survival",
          clusterKey: "secret-key",
          masterPort: 10889,
          master: {
            serverPort: 11000,
            masterServerPort: 27018,
            authenticationPort: 8768,
          },
          caves: {
            serverPort: 11001,
            masterServerPort: 27019,
            authenticationPort: 8769,
          },
        }}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Advanced" }));

    const rawEditor = screen.getByLabelText("cluster.ini");
    await user.clear(rawEditor);
    await user.type(rawEditor, "cluster_name = Cluster_A");
    await user.click(screen.getByRole("button", { name: "Save raw file" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        rawFiles: expect.objectContaining({
          clusterIni: "cluster_name = Cluster_A",
        }),
      }),
    );
  });
});

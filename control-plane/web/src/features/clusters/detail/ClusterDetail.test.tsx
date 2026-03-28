import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClusterDetailPage } from "./ClusterDetailPage";

describe("ClusterDetailPage", () => {
  it("disables lifecycle buttons while an action is running", async () => {
    const user = userEvent.setup();
    let resolveAction: (() => void) | undefined;
    const onAction = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveAction = resolve;
    }));

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
        onAction={onAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();

    resolveAction?.();
  });

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

  it("disables the config save button while saving", async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));

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

    await user.click(screen.getByRole("button", { name: "Save config" }));

    expect(screen.getByRole("button", { name: "Save config" })).toBeDisabled();

    resolveSave?.();
  });

  it("shows a local config save error when saving fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("invalid cluster.ini"));

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

    await user.click(screen.getByRole("button", { name: "Save config" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid cluster.ini");
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

  it("disables the raw save button while saving", async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));

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
          rawFiles: {
            clusterIni: "cluster_name = Cluster_A",
          },
        }}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    await user.click(screen.getByRole("button", { name: "Save raw file" }));

    expect(screen.getByRole("button", { name: "Save raw file" })).toBeDisabled();

    resolveSave?.();
  });

  it("shows a local raw save error when saving fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("invalid cluster.ini"));

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
          rawFiles: {
            clusterIni: "cluster_name = Cluster_A",
          },
        }}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    await user.click(screen.getByRole("button", { name: "Save raw file" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid cluster.ini");
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClusterDetailPage } from "./ClusterDetailPage";

describe("ClusterDetailPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (typeof input === "string" && input.includes("/logs")) {
        const source = input.includes("source=master")
          ? "master"
          : input.includes("source=caves")
            ? "caves"
            : "jobs";
        return Promise.resolve(new Response(JSON.stringify({
          source,
          content: "",
          updated_at: "2026-03-29T14:00:00Z",
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }));
      }

      if (typeof input === "string" && input.includes("/preflight")) {
        return Promise.resolve(new Response(JSON.stringify({
          status: "blocked",
          fatal_count: 1,
          warning_count: 0,
          checks: [
            {
              code: "token_missing",
              severity: "fatal",
              summary: "cluster_token.txt is missing",
              detail: "Token file was not found.",
              hint: "Add the token before starting the cluster.",
            },
          ],
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }));
      }

      return Promise.reject(new Error(`unmocked fetch: ${String(input)}`));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the standard closure detail sections in overview mode", () => {
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
          maxPlayers: 6,
          clusterIntention: "cooperative",
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

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Base configuration" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ports and connection" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Readiness" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Logs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backups" })).toBeInTheDocument();
  });

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
          clusterPassword: "friends-only",
          gameMode: "survival",
          shardEnabled: true,
          bindIP: "0.0.0.0",
          masterIP: "127.0.0.1",
          pvp: true,
          pauseWhenEmpty: true,
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
    expect(screen.getByRole("button", { name: "Backup" })).toBeDisabled();

    resolveAction?.();
  });

  it("shows the backup action in overview controls", () => {
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
          clusterPassword: "friends-only",
          gameMode: "survival",
          pvp: true,
          pauseWhenEmpty: true,
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

    expect(screen.getByRole("button", { name: "Backup" })).toBeInTheDocument();
  });

  it("requires typing the cluster slug before deleting", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <ClusterDetailPage
        cluster={{
          id: 1,
          slug: "cluster-a",
          displayName: "Cluster A",
          status: "stopped",
          note: "Primary world",
          clusterName: "Cluster_A",
        }}
        snapshot={{
          clusterName: "Cluster_A",
          clusterDescription: "A co-op world",
          clusterPassword: "friends-only",
          gameMode: "survival",
          pvp: true,
          pauseWhenEmpty: true,
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
        onDelete={onDelete}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete cluster" })).toBeDisabled();

    await user.type(screen.getByLabelText("Confirm cluster slug"), "cluster-a");
    await user.click(screen.getByRole("button", { name: "Delete cluster" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("hides delete controls while the cluster is running", () => {
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
          clusterPassword: "friends-only",
          gameMode: "survival",
          pvp: true,
          pauseWhenEmpty: true,
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
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Confirm cluster slug")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete cluster" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore latest backup" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore Cluster_A-20260329T130000Z.tar.gz" })).not.toBeInTheDocument();
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
    expect(screen.getByDisplayValue("6")).toBeInTheDocument();
    expect(screen.getByDisplayValue("secret-key")).toBeInTheDocument();
  });

  it("renders overview summary cards and stopped danger zone guidance", () => {
    render(
      <ClusterDetailPage
        cluster={{
          id: 1,
          slug: "cluster-a",
          displayName: "Cluster A",
          status: "stopped",
          note: "Primary world",
          clusterName: "Cluster_A",
        }}
        snapshot={{
          clusterName: "Cluster_A",
          clusterDescription: "A co-op world",
          gameMode: "survival",
          maxPlayers: 6,
          clusterIntention: "cooperative",
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

    const overviewPanel = screen.getByRole("heading", { name: "Overview" }).closest("section");

    expect(overviewPanel).not.toBeNull();
    expect(within(overviewPanel as HTMLElement).getByText("Game mode")).toBeInTheDocument();
    expect(within(overviewPanel as HTMLElement).getByText("survival")).toBeInTheDocument();
    expect(within(overviewPanel as HTMLElement).getByText("Master shard")).toBeInTheDocument();
    expect(within(overviewPanel as HTMLElement).getByText("Caves shard")).toBeInTheDocument();
    expect(within(overviewPanel as HTMLElement).getByText("Cluster status").tagName).toBe("DT");
    expect(within(overviewPanel as HTMLElement).getByText("Master shard").tagName).toBe("DT");
    expect(within(overviewPanel as HTMLElement).getByText("11000").tagName).toBe("DD");
    expect(within(overviewPanel as HTMLElement).getByText("11001").tagName).toBe("DD");
    expect(screen.getByRole("heading", { name: "Danger zone" })).toBeInTheDocument();
    expect(screen.getByText("Type cluster-a to unlock deletion.")).toBeInTheDocument();
  });

  it("uses a pressed button view switch instead of tab semantics", async () => {
    const user = userEvent.setup();

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
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Advanced" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Advanced" }));

    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Advanced" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Directly edit raw cluster.ini content.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overview" }));

    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Advanced" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backup" })).toBeInTheDocument();
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
          clusterPassword: "friends-only",
          gameMode: "survival",
          pvp: true,
          pauseWhenEmpty: true,
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
    const gameModeInput = screen.getByLabelText("Game mode");
    const maxPlayersInput = screen.getByLabelText("Max players");
    const clusterPasswordInput = screen.getByLabelText("Cluster password");
    const clusterKeyInput = screen.getByLabelText("Cluster key");
    const intentionInput = screen.getByLabelText("Cluster intention");
    const shardEnabledInput = screen.getByRole("checkbox", { name: "Shard enabled" });
    const bindIPInput = screen.getByLabelText("Bind IP");
    const masterIPInput = screen.getByLabelText("Master IP");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated description");
    await user.selectOptions(gameModeInput, "endless");
    await user.clear(maxPlayersInput);
    await user.type(maxPlayersInput, "12");
    await user.clear(clusterPasswordInput);
    await user.type(clusterPasswordInput, "new-password");
    await user.clear(clusterKeyInput);
    await user.type(clusterKeyInput, "updated-secret-key");
    await user.selectOptions(intentionInput, "social");
    await user.click(shardEnabledInput);
    await user.clear(bindIPInput);
    await user.type(bindIPInput, "192.168.1.10");
    await user.clear(masterIPInput);
    await user.type(masterIPInput, "10.0.0.5");
    await user.click(screen.getByRole("checkbox", { name: "PVP" }));
    await user.click(screen.getByRole("checkbox", { name: "Pause when empty" }));
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Shard enabled" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "PVP" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Pause when empty" })).not.toBeChecked();
    });
    await user.click(screen.getByRole("button", { name: "Save config" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        clusterDescription: "Updated description",
        clusterPassword: "new-password",
        gameMode: "endless",
        maxPlayers: 12,
        shardEnabled: false,
        bindIP: "192.168.1.10",
        masterIP: "10.0.0.5",
        pvp: false,
        pauseWhenEmpty: false,
        clusterKey: "updated-secret-key",
        clusterIntention: "social",
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

    await user.click(screen.getByRole("button", { name: "Advanced" }));

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

  it("shows raw editor guidance in advanced mode", async () => {
    const user = userEvent.setup();

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
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Advanced" }));

    expect(screen.getByText("Directly edit raw cluster.ini content.")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Advanced" }));
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

    await user.click(screen.getByRole("button", { name: "Advanced" }));
    await user.click(screen.getByRole("button", { name: "Save raw file" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid cluster.ini");
  });
});

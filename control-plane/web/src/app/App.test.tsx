import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    getClusterLogs: vi.fn().mockResolvedValue({
      source: "jobs",
      content: "",
      updatedAt: "2026-03-29T14:00:00Z",
    }),
    previewClusterPreflight: vi.fn().mockResolvedValue({
      status: "ready",
      fatalCount: 0,
      warningCount: 0,
      checks: [],
    }),
    getClusterPreflight: vi.fn().mockResolvedValue({
      status: "ready",
      fatalCount: 0,
      warningCount: 0,
      checks: [],
    }),
  };
});

import { getClusterPreflight } from "../lib/api";
import { App } from "./App";

describe("App", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(getClusterPreflight).mockReset();
    vi.mocked(getClusterPreflight).mockResolvedValue({
      status: "ready",
      fatalCount: 0,
      warningCount: 0,
      checks: [],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (typeof input === "string" && input.includes("/backups")) {
        return Promise.resolve(jsonResponse([]));
      }
      if (typeof input === "string" && input === "/api/clusters/discovery") {
        return Promise.resolve(jsonResponse([]));
      }
      if (typeof input === "string" && input.startsWith("/api/audit?slug=")) {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.reject(new Error(`unmocked fetch: ${String(input)}`));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a login form before authentication", () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401));

    render(<App />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
    expect(screen.getByText("Operate dedicated clusters with a single control surface.")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Sign in to DST Control Plane" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("restores an existing session on first load", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ authenticated: true, username: "admin" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
          updated_at: "2026-03-29T14:00:00Z",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Clusters" })).toBeInTheDocument();
    const navigation = await screen.findByRole("navigation", { name: "Cluster navigation" });
    expect(within(navigation).queryByRole("heading", { name: "Create cluster" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create cluster" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open workspace" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Cluster A" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open workspace" }));
    const clusterManagementSection = await screen.findByRole("heading", { name: "Create cluster" }).then((heading) => heading.closest("section"));
    if (!clusterManagementSection) {
      throw new Error("expected cluster management section");
    }
    expect(within(clusterManagementSection).getByRole("heading", { name: "Basics" })).toBeInTheDocument();
    await user.click(within(clusterManagementSection).getByRole("button", { name: "Open import form" }));
    expect(within(clusterManagementSection).getByRole("button", { name: "Import cluster" })).toBeInTheDocument();
    expect(within(clusterManagementSection).getByLabelText("Import path")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/session", expect.any(Object));
  });

  it("shows the cluster library in the workspace and adopts discovered managed roots", async () => {
    const user = userEvent.setup();
    let clusterListCalls = 0;
    let discoveryCalls = 0;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/session") {
        return Promise.resolve(jsonResponse({ authenticated: true, username: "admin" }));
      }
      if (url === "/api/clusters") {
        clusterListCalls += 1;
        if (clusterListCalls === 1) {
          return Promise.resolve(jsonResponse([
            {
              id: 1,
              slug: "cluster-a",
              display_name: "Cluster A",
              status: "running",
              note: "Primary world",
              cluster_name: "Cluster_A",
              updated_at: "2026-03-29T14:00:00Z",
            },
          ]));
        }

        return Promise.resolve(jsonResponse([
          {
            id: 1,
            slug: "cluster-a",
            display_name: "Cluster A",
            status: "running",
            note: "Primary world",
            cluster_name: "Cluster_A",
            updated_at: "2026-03-29T14:00:00Z",
          },
          {
            id: 8,
            slug: "orphan-a",
            display_name: "Legacy Cluster",
            status: "stopped",
            note: "Recovered managed root",
            cluster_name: "Legacy_Cluster",
            updated_at: "2026-03-29T15:15:00Z",
          },
        ]));
      }
      if (url === "/api/clusters/discovery") {
        discoveryCalls += 1;
        if (discoveryCalls === 1) {
          return Promise.resolve(jsonResponse([
            {
              id: 0,
              slug: "orphan-a",
              display_name: "Legacy Cluster",
              status: "discovered",
              base_dir: "/srv/control-plane/clusters/orphan-a",
              cluster_name: "Legacy_Cluster",
            },
          ]));
        }

        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/clusters/cluster-a/config") {
        return Promise.resolve(jsonResponse({
          cluster_name: "Cluster_A",
          cluster_description: "A co-op world",
          game_mode: "survival",
          cluster_key: "secret-key",
          master_port: 10889,
          master: {
            server_port: 11000,
            master_server_port: 27018,
            authentication_port: 8768,
          },
          caves: {
            server_port: 11001,
            master_server_port: 27019,
            authentication_port: 8769,
          },
          raw_files: {
            cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
          },
        }));
      }
      if (url === "/api/clusters/orphan-a/config") {
        return Promise.resolve(jsonResponse({
          cluster_name: "Legacy_Cluster",
          cluster_description: "Recovered cluster",
          game_mode: "survival",
          cluster_key: "legacy-key",
          master_port: 10889,
          master: {
            server_port: 11010,
            master_server_port: 27028,
            authentication_port: 8770,
          },
          caves: {
            server_port: 11011,
            master_server_port: 27029,
            authentication_port: 8771,
          },
          raw_files: {
            cluster_ini: "[NETWORK]\ncluster_name = Legacy_Cluster\n",
          },
        }));
      }
      if (url === "/api/jobs") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/audit?slug=cluster-a&limit=20" || url === "/api/audit?slug=orphan-a&limit=20") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/clusters/discovery/orphan-a/adopt") {
        return Promise.resolve(jsonResponse({
          id: 8,
          slug: "orphan-a",
          display_name: "Legacy Cluster",
          status: "stopped",
          note: "Recovered managed root",
          cluster_name: "Legacy_Cluster",
        }, 201));
      }
      if (url.includes("/backups")) {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.reject(new Error(`unmocked fetch: ${url}`));
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Cluster A" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open workspace" }));

    expect(await screen.findByRole("heading", { name: "Managed cluster library" })).toBeInTheDocument();
    expect(screen.getByText("Legacy Cluster")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Discovered managed roots" })).toBeInTheDocument();
    expect(screen.getByText("/srv/control-plane/clusters/orphan-a")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Register orphan-a" }));

    expect(await screen.findByRole("heading", { name: "Legacy Cluster" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/clusters/discovery/orphan-a/adopt", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-DST-Control-Plane-CSRF": "1",
      }),
    }));
  });

  it("shows an error when session restore fails unexpectedly", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("stays on the login screen when cluster refresh fails during session restore", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ authenticated: true, username: "admin" }))
      .mockResolvedValueOnce(jsonResponse({ error: "cluster list unavailable" }, 500));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("cluster list unavailable");
    expect(screen.queryByRole("heading", { name: "Clusters" })).not.toBeInTheDocument();
  });

  it("loads clusters, config, jobs and audit entries after sign in", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
          updated_at: "2026-03-29T14:00:00Z",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 11,
          cluster_id: 1,
          job_type: "start",
          status: "failed",
          stdout_excerpt: "",
          stderr_excerpt: "compose up failed",
          started_at: "2026-03-29T13:55:00Z",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 31,
          actor: "admin",
          action: "login_failed",
          target_type: "auth",
          target_id: 0,
          summary: "client=127.0.0.1",
          created_at: "2026-03-28T12:00:00Z",
        },
      ]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Clusters" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Cluster A" })).toBeInTheDocument();
    expect(screen.getByText("Primary world")).toBeInTheDocument();
    expect(screen.getByText("Start failed")).toBeInTheDocument();
    expect(screen.getByText("Updated 2026-03-29 14:00 UTC")).toBeInTheDocument();
    expect(screen.getByText("compose up failed")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent audit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Auth events" })).toBeInTheDocument();
    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/session", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/login", expect.objectContaining({
      headers: expect.objectContaining({
        "X-DST-Control-Plane-CSRF": "1",
      }),
    }));
    expect(fetchMock).toHaveBeenCalledWith("/api/clusters", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/clusters/cluster-a/config", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/jobs", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/audit?slug=cluster-a&limit=20", expect.any(Object));
  });

  it("stays on the login form when credentials are rejected", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Clusters" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid username or password");
  });

  it("shows a request error when sign in fails unexpectedly", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: "login backend unavailable" }, 500));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("login backend unavailable");
    expect(screen.getByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
  });

  it("creates a cluster from the dashboard and refreshes the selection", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({
        id: 7,
        slug: "cluster-b",
        display_name: "Cluster B",
        status: "stopped",
        note: "",
        cluster_name: "Cluster_B",
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        id: 12,
        cluster_id: 7,
        job_type: "start",
        status: "queued",
        stdout_excerpt: "",
        stderr_excerpt: "",
      }, 202))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 7,
          slug: "cluster-b",
          display_name: "Cluster B",
          status: "running",
          note: "",
          cluster_name: "Cluster_B",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_B",
        cluster_description: "Managed by DST Control Plane",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_B\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Clusters" });
    await user.click(screen.getByRole("button", { name: "Open workspace" }));

    await user.type(screen.getByLabelText("Slug"), "cluster-b");
    await user.type(screen.getByLabelText("New cluster display name"), "Cluster B");
    await user.type(screen.getByLabelText("Cluster name"), "Cluster_B");
    await user.click(screen.getByRole("button", { name: "Next: Network" }));
    await user.click(screen.getByRole("button", { name: "Next: Authentication" }));
    await user.type(screen.getByLabelText("Cluster token"), "token-b");
    await user.type(screen.getByLabelText("Cluster key"), "key-b");
    expect(screen.getByLabelText("Auto start after creation")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Next: Review" }));
    await user.click(screen.getByRole("button", { name: "Create cluster" }));

    expect(await screen.findByRole("heading", { name: "Cluster B" })).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/clusters", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-DST-Control-Plane-CSRF": "1",
        }),
      }));
      expect(fetchMock).toHaveBeenCalledWith("/api/clusters/cluster-b/actions", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-DST-Control-Plane-CSRF": "1",
        }),
        body: JSON.stringify({ action: "start" }),
      }));
    });
  });

  it("deletes a stopped cluster after confirmation and refreshes the cluster list", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "stopped",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
        {
          id: 2,
          slug: "cluster-b",
          display_name: "Cluster B",
          status: "running",
          note: "Second world",
          cluster_name: "Cluster_B",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 2,
          slug: "cluster-b",
          display_name: "Cluster B",
          status: "running",
          note: "Second world",
          cluster_name: "Cluster_B",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_B",
        cluster_description: "B co-op world",
        game_mode: "survival",
        cluster_key: "secret-key-b",
        master_port: 10890,
        master: {
          server_port: 12000,
          master_server_port: 28018,
          authentication_port: 9768,
        },
        caves: {
          server_port: 12001,
          master_server_port: 28019,
          authentication_port: 9769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_B\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.type(screen.getByLabelText("Confirm cluster slug"), "cluster-a");
    await user.click(screen.getByRole("button", { name: "Delete cluster" }));

    expect(await screen.findByRole("heading", { name: "Cluster B" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/clusters/cluster-a", expect.objectContaining({
      method: "DELETE",
      headers: expect.objectContaining({
        "X-DST-Control-Plane-CSRF": "1",
      }),
    }));
  });

  it("shows create errors inside the mutation form instead of the global banner", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ error: "invalid cluster slug" }, 400));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Clusters" });
    await user.click(screen.getByRole("button", { name: "Open workspace" }));

    await user.type(screen.getByLabelText("Slug"), "../bad");
    await user.type(screen.getByLabelText("New cluster display name"), "Bad Cluster");
    await user.type(screen.getByLabelText("Cluster name"), "Bad_Cluster");
    await user.click(screen.getByRole("button", { name: "Next: Network" }));
    await user.click(screen.getByRole("button", { name: "Next: Authentication" }));
    await user.type(screen.getByLabelText("Cluster token"), "token-bad");
    await user.type(screen.getByLabelText("Cluster key"), "key-bad");
    await user.click(screen.getByRole("button", { name: "Next: Review" }));
    await user.click(screen.getByRole("button", { name: "Create cluster" }));

    const mutationSection = screen.getByRole("heading", { name: "Create cluster" }).closest("section");
    if (!mutationSection) {
      throw new Error("expected mutation section");
    }

    expect(await within(mutationSection).findByRole("alert")).toHaveTextContent("invalid cluster slug");
    expect(screen.queryAllByRole("alert")).toHaveLength(1);
  });

  it("refreshes cluster status after a lifecycle action", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({
        id: 21,
        cluster_id: 1,
        job_type: "stop",
        status: "succeeded",
        stdout_excerpt: "compose stop ok",
        stderr_excerpt: "",
      }, 202))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "stopped",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(screen.getAllByText("stopped").length).toBeGreaterThan(0);
    });
  });

  it("refreshes backup list after running the backup action", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "Cluster_A-20260329T130000Z.tar.gz",
          size_bytes: 2048,
          created_at: "2026-03-29T13:00:00Z",
          cluster_slug: "cluster-a",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        id: 21,
        cluster_id: 1,
        job_type: "backup",
        status: "succeeded",
        stdout_excerpt: "/workspace/.tmp/archive.tar.gz",
        stderr_excerpt: "",
      }, 202))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 21,
          cluster_id: 1,
          job_type: "backup",
          status: "succeeded",
          stdout_excerpt: "/workspace/.tmp/archive.tar.gz",
          stderr_excerpt: "",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "Cluster_A-20260329T140000Z.tar.gz",
          size_bytes: 4096,
          created_at: "2026-03-29T14:00:00Z",
          cluster_slug: "cluster-a",
        },
        {
          name: "Cluster_A-20260329T130000Z.tar.gz",
          size_bytes: 2048,
          created_at: "2026-03-29T13:00:00Z",
          cluster_slug: "cluster-a",
        },
      ]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    expect(screen.getByRole("link", { name: "Cluster_A-20260329T130000Z.tar.gz" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Backup" }));

    expect(await screen.findByRole("link", { name: "Cluster_A-20260329T140000Z.tar.gz" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/clusters/cluster-a/backups", expect.any(Object));
  });

  it("refreshes detail state after restoring a named backup", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "stopped",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "Cluster_A-20260329T140000Z.tar.gz",
          size_bytes: 4096,
          created_at: "2026-03-29T14:00:00Z",
          cluster_slug: "cluster-a",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        id: 31,
        cluster_id: 1,
        job_type: "restore",
        status: "succeeded",
        stdout_excerpt: "restored backup Cluster_A-20260329T140000Z.tar.gz",
        stderr_excerpt: "",
      }, 202))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 31,
          cluster_id: 1,
          job_type: "restore",
          status: "succeeded",
          stdout_excerpt: "restored backup Cluster_A-20260329T140000Z.tar.gz",
          stderr_excerpt: "",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          actor: "admin",
          action: "cluster_action_restore",
          target_type: "cluster",
          target_id: 0,
          id: 91,
          summary: "slug=cluster-a",
          created_at: "2026-03-29T14:05:00Z",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "Cluster_A-20260329T140000Z.tar.gz",
          size_bytes: 4096,
          created_at: "2026-03-29T14:00:00Z",
          cluster_slug: "cluster-a",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "stopped",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        cluster_password: "",
        cluster_token: "token-a",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 31,
          cluster_id: 1,
          job_type: "restore",
          status: "succeeded",
          stdout_excerpt: "restored backup Cluster_A-20260329T140000Z.tar.gz",
          stderr_excerpt: "",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          actor: "admin",
          action: "cluster_action_restore",
          target_type: "cluster",
          target_id: 0,
          id: 91,
          summary: "slug=cluster-a",
          created_at: "2026-03-29T14:05:00Z",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "Cluster_A-20260329T140000Z.tar.gz",
          size_bytes: 4096,
          created_at: "2026-03-29T14:00:00Z",
          cluster_slug: "cluster-a",
        },
      ]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    expect(vi.mocked(getClusterPreflight)).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Restore latest backup" }));

    expect(await screen.findByText("restore")).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(getClusterPreflight)).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/clusters/cluster-a/actions", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        action: "restore",
        backup_name: "Cluster_A-20260329T140000Z.tar.gz",
      }),
    }));
  });

  it("refreshes backup list when the user requests a manual refresh", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "Cluster_A-20260329T130000Z.tar.gz",
          size_bytes: 2048,
          created_at: "2026-03-29T13:00:00Z",
          cluster_slug: "cluster-a",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          name: "Cluster_A-20260329T140000Z.tar.gz",
          size_bytes: 4096,
          created_at: "2026-03-29T14:00:00Z",
          cluster_slug: "cluster-a",
        },
      ]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("link", { name: "Cluster_A-20260329T130000Z.tar.gz" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh backups" }));

    expect(await screen.findByRole("link", { name: "Cluster_A-20260329T140000Z.tar.gz" })).toBeInTheDocument();
  });

  it("keeps backup refresh failures local to the backup panel", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ error: "backup index unavailable" }, 500));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.click(screen.getByRole("button", { name: "Refresh backups" }));

    const backupSection = screen.getByRole("heading", { name: "Backups" }).closest("section");
    if (!backupSection) {
      throw new Error("expected backups section");
    }

    expect(await within(backupSection).findByRole("alert")).toHaveTextContent("backup index unavailable");
    expect(screen.queryAllByRole("alert")).toHaveLength(1);
  });

  it("shows config save errors inside the config form instead of the global banner", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ error: "invalid cluster.ini" }, 400));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.click(screen.getByRole("button", { name: "Save config" }));

    const configForm = screen.getByRole("button", { name: "Save config" }).closest("form");
    if (!configForm) {
      throw new Error("expected config form");
    }

    expect(await within(configForm).findByRole("alert")).toHaveTextContent("invalid cluster.ini");
    expect(screen.queryAllByRole("alert")).toHaveLength(1);
  });

  it("refreshes recent audit after saving config", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 31,
          actor: "admin",
          action: "login_success",
          target_type: "auth",
          target_id: 0,
          summary: "client=127.0.0.1",
          created_at: "2026-03-29T12:00:00Z",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "Updated description",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 32,
          actor: "admin",
          action: "config_save",
          target_type: "cluster",
          target_id: 1,
          summary: "slug=cluster-a",
          created_at: "2026-03-29T12:01:00Z",
        },
      ]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.clear(screen.getByLabelText("Cluster description"));
    await user.type(screen.getByLabelText("Cluster description"), "Updated description");
    await user.click(screen.getByRole("button", { name: "Save config" }));

    expect(await screen.findByText("Saved config")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/audit?slug=cluster-a&limit=20", expect.any(Object));
  });

  it("reruns preflight after saving config", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        cluster_password: "",
        cluster_token: "",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "Updated description",
        cluster_password: "",
        cluster_token: "token-a",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    expect(vi.mocked(getClusterPreflight)).toHaveBeenCalledTimes(1);

    await user.clear(screen.getByLabelText("Cluster description"));
    await user.type(screen.getByLabelText("Cluster description"), "Updated description");
    await user.type(screen.getByLabelText("Cluster token"), "token-a");
    await user.click(screen.getByRole("button", { name: "Save config" }));

    await waitFor(() => {
      expect(vi.mocked(getClusterPreflight)).toHaveBeenCalledTimes(2);
    });
  });

  it("updates cluster header metadata after saving config", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        display_name: "Cluster A",
        note: "Primary world",
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        cluster_password: "",
        cluster_token: "",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({
        display_name: "Cluster A Prime",
        note: "Primary world updated",
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        cluster_password: "",
        cluster_token: "",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Cluster A Prime");
    await user.clear(screen.getByLabelText("Operator note"));
    await user.type(screen.getByLabelText("Operator note"), "Primary world updated");
    await user.click(screen.getByRole("button", { name: "Save metadata" }));

    expect(await screen.findByRole("heading", { name: "Cluster A Prime" })).toBeInTheDocument();
    expect(screen.getByText("Primary world updated")).toBeInTheDocument();
  });

  it("reruns preflight after a lifecycle action", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        cluster_password: "",
        cluster_token: "token-a",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({
        id: 21,
        cluster_id: 1,
        job_type: "stop",
        status: "succeeded",
        stdout_excerpt: "compose stop ok",
        stderr_excerpt: "",
      }, 202))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "stopped",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        cluster_password: "",
        cluster_token: "token-a",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    expect(vi.mocked(getClusterPreflight)).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(vi.mocked(getClusterPreflight)).toHaveBeenCalledTimes(2);
    });
  });

  it("clears stale cluster details while the next cluster config is loading", async () => {
    const user = userEvent.setup();
    const clusterBConfig = deferred<Response>();

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
        {
          id: 2,
          slug: "cluster-b",
          display_name: "Cluster B",
          status: "stopped",
          note: "Secondary world",
          cluster_name: "Cluster_B",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockImplementationOnce(() => clusterBConfig.promise)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    expect(screen.getByDisplayValue("Cluster_A")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Cluster B/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/clusters/cluster-b/config", expect.any(Object));
    });

    expect(screen.queryByRole("heading", { name: "Cluster B" })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Cluster_A")).not.toBeInTheDocument();

    clusterBConfig.resolve(jsonResponse({
      cluster_name: "Cluster_B",
      cluster_description: "B co-op world",
      game_mode: "survival",
      cluster_key: "secret-key-b",
      master_port: 10890,
      master: {
        server_port: 12000,
        master_server_port: 28018,
        authentication_port: 9768,
      },
      caves: {
        server_port: 12001,
        master_server_port: 28019,
        authentication_port: 9769,
      },
      raw_files: {
        cluster_ini: "[NETWORK]\ncluster_name = Cluster_B\n",
      },
    }));

    expect(await screen.findByRole("heading", { name: "Cluster B" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Cluster_B")).toBeInTheDocument();
  });

  it("shows an error banner when a lifecycle action fails", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ error: "unsupported action" }, 400));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.click(screen.getByRole("button", { name: "Stop" }));

    const actionsSection = screen.getByRole("heading", { name: "Actions" }).closest("section");
    if (!actionsSection) {
      throw new Error("expected actions section");
    }

    expect(await within(actionsSection).findByRole("alert")).toHaveTextContent("unsupported action");
    expect(screen.queryAllByRole("alert")).toHaveLength(1);
  });

  it("returns to the login screen when an authenticated request gets 401", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Session expired");
    expect(await screen.findByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
  });

  it("signs out and returns to the login screen", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ authenticated: true, username: "admin" }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 1,
          slug: "cluster-a",
          display_name: "Cluster A",
          status: "running",
          note: "Primary world",
          cluster_name: "Cluster_A",
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        cluster_name: "Cluster_A",
        cluster_description: "A co-op world",
        game_mode: "survival",
        cluster_key: "secret-key",
        master_port: 10889,
        master: {
          server_port: 11000,
          master_server_port: 27018,
          authentication_port: 8768,
        },
        caves: {
          server_port: 11001,
          master_server_port: 27019,
          authentication_port: 8769,
        },
        raw_files: {
          cluster_ini: "[NETWORK]\ncluster_name = Cluster_A\n",
        },
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<App />);

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/logout", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-DST-Control-Plane-CSRF": "1",
      }),
    }));
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

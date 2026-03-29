import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("App", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a login form before authentication", () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401));

    render(<App />);

    expect(screen.getByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("restores an existing session on first load", async () => {
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
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Clusters" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Cluster A" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/session", expect.any(Object));
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
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/clusters", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/clusters/cluster-a/config", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(5, "/api/jobs", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(6, "/api/audit", expect.any(Object));
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
      .mockResolvedValueOnce(jsonResponse({
        id: 7,
        slug: "cluster-b",
        display_name: "Cluster B",
        status: "stopped",
        note: "",
        cluster_name: "Cluster_B",
      }, 201))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 7,
          slug: "cluster-b",
          display_name: "Cluster B",
          status: "stopped",
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

    await user.type(screen.getByLabelText("Slug"), "cluster-b");
    await user.type(screen.getByLabelText("Display name"), "Cluster B");
    await user.type(screen.getByLabelText("Cluster name"), "Cluster_B");
    await user.click(screen.getByRole("button", { name: "Create cluster" }));

    expect(await screen.findByRole("heading", { name: "Cluster B" })).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/clusters", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-DST-Control-Plane-CSRF": "1",
        }),
      }));
    });
  });

  it("shows create errors inside the mutation form instead of the global banner", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ error: "invalid cluster slug" }, 400));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Clusters" });

    await user.type(screen.getByLabelText("Slug"), "../bad");
    await user.type(screen.getByLabelText("Display name"), "Bad Cluster");
    await user.type(screen.getByLabelText("Cluster name"), "Bad_Cluster");
    await user.click(screen.getByRole("button", { name: "Create cluster" }));

    const mutationSection = screen.getByRole("heading", { name: "Create or import" }).closest("section");
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
      .mockImplementationOnce(() => clusterBConfig.promise)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    expect(screen.getByDisplayValue("Cluster_A")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cluster B/ }));

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

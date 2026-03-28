import { render, screen, waitFor } from "@testing-library/react";
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
      .mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Clusters" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Cluster A" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/session", expect.any(Object));
  });

  it("loads clusters, config and jobs after sign in", async () => {
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
      ]));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Clusters" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Cluster A" })).toBeInTheDocument();
    expect(screen.getByText("Primary world")).toBeInTheDocument();
    expect(screen.getByText("compose up failed")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/session", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/login", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/clusters", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/clusters/cluster-a/config", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(5, "/api/jobs", expect.any(Object));
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
      }));
    });
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
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

    render(<App />);

    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to run stop");
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
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<App />);

    await screen.findByRole("heading", { name: "Cluster A" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "DST Control Plane" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/logout", expect.objectContaining({
      method: "POST",
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

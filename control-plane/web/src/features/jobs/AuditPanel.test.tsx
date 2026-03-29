import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditPanel } from "./AuditPanel";

describe("AuditPanel", () => {
  it("renders actor, timestamp and summary for recent audit records", () => {
    render(
      <AuditPanel
        clusterSlug="cluster-a"
        audit={[
          {
            id: 31,
            actor: "admin",
            action: "cluster_action_start",
            targetType: "cluster",
            targetId: 7,
            summary: "slug=cluster-a",
            createdAt: "2026-03-29T12:34:56Z",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Recent audit" })).toBeInTheDocument();
    expect(screen.getByText("cluster_action_start")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("2026-03-29 12:34:56 UTC")).toBeInTheDocument();
    expect(screen.getByText("slug=cluster-a")).toBeInTheDocument();
  });

  it("shows only selected cluster events plus auth events", () => {
    render(
      <AuditPanel
        clusterSlug="cluster-a"
        audit={[
          {
            id: 31,
            actor: "admin",
            action: "cluster_action_start",
            targetType: "cluster",
            targetId: 7,
            summary: "slug=cluster-a",
            createdAt: "2026-03-29T12:34:56Z",
          },
          {
            id: 32,
            actor: "admin",
            action: "cluster_action_stop",
            targetType: "cluster",
            targetId: 8,
            summary: "slug=cluster-b",
            createdAt: "2026-03-29T12:35:56Z",
          },
          {
            id: 33,
            actor: "admin",
            action: "login_success",
            targetType: "auth",
            targetId: 0,
            summary: "client=127.0.0.1",
            createdAt: "2026-03-29T12:36:56Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("cluster_action_start")).toBeInTheDocument();
    expect(screen.getByText("login_success")).toBeInTheDocument();
    expect(screen.queryByText("cluster_action_stop")).not.toBeInTheDocument();
  });
});

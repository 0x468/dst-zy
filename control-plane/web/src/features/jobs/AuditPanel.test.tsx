import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditPanel } from "./AuditPanel";

describe("AuditPanel", () => {
  it("renders actor, timestamp and summary for recent audit records", () => {
    render(
      <AuditPanel
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
});

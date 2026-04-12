import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PreflightPanel } from "./PreflightPanel";

describe("PreflightPanel", () => {
  it("renders readiness summary and check details", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(
      <PreflightPanel
        title="Readiness"
        eyebrow="Preflight"
        report={{
          status: "blocked",
          fatalCount: 2,
          warningCount: 1,
          checks: [
            {
              code: "token_missing",
              severity: "fatal",
              summary: "cluster_token.txt is missing",
              detail: "Token file was not found.",
              hint: "Add the token before starting the cluster.",
            },
            {
              code: "host_port_conflict",
              severity: "fatal",
              summary: "host port conflicts with another managed cluster",
              detail: "Port 11000 is already assigned to cluster-a.",
              hint: "Choose another host port.",
            },
          ],
        }}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByRole("heading", { name: "Readiness" })).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getByText("2 fatal")).toBeInTheDocument();
    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.getByText("cluster_token.txt is missing")).toBeInTheDocument();
    expect(screen.getByText("Add the token before starting the cluster.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh preflight" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

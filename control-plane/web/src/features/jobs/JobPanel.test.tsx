import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClusterDetailPage } from "../clusters/detail/ClusterDetailPage";

describe("ClusterDetailPage lifecycle and jobs", () => {
  it("triggers lifecycle actions and renders recent jobs", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onAction = vi.fn();

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
        jobs={[
          {
            id: 11,
            clusterId: 1,
            jobType: "start",
            status: "failed",
            stdoutExcerpt: "",
            stderrExcerpt: "compose up failed",
          },
        ]}
        onSave={onSave}
        onAction={onAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Restart" }));

    expect(onAction).toHaveBeenCalledWith("restart");
    expect(screen.getByRole("heading", { name: "Recent jobs" })).toBeInTheDocument();
    expect(screen.getByText("start")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("compose up failed")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreateClusterWizard } from "./CreateClusterWizard";

describe("CreateClusterWizard", () => {
  it("blocks moving forward when basics are incomplete", async () => {
    const user = userEvent.setup();

    render(<CreateClusterWizard onSubmit={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Basics" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next: Network" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Slug is required");
    expect(screen.getByRole("heading", { name: "Basics" })).toBeInTheDocument();
  });

  it("collects four-step inputs and submits a playable create request", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CreateClusterWizard onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Slug"), "cluster-b");
    await user.type(screen.getByLabelText("Display name"), "Cluster B");
    await user.type(screen.getByLabelText("Cluster name"), "Cluster_B");
    await user.type(screen.getByLabelText("Description"), "Cluster B Desc");
    await user.selectOptions(screen.getByLabelText("Game mode"), "endless");
    await user.clear(screen.getByLabelText("Max players"));
    await user.type(screen.getByLabelText("Max players"), "8");
    await user.selectOptions(screen.getByLabelText("Intent"), "social");
    await user.clear(screen.getByLabelText("Time zone"));
    await user.type(screen.getByLabelText("Time zone"), "UTC");

    await user.click(screen.getByRole("button", { name: "Next: Network" }));
    expect(screen.getByRole("heading", { name: "Network" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Master host UDP port"));
    await user.type(screen.getByLabelText("Master host UDP port"), "12000");
    await user.clear(screen.getByLabelText("Caves host UDP port"));
    await user.type(screen.getByLabelText("Caves host UDP port"), "12001");
    await user.clear(screen.getByLabelText("Master Steam port"));
    await user.type(screen.getByLabelText("Master Steam port"), "28018");
    await user.clear(screen.getByLabelText("Caves Steam port"));
    await user.type(screen.getByLabelText("Caves Steam port"), "28019");

    await user.click(screen.getByRole("button", { name: "Next: Authentication" }));
    expect(screen.getByRole("heading", { name: "Authentication" })).toBeInTheDocument();
    expect(screen.getByLabelText("Auto start after creation")).toBeChecked();

    await user.type(screen.getByLabelText("Cluster token"), "token-b");
    await user.type(screen.getByLabelText("Cluster key"), "key-b");

    await user.click(screen.getByRole("button", { name: "Next: Review" }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText("cluster-b")).toBeInTheDocument();
    expect(screen.getByText("12000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create cluster" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "create",
      slug: "cluster-b",
      displayName: "Cluster B",
      clusterName: "Cluster_B",
      clusterDescription: "Cluster B Desc",
      gameMode: "endless",
      maxPlayers: 8,
      clusterToken: "token-b",
      clusterKey: "key-b",
      intent: "social",
      timeZone: "UTC",
      masterHostPort: 12000,
      cavesHostPort: 12001,
      steamHostPort: 28018,
      cavesSteamHostPort: 28019,
      autoStart: true,
    });
  });
});

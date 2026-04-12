import { waitFor } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/api")>("../../../lib/api");
  return {
    ...actual,
    previewClusterPreflight: vi.fn().mockResolvedValue({
      status: "ready",
      fatalCount: 0,
      warningCount: 0,
      checks: [],
    }),
  };
});

import { previewClusterPreflight } from "../../../lib/api";
import { CreateClusterWizard } from "./CreateClusterWizard";

describe("CreateClusterWizard", () => {
  beforeEach(() => {
    vi.mocked(previewClusterPreflight).mockClear();
  });

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
    await user.click(screen.getByLabelText("PVP"));
    await user.click(screen.getByLabelText("Pause when empty"));
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

    await user.type(screen.getByLabelText("Cluster password"), "play-together");
    await user.type(screen.getByLabelText("Cluster token"), "token-b");
    await user.type(screen.getByLabelText("Cluster key"), "key-b");

    await user.click(screen.getByRole("button", { name: "Next: Review" }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText("cluster-b")).toBeInTheDocument();
    expect(screen.getByText("12000")).toBeInTheDocument();
    expect(screen.getByText("playable Master + Caves managed layout")).toBeInTheDocument();
    expect(screen.getByText("Cluster password")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.getByText("PVP")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Pause when empty")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("runtime/data/Cluster_B")).toBeInTheDocument();
    expect(screen.getByText("Switch to the new cluster workspace after creation to continue long-term management.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Preflight" })).toBeInTheDocument();
    expect(previewClusterPreflight).toHaveBeenCalledWith({
      mode: "create",
      slug: "cluster-b",
      displayName: "Cluster B",
      clusterName: "Cluster_B",
      clusterDescription: "Cluster B Desc",
      gameMode: "endless",
      maxPlayers: 8,
      pvp: true,
      pauseWhenEmpty: false,
      clusterPassword: "play-together",
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
      pvp: true,
      pauseWhenEmpty: false,
      clusterPassword: "play-together",
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

  it("shows a blocked preflight warning on the review step", async () => {
    const user = userEvent.setup();
    vi.mocked(previewClusterPreflight).mockResolvedValueOnce({
      status: "blocked",
      fatalCount: 1,
      warningCount: 0,
      checks: [
        {
          code: "token_missing",
          severity: "fatal",
          summary: "cluster_token.txt is missing",
          detail: "Token file was not found.",
          hint: "Add the token before starting the cluster.",
        },
      ],
    });

    render(<CreateClusterWizard onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("Slug"), "cluster-b");
    await user.type(screen.getByLabelText("Display name"), "Cluster B");
    await user.type(screen.getByLabelText("Cluster name"), "Cluster_B");
    await user.click(screen.getByRole("button", { name: "Next: Network" }));
    await user.click(screen.getByRole("button", { name: "Next: Authentication" }));
    await user.type(screen.getByLabelText("Cluster token"), "token-b");
    await user.type(screen.getByLabelText("Cluster key"), "key-b");
    await user.click(screen.getByRole("button", { name: "Next: Review" }));

    expect(await screen.findByText("Auto-start will be blocked until fatal preflight issues are fixed.")).toBeInTheDocument();
    expect(screen.getByText("cluster_token.txt is missing")).toBeInTheDocument();

    await waitFor(() => {
      expect(previewClusterPreflight).toHaveBeenCalledTimes(1);
    });
  });

  it("requires max players to be an integer between 1 and 64", async () => {
    const user = userEvent.setup();

    render(<CreateClusterWizard onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("Slug"), "cluster-b");
    await user.type(screen.getByLabelText("Display name"), "Cluster B");
    await user.type(screen.getByLabelText("Cluster name"), "Cluster_B");
    await user.clear(screen.getByLabelText("Max players"));
    await user.type(screen.getByLabelText("Max players"), "0");

    await user.click(screen.getByRole("button", { name: "Next: Network" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Max players must be an integer between 1 and 64");
    expect(screen.getByRole("heading", { name: "Basics" })).toBeInTheDocument();
  });
});

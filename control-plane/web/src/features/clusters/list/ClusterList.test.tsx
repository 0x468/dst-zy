import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClusterList } from "./ClusterList";

describe("ClusterList", () => {
  it("disables the mutation submit button while a request is in flight", async () => {
    const user = userEvent.setup();
    let resolveMutation: (() => void) | undefined;
    const onMutate = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveMutation = resolve;
    }));

    render(
      <ClusterList
        clusters={[]}
        onMutate={onMutate}
        onSelect={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Slug"), "cluster-a");
    await user.type(screen.getByLabelText("Display name"), "Cluster A");
    await user.type(screen.getByLabelText("Cluster name"), "Cluster_A");
    await user.click(screen.getByRole("button", { name: "Create cluster" }));

    expect(screen.getByRole("button", { name: "Create cluster" })).toBeDisabled();

    resolveMutation?.();
  });

  it("shows a validation error when create is missing required fields", async () => {
    const user = userEvent.setup();
    const onMutate = vi.fn();

    render(
      <ClusterList
        clusters={[]}
        onMutate={onMutate}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create cluster" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Slug is required");
    expect(onMutate).not.toHaveBeenCalled();
  });

  it("requires an import path when import mode is selected", async () => {
    const user = userEvent.setup();
    const onMutate = vi.fn();

    render(
      <ClusterList
        clusters={[]}
        onMutate={onMutate}
        onSelect={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Mode"), "import");
    await user.type(screen.getByLabelText("Slug"), "cluster-a");
    await user.type(screen.getByLabelText("Display name"), "Cluster A");
    await user.type(screen.getByLabelText("Cluster name"), "Cluster_A");
    await user.click(screen.getByRole("button", { name: "Import cluster" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Import path is required");
    expect(onMutate).not.toHaveBeenCalled();
  });

  it("shows a submission error when mutation fails", async () => {
    const user = userEvent.setup();
    const onMutate = vi.fn().mockRejectedValue(new Error("request failed"));

    render(
      <ClusterList
        clusters={[]}
        onMutate={onMutate}
        onSelect={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Slug"), "cluster-a");
    await user.type(screen.getByLabelText("Display name"), "Cluster A");
    await user.type(screen.getByLabelText("Cluster name"), "Cluster_A");
    await user.click(screen.getByRole("button", { name: "Create cluster" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to create cluster");
  });
});

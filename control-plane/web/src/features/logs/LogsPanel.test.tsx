import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LogsPanel } from "./LogsPanel";

describe("LogsPanel", () => {
  it("switches between task, master, and caves logs", async () => {
    const user = userEvent.setup();
    const onSelectSource = vi.fn();
    const onRefresh = vi.fn();

    render(
      <LogsPanel
        selectedSource="jobs"
        content="Task job output"
        onSelectSource={onSelectSource}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText("Task job output")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Master logs" }));
    await user.click(screen.getByRole("button", { name: "Caves logs" }));
    await user.click(screen.getByRole("button", { name: "Refresh logs" }));

    expect(onSelectSource).toHaveBeenNthCalledWith(1, "master");
    expect(onSelectSource).toHaveBeenNthCalledWith(2, "caves");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("renders a titled sign-in card with guidance copy", () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Use your local control-plane account to manage clusters.")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Sign in to DST Control Plane" })).toBeInTheDocument();
  });

  it("disables the submit button while sign in is in flight", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));

    render(<LoginForm onSubmit={onSubmit} />);

    expect(screen.getByRole("form", { name: "Sign in to DST Control Plane" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();

    resolveSubmit?.();
  });
});

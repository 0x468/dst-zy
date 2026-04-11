import { useState } from "react";

import { Panel } from "../../components/ui/Panel";

type LoginFormProps = {
  onSubmit: (username: string, password: string) => Promise<void> | void;
};

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [pending, setPending] = useState(false);

  return (
    <Panel title="Sign in" tone="subtle" className="login-form-card">
      <p className="login-form-card__copy">Use your local control-plane account to manage clusters.</p>
      <form
        className="login-form"
        aria-label="Sign in to DST Control Plane"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setPending(true);

          try {
            await onSubmit(
              String(formData.get("username") ?? ""),
              String(formData.get("password") ?? ""),
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="login-form__field">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" type="text" autoComplete="username" disabled={pending} />
        </div>

        <div className="login-form__field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" disabled={pending} />
        </div>

        <button type="submit" disabled={pending}>Sign in</button>
      </form>
    </Panel>
  );
}

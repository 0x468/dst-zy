import { useState } from "react";

type LoginFormProps = {
  onSubmit: (username: string, password: string) => Promise<void> | void;
};

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [pending, setPending] = useState(false);

  return (
    <form
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
      <div>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" type="text" autoComplete="username" disabled={pending} />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" disabled={pending} />
      </div>

      <button type="submit" disabled={pending}>Sign in</button>
    </form>
  );
}

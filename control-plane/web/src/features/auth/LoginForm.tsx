type LoginFormProps = {
  onSubmit: (username: string, password: string) => Promise<void> | void;
};

export function LoginForm({ onSubmit }: LoginFormProps) {
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        await onSubmit(
          String(formData.get("username") ?? ""),
          String(formData.get("password") ?? ""),
        );
      }}
    >
      <div>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" type="text" autoComplete="username" />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" />
      </div>

      <button type="submit">Sign in</button>
    </form>
  );
}

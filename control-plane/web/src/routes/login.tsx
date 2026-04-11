import { LoginForm } from "../features/auth/LoginForm";

type LoginRouteProps = {
  onSubmit: (username: string, password: string) => Promise<void> | void;
};

export function LoginRoute({ onSubmit }: LoginRouteProps) {
  return (
    <main className="login-shell">
      <header className="login-shell__hero">
        <p className="login-shell__eyebrow">DST server operations</p>
        <h1>DST Control Plane</h1>
        <p>Operate dedicated clusters with a single control surface.</p>
      </header>
      <div className="login-shell__auth">
        <LoginForm onSubmit={onSubmit} />
      </div>
    </main>
  );
}

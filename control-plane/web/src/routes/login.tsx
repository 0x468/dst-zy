import { LoginForm } from "../features/auth/LoginForm";
import { Panel } from "../components/ui/Panel";

type LoginRouteProps = {
  onSubmit: (username: string, password: string) => Promise<void> | void;
};

export function LoginRoute({ onSubmit }: LoginRouteProps) {
  return (
    <section className="login-shell">
      <header className="login-shell__hero">
        <p className="login-shell__eyebrow">DST server operations</p>
        <h1>DST Control Plane</h1>
        <p>Operate dedicated clusters with a single control surface.</p>
      </header>
      <Panel title="Sign in" tone="subtle">
        <section role="form" aria-label="Sign in to DST Control Plane" className="login-shell__auth">
          <LoginForm onSubmit={onSubmit} />
        </section>
      </Panel>
    </section>
  );
}

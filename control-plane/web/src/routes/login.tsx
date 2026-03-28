import { LoginForm } from "../features/auth/LoginForm";

type LoginRouteProps = {
  onSubmit: (username: string, password: string) => Promise<void> | void;
};

export function LoginRoute({ onSubmit }: LoginRouteProps) {
  return (
    <section>
      <h1>DST Control Plane</h1>
      <LoginForm onSubmit={onSubmit} />
    </section>
  );
}

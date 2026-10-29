import { type FormEvent } from 'react';
import type { Session } from '../types.js';
import { Icon } from '../components/Icon.js';
import { Field } from '../components/Field.js';
export function SignIn({
  session,
  login,
  error,
  busy,
}: {
  session: Session;
  login: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  error: string;
  busy: boolean;
}) {
  return (
    <main className="login">
      <div className="login-card">
        <div className="login-brand">
          <Icon name="arrow" size={30} />
          <strong>ANQ Next Step</strong>
        </div>
        <h1>A little more direction.</h1>
        <p>Sign in to your private application workspace.</p>
        <form onSubmit={login}>
          <Field label="Username">
            <input
              name="username"
              required
              autoComplete="username"
              maxLength={80}
              defaultValue={session.username}
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              required
              type="password"
              autoComplete="current-password"
              maxLength={256}
            />
          </Field>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

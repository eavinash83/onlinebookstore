import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { DOMAIN } from '../../shared/domain';
import { authClient } from '../services/authClient';

// Sign in / create account. `?next=` is where to go afterwards (only same-site paths are honoured).
export default function AuthPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const mode = params.get('mode') === 'signup' ? 'signup' : 'signin';
  const next = params.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={target} replace />;

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && !form.name.trim()) return setError('Enter your name');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setBusy(true);
    const { error: err } =
      mode === 'signup'
        ? await authClient.signUp.email({ name: form.name.trim(), email: form.email, password: form.password })
        : await authClient.signIn.email({ email: form.email, password: form.password });
    setBusy(false);
    if (err) return setError(err.message || 'Something went wrong. Please try again.');
    navigate(target, { replace: true });
  };

  const switchMode = () => {
    const nextParams = new URLSearchParams(params);
    if (mode === 'signin') nextParams.set('mode', 'signup');
    else nextParams.delete('mode');
    setParams(nextParams, { replace: true });
    setError('');
  };

  return (
    <div className="container">
      <form className="card auth-card stack" onSubmit={onSubmit} noValidate>
        <h1>{mode === 'signup' ? `Create your ${DOMAIN.appName} account` : 'Sign in'}</h1>
        <div className="form-grid">
          {mode === 'signup' && (
            <label className="field">
              <span>Name</span>
              <input name="name" value={form.name} onChange={set} autoComplete="name" maxLength={100} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={set} autoComplete="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" value={form.password} onChange={set} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
        <p className="auth-switch muted">
          {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
          <button type="button" className="link-btn" onClick={switchMode}>
            {mode === 'signup' ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </form>
    </div>
  );
}

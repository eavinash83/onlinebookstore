import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authClient } from '../services/authClient';

// Layout route: renders the nested routes only for signed-in users, otherwise sends them to /login and back.
export default function RequireAuth() {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();
  if (isPending) return <div className="container"><div className="card skeleton" /></div>;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

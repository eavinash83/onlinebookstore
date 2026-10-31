import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { DOMAIN } from '../../shared/domain';
import { useStore } from '../context/StoreContext';
import { authClient } from '../services/authClient';
import { storage } from '../services/storage';

export default function Header() {
  const { cartCount, wishlist } = useStore();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
    storage.remove('shipping'); // don't leave the previous user's address on a shared browser
    navigate('/');
  };

  // Keep the box in sync when the URL changes (e.g. "clear filters").
  useEffect(() => {
    setQuery(params.get('q') ?? '');
  }, [params]);

  const onSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
  };

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <span aria-hidden>{DOMAIN.icon}</span> {DOMAIN.appName}
        </Link>

        <form className="search" onSubmit={onSubmit} role="search">
          <input
            type="search"
            placeholder="Search titles, authors…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search books"
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        <nav className="nav">
          <NavLink to="/orders">Orders</NavLink>
          <NavLink to="/wishlist" aria-label={`Wishlist, ${wishlist.length} items`}>
            ♡ <span className="nav-label">Wishlist</span>
            {wishlist.length > 0 && <span className="badge">{wishlist.length}</span>}
          </NavLink>
          <NavLink to="/cart" aria-label={`Cart, ${cartCount} items`}>
            🛒 <span className="nav-label">Cart</span>
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </NavLink>
          {session ? (
            <>
              <span className="nav-user muted small" title={session.user.email}>{session.user.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

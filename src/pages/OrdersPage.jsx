import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../services/api';
import { formatDate, formatPrice } from '../utils/format';

export default function OrdersPage() {
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    getOrders().then(setOrders);
  }, []);

  if (orders === null) return <div className="container"><p className="muted">Loading…</p></div>;

  if (orders.length === 0) {
    return (
      <div className="container empty">
        <div className="empty-icon">📦</div>
        <h2>No orders yet</h2>
        <p className="muted">When you place an order it will show up here.</p>
        <Link to="/" className="btn btn-primary">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Your orders</h1>
      <ul className="order-list">
        {orders.map((o) => (
          <li key={o.id} className="card order-row">
            <div>
              <strong>{o.id}</strong>
              <div className="muted small">{formatDate(o.createdAt)}</div>
            </div>
            <div className="order-emojis" aria-hidden>
              {o.items.slice(0, 5).map((i) => <span key={i.id}>{i.emoji}</span>)}
            </div>
            <div className="small">{o.items.reduce((n, i) => n + i.qty, 0)} items</div>
            <span className="status">{o.status}</span>
            <strong>{formatPrice(o.total)}</strong>
            <Link to={`/orders/${o.id}`} className="btn btn-ghost btn-sm">View</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import OrderSummary from '../components/OrderSummary';
import ProductImage from '../components/ProductImage';
import { getOrder } from '../services/api';
import { formatDate, formatPrice } from '../utils/format';

export default function OrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const justPlaced = params.get('placed') === '1';
  const [order, setOrder] = useState(undefined);

  useEffect(() => {
    getOrder(id).then(setOrder);
  }, [id]);

  if (order === undefined) return <div className="container"><p className="muted">Loading…</p></div>;
  if (order === null) {
    return (
      <div className="container empty">
        <div className="empty-icon">🤷</div>
        <h2>Order not found</h2>
        <Link to="/orders" className="btn btn-primary">View all orders</Link>
      </div>
    );
  }

  const s = order.shippingInfo;

  return (
    <div className="container">
      {justPlaced && (
        <div className="success-banner">
          <div className="empty-icon">🎉</div>
          <div>
            <h1>Thank you for your order!</h1>
            <p>
              Order <strong>{order.id}</strong> is confirmed. A (pretend) confirmation has been sent to {s.email}.
            </p>
          </div>
        </div>
      )}

      <nav className="breadcrumbs">
        <Link to="/orders">Orders</Link> / <span>{order.id}</span>
      </nav>

      <div className="two-col">
        <div className="stack">
          <section className="card">
            <div className="page-head">
              <h2>Items</h2>
              <span className="status">{order.status}</span>
            </div>
            <p className="muted small">Placed {formatDate(order.createdAt)}</p>
            <ul className="cart-list plain">
              {order.items.map((i) => (
                <li key={i.id} className="cart-item">
                  <ProductImage product={i} size="sm" />
                  <div className="cart-item-info">
                    <Link to={`/product/${i.id}`} className="cart-item-name">{i.name}</Link>
                    <span className="muted small">{i.qty} × {formatPrice(i.price)}</span>
                  </div>
                  <strong className="cart-item-total">{formatPrice(i.qty * i.price)}</strong>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>Shipping to</h2>
            <p>
              {s.fullName}<br />
              {s.address}<br />
              {s.city}{s.state && `, ${s.state}`} {s.zip}
            </p>
            <p className="muted small">Paid with card ending in {order.paymentLast4}</p>
          </section>
        </div>

        <OrderSummary totals={order}>
          <Link to="/" className="btn btn-primary btn-block">Continue shopping</Link>
        </OrderSummary>
      </div>
    </div>
  );
}

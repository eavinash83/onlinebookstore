import { Link, useNavigate } from 'react-router-dom';
import OrderSummary from '../components/OrderSummary';
import ProductImage from '../components/ProductImage';
import QuantityControl from '../components/QuantityControl';
import { useStore } from '../context/StoreContext';
import { formatPrice } from '../utils/format';

export default function CartPage() {
  const { cart, totals, updateQty, removeFromCart, clearCart, toggleWishlist, isWishlisted } = useStore();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <div className="container empty">
        <div className="empty-icon">🛒</div>
        <h2>Your cart is empty</h2>
        <p className="muted">Looks like you haven’t added anything yet.</p>
        <Link to="/" className="btn btn-primary">Start shopping</Link>
      </div>
    );
  }

  const saveForLater = (item) => {
    if (!isWishlisted(item.id)) toggleWishlist(item.id);
    removeFromCart(item.id);
  };

  return (
    <div className="container">
      <div className="page-head">
        <h1>Shopping cart</h1>
        <button className="btn btn-ghost btn-sm" onClick={clearCart}>Clear cart</button>
      </div>

      <div className="two-col">
        <ul className="card cart-list">
          {cart.map((item) => (
            <li key={item.id} className="cart-item">
              <Link to={`/product/${item.id}`}>
                <ProductImage product={item} size="sm" />
              </Link>
              <div className="cart-item-info">
                <Link to={`/product/${item.id}`} className="cart-item-name">{item.name}</Link>
                <span className="muted small">{formatPrice(item.price)} each</span>
                <div className="cart-item-actions">
                  <QuantityControl value={item.qty} max={item.stock} onChange={(q) => updateQty(item.id, q)} />
                  <button className="link-btn" onClick={() => saveForLater(item)}>Save for later</button>
                  <button className="link-btn danger" onClick={() => removeFromCart(item.id)}>Remove</button>
                </div>
              </div>
              <strong className="cart-item-total">{formatPrice(item.price * item.qty)}</strong>
            </li>
          ))}
        </ul>

        <OrderSummary totals={totals}>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </button>
          <Link to="/" className="btn btn-ghost btn-block">Continue shopping</Link>
        </OrderSummary>
      </div>
    </div>
  );
}

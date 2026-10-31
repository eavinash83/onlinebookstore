import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import OrderSummary from '../components/OrderSummary';
import { useStore } from '../context/StoreContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { placeOrder } from '../services/api';
import { formatPrice } from '../utils/format';

const emptyShipping = { fullName: '', email: '', phone: '', address: '', city: '', state: '', zip: '' };
const emptyPayment = { cardName: '', cardNumber: '', expiry: '', cvc: '' };

function validate(shipping, payment) {
  const e = {};
  if (!shipping.fullName.trim()) e.fullName = 'Full name is required';
  if (!/^\S+@\S+\.\S+$/.test(shipping.email)) e.email = 'Enter a valid email';
  if (!shipping.address.trim()) e.address = 'Address is required';
  if (!shipping.city.trim()) e.city = 'City is required';
  if (!/^[A-Za-z0-9 -]{3,10}$/.test(shipping.zip)) e.zip = 'Enter a valid postal code';
  if (!payment.cardName.trim()) e.cardName = 'Name on card is required';
  if (!/^\d{16}$/.test(payment.cardNumber.replace(/\s/g, ''))) e.cardNumber = 'Card number must be 16 digits';
  const m = payment.expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!m || +m[1] < 1 || +m[1] > 12) e.expiry = 'Use MM/YY';
  else if (new Date(2000 + +m[2], +m[1]) <= new Date()) e.expiry = 'Card has expired';
  if (!/^\d{3,4}$/.test(payment.cvc)) e.cvc = '3–4 digits';
  return e;
}

const formatCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const formatExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function Field({ label, name, value, onChange, error, className = '', ...rest }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <input name={name} value={value} onChange={onChange} aria-invalid={!!error} {...rest} />
      {error && <small className="error">{error}</small>}
    </label>
  );
}

export default function CheckoutPage() {
  const { cart, totals, clearCart } = useStore();
  const navigate = useNavigate();
  // Remember shipping details between visits (never the card).
  const [shipping, setShipping] = usePersistentState('shipping', emptyShipping);
  const [payment, setPayment] = useState(emptyPayment);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (cart.length === 0 && !submitting) return <Navigate to="/cart" replace />;

  const onShipping = (e) => setShipping((s) => ({ ...s, [e.target.name]: e.target.value }));
  const onPayment = (e) => {
    const { name, value } = e.target;
    const v = name === 'cardNumber' ? formatCard(value) : name === 'expiry' ? formatExpiry(value) : name === 'cvc' ? value.replace(/\D/g, '').slice(0, 4) : value;
    setPayment((p) => ({ ...p, [name]: v }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(shipping, payment);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await placeOrder({
        items: cart,
        shippingInfo: shipping,
        paymentLast4: payment.cardNumber.replace(/\s/g, '').slice(-4),
      });
      navigate(`/orders/${order.id}?placed=1`, { replace: true });
      clearCart();
    } catch (err) {
      setSubmitError(err.message || 'Could not place your order. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <nav className="breadcrumbs">
        <Link to="/cart">Cart</Link> / <span>Checkout</span>
      </nav>
      <h1>Checkout</h1>

      <form className="two-col" onSubmit={onSubmit} noValidate>
        <div className="stack">
          <fieldset className="card form-section">
            <legend>Shipping details</legend>
            <div className="form-grid">
              <Field label="Full name" name="fullName" value={shipping.fullName} onChange={onShipping} error={errors.fullName} className="span-2" autoComplete="name" />
              <Field label="Email" name="email" type="email" value={shipping.email} onChange={onShipping} error={errors.email} autoComplete="email" />
              <Field label="Phone (optional)" name="phone" type="tel" value={shipping.phone} onChange={onShipping} autoComplete="tel" />
              <Field label="Address" name="address" value={shipping.address} onChange={onShipping} error={errors.address} className="span-2" autoComplete="street-address" />
              <Field label="City" name="city" value={shipping.city} onChange={onShipping} error={errors.city} autoComplete="address-level2" />
              <Field label="State / Region" name="state" value={shipping.state} onChange={onShipping} autoComplete="address-level1" />
              <Field label="Postal code" name="zip" value={shipping.zip} onChange={onShipping} error={errors.zip} autoComplete="postal-code" />
            </div>
          </fieldset>

          <fieldset className="card form-section">
            <legend>Payment</legend>
            <p className="hint">Demo only — no real payment is taken. Use any 16 digits, e.g. 4242 4242 4242 4242.</p>
            <div className="form-grid">
              <Field label="Name on card" name="cardName" value={payment.cardName} onChange={onPayment} error={errors.cardName} className="span-2" autoComplete="cc-name" />
              <Field label="Card number" name="cardNumber" inputMode="numeric" placeholder="1234 5678 9012 3456" value={payment.cardNumber} onChange={onPayment} error={errors.cardNumber} className="span-2" autoComplete="cc-number" />
              <Field label="Expiry" name="expiry" inputMode="numeric" placeholder="MM/YY" value={payment.expiry} onChange={onPayment} error={errors.expiry} autoComplete="cc-exp" />
              <Field label="CVC" name="cvc" inputMode="numeric" placeholder="123" value={payment.cvc} onChange={onPayment} error={errors.cvc} autoComplete="cc-csc" />
            </div>
          </fieldset>
        </div>

        <OrderSummary totals={totals}>
          <ul className="summary-items">
            {cart.map((i) => (
              <li key={i.id}>
                <span>{i.emoji} {i.name} × {i.qty}</span>
                <span>{formatPrice(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          {submitError && (
            <p className="form-error" role="alert">
              {submitError} <Link to="/cart">Review cart</Link>
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order · ${formatPrice(totals.total)}`}
          </button>
        </OrderSummary>
      </form>
    </div>
  );
}

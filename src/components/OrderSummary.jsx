import { FREE_SHIPPING_THRESHOLD } from '../../shared/pricing';
import { formatPrice } from '../utils/format';

export default function OrderSummary({ totals, children }) {
  const { subtotal, shipping, tax, total } = totals;
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;

  return (
    <aside className="card summary">
      <h2>Order summary</h2>
      <dl>
        <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
        <div><dt>Shipping</dt><dd>{shipping === 0 ? 'Free' : formatPrice(shipping)}</dd></div>
        <div><dt>Estimated tax</dt><dd>{formatPrice(tax)}</dd></div>
        <div className="summary-total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
      </dl>
      {subtotal > 0 && remaining > 0 && (
        <p className="hint">Add {formatPrice(remaining)} more for free shipping.</p>
      )}
      {children}
    </aside>
  );
}

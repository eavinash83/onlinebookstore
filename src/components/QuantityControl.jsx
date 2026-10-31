export default function QuantityControl({ value, max, onChange, min = 1 }) {
  return (
    <div className="qty" role="group" aria-label="Quantity">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease quantity">
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}

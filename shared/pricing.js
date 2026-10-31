// Pricing rules shared by the server (source of truth for orders) and the client (cart preview).
export const SHIPPING_FLAT = 5.99;
export const FREE_SHIPPING_THRESHOLD = 50;
export const TAX_RATE = 0.08;

const round = (n) => Math.round(n * 100) / 100;

export function calculateTotals(items) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const tax = subtotal * TAX_RATE;
  return { subtotal: round(subtotal), shipping, tax: round(tax), total: round(subtotal + shipping + tax) };
}

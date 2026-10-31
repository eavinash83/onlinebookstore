// Client for the Express API in server/api.js. Pages only talk to the backend through here.
async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' }, // the Better Auth session cookie is sent automatically (same origin)
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error ?? `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Resolves to null instead of throwing when the thing doesn't exist.
const orNull = (promise) => promise.catch((err) => (err.status === 404 ? null : Promise.reject(err)));

export const getCategories = () => request('/categories');

export function getProducts({ search, category, sort, maxPrice, ids } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category && category !== 'All') params.set('category', category);
  if (sort) params.set('sort', sort);
  if (maxPrice != null && Number.isFinite(maxPrice)) params.set('maxPrice', maxPrice);
  if (ids) params.set('ids', ids.join(','));
  const qs = params.toString();
  return request(`/products${qs ? `?${qs}` : ''}`);
}

export const getProduct = (id) => orNull(request(`/products/${encodeURIComponent(id)}`));

export const getRelatedProducts = (product) => request(`/products/${encodeURIComponent(product.id)}/related`);

export const placeOrder = ({ items, shippingInfo, paymentLast4 }) =>
  request('/orders', {
    method: 'POST',
    body: { items: items.map(({ id, qty }) => ({ id, qty })), shippingInfo, paymentLast4 },
  });

export const getOrders = () => request('/orders');

export const getOrder = (id) => orNull(request(`/orders/${encodeURIComponent(id)}`));

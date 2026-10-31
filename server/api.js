import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';
import * as db from './db.js';
import { HttpError } from './errors.js';

const router = Router();

// Every order route needs a signed-in user (Better Auth session cookie). Browsing the catalogue stays public.
async function requireUser(req, res, next) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new HttpError(401, 'Please sign in');
  req.user = session.user;
  next();
}

router.get('/health', async (req, res) => {
  await db.pool.query('SELECT 1');
  res.json({ ok: true, db: 'up' });
});

router.get('/categories', async (req, res) => {
  res.json(await db.listCategories());
});

router.get('/products', async (req, res) => {
  const { search, category, sort, maxPrice, ids } = req.query;
  res.json(
    await db.listProducts({
      search: search ? String(search).trim().slice(0, 100) : '',
      category: category ? String(category) : 'All',
      sort: sort ? String(sort) : 'featured',
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      ids: ids ? String(ids).split(',').filter(Boolean).slice(0, 100) : undefined,
    }),
  );
});

router.get('/products/:id', async (req, res) => {
  const product = await db.getProduct(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(product);
});

router.get('/products/:id/related', async (req, res) => {
  const product = await db.getProduct(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(await db.getRelatedProducts(product));
});

// Shape checks only; prices and stock are resolved inside the database transaction.
function validateOrder(body) {
  const { items, shippingInfo: s, paymentLast4 } = body ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Order must contain at least one item');
  if (items.length > 50) throw new HttpError(400, 'Too many items in one order');
  for (const item of items) {
    if (typeof item?.id !== 'string' || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100) {
      throw new HttpError(400, 'Each item needs an id and a quantity between 1 and 100');
    }
  }
  if (!s || typeof s !== 'object') throw new HttpError(400, 'Shipping details are required');
  for (const field of ['fullName', 'email', 'address', 'city', 'zip']) {
    if (typeof s[field] !== 'string' || !s[field].trim()) throw new HttpError(400, `Shipping field "${field}" is required`);
  }
  if (!/^\S+@\S+\.\S+$/.test(s.email)) throw new HttpError(400, 'Invalid email address');
  if (!/^\d{4}$/.test(String(paymentLast4))) throw new HttpError(400, 'Invalid payment details');

  const shippingInfo = Object.fromEntries(
    ['fullName', 'email', 'phone', 'address', 'city', 'state', 'zip'].map((k) => [k, String(s[k] ?? '').trim().slice(0, 200)]),
  );
  return { items: items.map(({ id, qty }) => ({ id, qty })), shippingInfo, paymentLast4: String(paymentLast4) };
}

router.use('/orders', requireUser);

router.post('/orders', async (req, res) => {
  const order = await db.createOrder({ userId: req.user.id, ...validateOrder(req.body) });
  res.status(201).json(order);
});

router.get('/orders', async (req, res) => {
  res.json(await db.listOrders(req.user.id));
});

router.get('/orders/:id', async (req, res) => {
  const order = await db.getOrder(req.params.id, req.user.id);
  if (!order) throw new HttpError(404, 'Order not found');
  res.json(order);
});

router.use((req, res) => res.status(404).json({ error: 'Not found' }));

export default router;

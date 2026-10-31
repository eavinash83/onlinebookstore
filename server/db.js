// Postgres persistence on Neon via the official serverless driver.
// The Pool speaks the Postgres protocol over WebSockets, so it supports interactive transactions.
import crypto from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { calculateTotals } from '../shared/pricing.js';
import { HttpError } from './errors.js';
import { seedProducts } from './seed-books.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.');
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => console.error('Idle database client error:', err.message));

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    author      text NOT NULL DEFAULT '',
    category    text NOT NULL,
    price       numeric(10,2) NOT NULL CHECK (price >= 0),
    rating      numeric(2,1) NOT NULL DEFAULT 0,
    reviews     integer NOT NULL DEFAULT 0,
    stock       integer NOT NULL CHECK (stock >= 0),
    emoji       text NOT NULL DEFAULT '',
    color       text NOT NULL DEFAULT '',
    featured    boolean NOT NULL DEFAULT false,
    description text NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            text PRIMARY KEY,
    user_id       text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, -- Better Auth's user table (created by migrateAuth() first)
    created_at    timestamptz NOT NULL DEFAULT now(),
    status        text NOT NULL DEFAULT 'Processing',
    shipping_info jsonb NOT NULL,
    payment_last4 char(4) NOT NULL,
    subtotal      numeric(10,2) NOT NULL,
    shipping      numeric(10,2) NOT NULL,
    tax           numeric(10,2) NOT NULL,
    total         numeric(10,2) NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders (user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS order_items (
    order_id   text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id text NOT NULL REFERENCES products(id),
    name       text NOT NULL,
    author     text NOT NULL DEFAULT '',
    category   text NOT NULL,
    price      numeric(10,2) NOT NULL,
    emoji      text NOT NULL DEFAULT '',
    color      text NOT NULL DEFAULT '',
    qty        integer NOT NULL CHECK (qty > 0),
    PRIMARY KEY (order_id, product_id)
  );
`;

// numeric columns come back as strings from Postgres; cast to float8 so the API returns numbers.
const PRODUCT_COLUMNS = `id, name, author, category, price::float8 AS price, rating::float8 AS rating, reviews, stock,
  emoji, color, featured, description`;

const ORDER_SELECT = `
  SELECT o.id, o.created_at AS "createdAt", o.status, o.shipping_info AS "shippingInfo",
         o.payment_last4 AS "paymentLast4", o.subtotal::float8 AS subtotal, o.shipping::float8 AS shipping,
         o.tax::float8 AS tax, o.total::float8 AS total,
         COALESCE(json_agg(json_build_object(
           'id', i.product_id, 'name', i.name, 'author', i.author, 'category', i.category, 'price', i.price::float8,
           'emoji', i.emoji, 'color', i.color, 'qty', i.qty) ORDER BY i.name)
           FILTER (WHERE i.order_id IS NOT NULL), '[]') AS items
  FROM orders o LEFT JOIN order_items i ON i.order_id = o.id`;

const SORTS = {
  featured: 'featured DESC, rating DESC, name',
  'price-asc': 'price ASC, name',
  'price-desc': 'price DESC, name',
  rating: 'rating DESC, name',
  name: 'name ASC',
};

// Creates tables if needed and seeds the catalogue the first time. Call migrateAuth() (server/auth.js) before this: orders reference the auth user table.
export async function initDb() {
  await pool.query(SCHEMA);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM products');
  if (rows[0].n === 0) {
    const cols = ['id', 'name', 'author', 'category', 'price', 'rating', 'reviews', 'stock', 'emoji', 'color', 'featured', 'description'];
    const values = [];
    const tuples = seedProducts.map((p, r) => {
      cols.forEach((c) => values.push(c === 'featured' ? Boolean(p.featured) : p[c]));
      return `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(', ')})`;
    });
    await pool.query(`INSERT INTO products (${cols.join(', ')}) VALUES ${tuples.join(', ')} ON CONFLICT (id) DO NOTHING`, values);
    console.log(`Seeded ${seedProducts.length} products`);
  }
}

export async function listCategories() {
  const { rows } = await pool.query('SELECT DISTINCT category FROM products ORDER BY category');
  return rows.map((r) => r.category);
}

export async function listProducts({ search, category, sort, maxPrice, ids } = {}) {
  const where = [];
  const params = [];
  const param = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (ids?.length) where.push(`id = ANY(${param(ids)})`);
  if (category && category !== 'All') where.push(`category = ${param(category)}`);
  if (Number.isFinite(maxPrice)) where.push(`price <= ${param(maxPrice)}`);
  if (search) {
    const p = param(`%${search.replace(/[\\%_]/g, '\\$&')}%`); // escape LIKE wildcards
    where.push(`(name ILIKE ${p} OR author ILIKE ${p} OR description ILIKE ${p} OR category ILIKE ${p})`);
  }

  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${SORTS[sort] ?? SORTS.featured}`,
    params,
  );
  return rows;
}

export async function getProduct(id) {
  const { rows } = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getRelatedProducts(product, limit = 4) {
  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE category = $1 AND id <> $2 ORDER BY rating DESC LIMIT $3`,
    [product.category, product.id, limit],
  );
  return rows;
}

// Reserves stock and records the order atomically: either every line succeeds or nothing changes.
export async function createOrder({ userId, items, shippingInfo, paymentLast4 }) {
  // Merge duplicate lines and lock rows in a stable order to avoid deadlocks between concurrent checkouts.
  const wanted = new Map();
  for (const { id, qty } of items) wanted.set(id, (wanted.get(id) ?? 0) + qty);
  const ids = [...wanted.keys()].sort();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lines = [];
    for (const id of ids) {
      const qty = wanted.get(id);
      const { rows } = await client.query(
        `UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2
         RETURNING id, name, author, category, price::float8 AS price, emoji, color`,
        [id, qty],
      );
      if (rows.length === 0) {
        const { rows: found } = await client.query('SELECT name, stock FROM products WHERE id = $1', [id]);
        if (!found.length) throw new HttpError(400, `Unknown product: ${id}`);
        const { name, stock } = found[0];
        throw new HttpError(409, stock === 0 ? `${name} is out of stock` : `Only ${stock} of ${name} left in stock`);
      }
      lines.push({ ...rows[0], qty });
    }

    const totals = calculateTotals(lines);
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    await client.query(
      `INSERT INTO orders (id, user_id, shipping_info, payment_last4, subtotal, shipping, tax, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orderId, userId, shippingInfo, paymentLast4, totals.subtotal, totals.shipping, totals.tax, totals.total],
    );
    for (const l of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, author, category, price, emoji, color, qty)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [orderId, l.id, l.name, l.author, l.category, l.price, l.emoji, l.color, l.qty],
      );
    }

    await client.query('COMMIT');
    return getOrder(orderId, userId);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function listOrders(userId) {
  const { rows } = await pool.query(
    `${ORDER_SELECT} WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function getOrder(id, userId) {
  const { rows } = await pool.query(`${ORDER_SELECT} WHERE o.id = $1 AND o.user_id = $2 GROUP BY o.id`, [id, userId]);
  return rows[0] ?? null;
}

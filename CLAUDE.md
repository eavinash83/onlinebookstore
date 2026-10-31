# CLAUDE.md

Guidance for Claude Code working in this repository.

## Commands

```bash
npm run dev        # Express + Vite middleware on http://localhost:3000 (one process, React HMR)
npm run build      # vite build -> dist/
npm start          # production: Express serves /api + dist/
npm run db:reset   # DROPS products/orders/order_items and re-seeds the catalogue (auth users are kept)
```

No tests or linter. Verify with `npm run build`, `node --check` on `server/` and `shared/`, and curl against `/api`. `DATABASE_URL` (Neon) and `BETTER_AUTH_SECRET` (>= 32 chars) come from `.env`; the server exits without them.

`npm run dev` has no auto-restart on purpose (Vite's `.vite/deps_temp_*` writes cause restart loops on Windows). Restart manually after editing `server/` or `shared/`.

## Architecture

One Node process, one Docker image. `server/index.js` mounts Better Auth (`/api/auth/*splat`) **before** `express.json()`, then `/api`, then Vite (dev) or `dist/` (prod). Request path: `src/services/api.js` -> `server/api.js` (routing + shape validation) -> `server/db.js` (all SQL). Throw `HttpError(status, msg)` anywhere; the central handler masks 5xx.

Startup order matters: `migrateAuth()` (creates Better Auth tables) runs before `initDb()` because `orders.user_id` references `"user"(id)`.

## Invariants

- **Server-authoritative prices and stock.** The client sends `{ id, qty }` only. `createOrder` re-prices from `products` in one transaction using `UPDATE ... SET stock = stock - qty WHERE stock >= qty`, merging lines and locking in sorted id order. 409 on insufficient stock; any failing line rolls back everything.
- **Pricing rules in `shared/pricing.js`** (shipping flat/free threshold, tax) are used by both server and cart preview.
- **Cast `numeric` to `float8` in every SELECT** (`PRODUCT_COLUMNS`, `ORDER_SELECT`).
- **Order lines snapshot** name, author, category, price at purchase time.
- **Auth**: browsing is public; every `/api/orders` route is behind `requireUser`; queries are scoped by `req.user.id` and other users' orders are 404. Never accept a user id from the client.
- Cart, wishlist and saved shipping details live in the browser (`StoreContext`, `usePersistentState`, keys prefixed `bookstore:`). Cart lines can go stale; the server check is the real guard. Sign-out clears the saved shipping address.
- React, Vite and react-router are devDependencies; only Express, the Neon driver and `better-auth` ship in prod.
- `useEffect` callbacks use block bodies; async effects use a `cancelled` flag.

## Layout

`server/seed-books.js` is the catalogue seed (inserted only when `products` is empty). Internal names still say `product` (tables, routes, components) while the UI says "book"; `author` is the book-specific column.

## Local environment notes

- Developed in `C:\dev\bookstore` (not a cloud-synced folder). `.env` holds the real Neon string and is git-ignored.
- Node 24 portable install; shells started earlier may need it on PATH.

# Bookstore 📚

An online bookstore: browse and search a catalogue, keep a cart and wishlist, create an account, check out (mock payment) and view your order history.

One Node process serves the Express 5 API (`/api`) and the React (Vite) app, with Neon Postgres for data and Better Auth for accounts.

## Run

```bash
npm install
cp .env.example .env     # set DATABASE_URL (Neon) and BETTER_AUTH_SECRET (>= 32 chars, command in .env.example)
npm run dev              # http://localhost:3000
npm run prod             # build + serve production bundle
npm run db:reset         # DROPS products/orders and re-seeds the catalogue
```

Requires Node 22+. Restart `npm run dev` manually after editing `server/` or `shared/`.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (required) |
| `BETTER_AUTH_SECRET` | Session signing secret, >= 32 chars (required) |
| `BETTER_AUTH_URL` | Public origin; required in production unless on Render |
| `PORT` | Defaults to 3000 |

## API

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | public |
| GET | `/api/categories` | public |
| GET | `/api/products?search&category&sort&maxPrice&ids` | public |
| GET | `/api/products/:id`, `/api/products/:id/related` | public |
| `*` | `/api/auth/*` (sign-up/email, sign-in/email, sign-out, get-session) | Better Auth |
| POST | `/api/orders` | signed in |
| GET | `/api/orders`, `/api/orders/:id` | signed in (own orders only; others 404) |

The client sends only `{ id, qty }` per line; prices and stock are checked server-side inside one transaction (`UPDATE ... WHERE stock >= qty`). Shipping and tax rules live in `shared/pricing.js`.

## Deploy

Single Docker image (`Dockerfile`). A Render blueprint (`render.yaml`), GitHub Actions pipeline (`.github/workflows/ci-cd.yml`) and `npm run render:*` helpers are included; see the skill's `references/deploy.md`. Set `DATABASE_URL` and `BETTER_AUTH_SECRET` as host secrets, never in the image.

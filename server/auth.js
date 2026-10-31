// Better Auth: email + password accounts, cookie sessions, all stored in the same Neon Postgres.
// The Neon Pool is pg-compatible, so Better Auth uses it directly (no `pg` package needed).
// It serves its own endpoints under /api/auth/* (mounted in server/index.js).
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { pool } from './db.js';

const isProd = process.env.NODE_ENV === 'production';
// BETTER_AUTH_URL wins; Render injects RENDER_EXTERNAL_URL (https://<service>.onrender.com) for web services.
const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (isProd ? undefined : `http://localhost:${Number(process.env.PORT) || 3000}`);

if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
  console.error('BETTER_AUTH_SECRET is missing or shorter than 32 characters. See .env.example for how to generate one.');
  process.exit(1);
}
if (!baseURL) {
  console.error('BETTER_AUTH_URL is required in production (the public origin of the app, e.g. https://app.example.com).');
  process.exit(1);
}

export const auth = betterAuth({
  appName: 'Bookstore',
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Turn on once an email provider exists (also set emailVerification.sendVerificationEmail).
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: { enabled: true, maxAge: 5 * 60 }, // skip a DB read on most requests
  },
  advanced: { useSecureCookies: isProd },
});

// Creates/updates Better Auth's tables (user, session, account, verification). Idempotent; run on every start,
// before initDb() because orders reference "user".
export async function migrateAuth() {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

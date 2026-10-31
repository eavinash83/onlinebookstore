// Single entry point: serves the JSON API under /api and the React app on every other route.
//   npm run dev   → Vite runs inside Express as middleware (hot reload, one process)
//   npm start     → serves the production build from dist/
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import api from './api.js';
import { auth, migrateAuth } from './auth.js';
import { initDb, pool } from './db.js';

const isDev = process.argv.includes('--dev');
const PORT = Number(process.env.PORT) || 3000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const app = express();
app.disable('x-powered-by');
// Better Auth reads the raw request body itself: mount it BEFORE express.json(). Express 5 needs the named splat.
app.all('/api/auth/*splat', toNodeHandler(auth));
app.use(express.json({ limit: '100kb' }));
app.use('/api', api);

const server = http.createServer(app);

if (isDev) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server } },
  });
  app.use(vite.middlewares);
} else {
  const dist = path.join(root, 'dist');
  const indexHtml = path.join(dist, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.error('No production build found. Run "npm run build" first.');
    process.exit(1);
  }
  // Hashed bundles can be cached forever; index.html must always be revalidated.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next();
    res.set('Cache-Control', 'no-cache').sendFile(indexHtml);
  });
}

app.use((err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

await migrateAuth(); // auth tables first: orders reference them
await initDb();
console.log('Connected to Postgres');

server.listen(PORT, () => {
  console.log(`Bookstore (${isDev ? 'development' : 'production'}) running at http://localhost:${PORT}`);
});

// Hosts send SIGTERM on redeploy: stop accepting requests, then release DB connections.
process.on('SIGTERM', () => {
  server.close(() => pool.end().finally(() => process.exit(0)));
});

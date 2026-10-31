// Drops all tables and re-seeds. Deletes every order — dev use only.
import { migrateAuth } from './auth.js';
import { initDb, pool } from './db.js';

await pool.query('DROP TABLE IF EXISTS order_items, orders, products');
await migrateAuth();
await initDb();
console.log('Database reset: tables recreated and re-seeded.');
await pool.end();

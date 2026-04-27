/**
 * migrate-supabase.js
 * Runs schema + seed SQL against the Supabase Postgres instance.
 * Run with: node --env-file-if-exists=/vercel/share/.env.project scripts/migrate-supabase.js
 */
const { Pool } = require('pg');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('[migrate] Connected to Supabase.');

    const schema = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');
    console.log('[migrate] Running schema.sql …');
    await client.query(schema);
    console.log('[migrate] schema.sql done.');

    const seed = readFileSync(resolve(__dirname, '../db/seed.sql'), 'utf8');
    console.log('[migrate] Running seed.sql …');
    await client.query(seed);
    console.log('[migrate] seed.sql done.');

    console.log('[migrate] All done! Database is ready.');
  } catch (err) {
    console.error('[migrate] ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

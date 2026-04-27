const { Pool } = require('pg');

// Disable SSL cert validation for Supabase's self-signed chain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use Supabase connection string (POSTGRES_URL) when available,
// otherwise fall back to individual env vars for local dev.
const pool = process.env.POSTGRES_URL
  ? new Pool({ connectionString: process.env.POSTGRES_URL })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'aau_cafe',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

module.exports = { pool };

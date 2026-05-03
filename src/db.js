require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log('Connected to Neon PostgreSQL'))
  .catch(err => console.error('Database connection error:', err.message));

module.exports = { pool };

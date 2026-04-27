const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

(async () => {
  try {
    const result = await pool.query('SELECT username, password_hash, role FROM app_user');
    console.log('Users in database:');
    console.log(result.rows);
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  connectionTimeoutMillis: 15000,
});

(async () => {
  try {
    const adminHash = '$2b$10$v5W8DH0IB1l6d7VOWGtn4uNNtMlGwuAil7HMfFLG79WDDFhNrHhIC';
    const studentHash = '$2b$10$ni4gxvte1j2Fc1n7b5gf1eMPVF7WlJoU61fPZt7roXD1DDNWBTd2S';

    // Update admin
    await pool.query(
      'UPDATE app_user SET password_hash = $1 WHERE username = $2',
      [adminHash, 'admin']
    );
    console.log('✓ Updated admin password to: Admin@123');

    // Update students
    await pool.query(
      'UPDATE app_user SET password_hash = $1 WHERE username IN ($2, $3)',
      [studentHash, 'abebe1001', 'derartu1002']
    );
    console.log('✓ Updated student passwords to: Student@123');

    await pool.end();
    console.log('\nCredentials ready!');
    console.log('Admin: admin / Admin@123');
    console.log('Students: abebe1001 / Student@123 or derartu1002 / Student@123');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

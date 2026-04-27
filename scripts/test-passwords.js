const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  connectionTimeoutMillis: 15000,
});

(async () => {
  try {
    const adminHash = '$2b$10$OjUMAwKU1b4.DqXoVwLPOeMRFx1RtQBoubvsWa1yXRe5oXvZe2.32';
    const studentHash = '$2b$10$Uk5ZjvaKnq.IqVXjqBzzZeMD3y314Klg5PQBMC0KX0C04dslEhoau';

    const testPasswords = ['Admin1234', 'admin', 'password', 'Student1234', 'student'];

    console.log('Testing admin hash:');
    for (const pwd of testPasswords) {
      const match = await bcrypt.compare(pwd, adminHash);
      if (match) console.log(`  ✓ MATCHES: "${pwd}"`);
    }

    console.log('\nTesting student hash:');
    for (const pwd of testPasswords) {
      const match = await bcrypt.compare(pwd, studentHash);
      if (match) console.log(`  ✓ MATCHES: "${pwd}"`);
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

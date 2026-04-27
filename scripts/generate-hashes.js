const bcrypt = require('bcryptjs');

(async () => {
  const admin = await bcrypt.hash('Admin@123', 10);
  const student = await bcrypt.hash('Student@123', 10);
  
  console.log('Admin password (Admin@123):');
  console.log(admin);
  console.log('\nStudent password (Student@123):');
  console.log(student);
})();

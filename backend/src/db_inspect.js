require("dotenv").config();
const { pool } = require("./db");

async function main() {
  const db = await pool.query("select current_database() as db, current_user as usr");
  console.log("DB:", db.rows[0]);

  const cols = await pool.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='student' order by ordinal_position"
  );
  console.log("student columns:", cols.rows.map((r) => r.column_name).join(", "));

  const tables = await pool.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name in ('student_feedback','dormitory','stipend_transaction') order by table_name"
  );
  console.log("key tables present:", tables.rows.map((r) => r.table_name).join(", ") || "(none)");
}

main()
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });


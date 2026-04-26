require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

function splitSql(sqlText) {
  // Remove full-line comments that start with --
  const withoutLineComments = sqlText
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  // Split by semicolon; schema/seed here don't use stored procs or $$ blocks
  return withoutLineComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runFile(absPath) {
  const content = fs.readFileSync(absPath, "utf8");
  const statements = splitSql(content);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log(`OK: ${path.basename(absPath)} (${statements.length} statements)`);
}

async function main() {
  const root = path.join(__dirname, "..", "..");
  const schemaPath = path.join(root, "db", "schema.sql");
  const seedPath = path.join(root, "db", "seed.sql");

  const db = await pool.query("select current_database() as db, current_user as usr");
  console.log("Resetting DB:", db.rows[0]);
  console.log("WARNING: This will DROP and recreate tables.");

  await runFile(schemaPath);
  await runFile(seedPath);
  console.log("DONE.");
}

main()
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });


import pg from "pg";

async function main() {
  console.log("Connecting to database...");

  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://hyperscape:hyperscape_dev@localhost:5432/hyperscape",
  });

  try {
    // List tables
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(
      "Tables:",
      res.rows.map((r) => r.table_name),
    );

    // Count users
    const countRes = await pool.query("SELECT COUNT(*) FROM users");
    console.log("User count:", countRes.rows[0].count);

    // List users
    const usersRes = await pool.query(
      'SELECT * FROM users ORDER BY "createdAt" DESC LIMIT 5',
    );
    console.log("Last 5 users:", usersRes.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

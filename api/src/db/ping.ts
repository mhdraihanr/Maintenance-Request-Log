import { pool } from "./pool";

try {
  const result = await pool.query("SELECT version() AS version");
  console.log("Database terhubung ✅");
  console.log(result.rows[0]?.version);
} catch (err) {
  console.error("Gagal terhubung ke database ❌");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}

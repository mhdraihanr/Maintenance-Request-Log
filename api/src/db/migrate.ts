import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../db/migrations",
);

const ADVISORY_LOCK_KEY = 7231001;

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

async function loadMigrationFiles(): Promise<string[]> {
  let entries: string[];

  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Folder migrasi tidak ditemukan: ${MIGRATIONS_DIR}`);
      process.exit(1);
    }
    throw err;
  }

  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function run(): Promise<void> {
  const files = await loadMigrationFiles();

  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);

    await client.query(CREATE_TRACKING_TABLE);

    const applied = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations",
    );
    const appliedSet = new Set(applied.rows.map((row) => row.version));

    const pending = files.filter((name) => !appliedSet.has(name));

    if (pending.length === 0) {
      console.log(
        `Tidak ada migrasi baru. ${appliedSet.size} migrasi sudah diterapkan.`,
      );
      return;
    }

    console.log(
      `${pending.length} migrasi akan diterapkan (dari ${files.length} file).`,
    );

    for (const name of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [name],
        );
        await client.query("COMMIT");
        console.log(`  ✅ ${name}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ❌ ${name} gagal — transaksi di-rollback.`);
        throw err;
      }
    }

    console.log("Migrasi selesai.");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
    client.release();
    await pool.end();
  }
}

try {
  await run();
} catch (err) {
  console.error("Migrasi gagal.");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}

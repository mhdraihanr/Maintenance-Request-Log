import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// `tsc` dengan moduleResolution "bundler" membiarkan import relatif tanpa
// ekstensi di output. Node ESM menolaknya saat runtime, jadi dist/ perlu
// diperbaiki setelah compile. tsc berhenti menambahkan ekstensi karena
// menganggap ada bundler di hilir — di sini tidak ada.
const SPECIFIER = /(\b(?:from|import)\s*\(?\s*)(["'])(\.\.?\/[^"']*?)\2/g;

async function rewrite(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await rewrite(full);
      continue;
    }

    if (!entry.name.endsWith(".js")) continue;

    const before = await readFile(full, "utf8");
    const after = before.replace(SPECIFIER, (match, head, quote, spec) =>
      spec.endsWith(".js") ? match : `${head}${quote}${spec}.js${quote}`,
    );

    if (after !== before) await writeFile(full, after);
  }
}

const target = process.argv[2];

if (!target) {
  console.error("Pakai: node scripts/rewrite-imports.mjs <folder-hasil-build>");
  process.exit(1);
}

await rewrite(target);

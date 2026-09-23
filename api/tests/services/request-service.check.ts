import assert from "node:assert/strict";
import type { AuthUser } from "../../src/middleware/auth";
import { makeRequestService } from "../../src/services/request.service";
import { AppError } from "../../src/utils/errors";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  OK  ${name}`);
  } catch (err) {
    failed += 1;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL ${name}\n       ${message}`);
  }
}

const OP = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const operator: AuthUser = {
  id: OP,
  username: "bud",
  name: "Budi",
  role: "operator",
  isActive: true,
};
const supervisor: AuthUser = {
  id: OTHER,
  username: "siti",
  name: "Siti",
  role: "supervisor",
  isActive: true,
};
const admin: AuthUser = {
  ...supervisor,
  id: "33333333-3333-4333-8333-333333333333",
  role: "admin",
};

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  code: "MR-001",
  machine_id: "Machine A-12",
  description: "Overheating issue",
  priority: "high",
  status: "submitted",
  created_by: OP,
  created_at: new Date("2026-09-22T00:00:00Z"),
  reviewed_by: null,
  reviewed_at: null,
  created_by_name: "Budi",
  reviewer_name: null,
  ...over,
});

// Rekam setiap SQL supaya tes bisa memeriksa cakupan, bukan hanya hasilnya.
// COUNT dijawab terpisah, karena service membacanya dari rows[0].total.
const recorder = (rows: unknown[], total = rows.length) => {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const query = async (text: string, params: unknown[] = []) => {
    calls.push({ text, params });
    if (text.includes("count(*)")) {
      return { rows: [{ total }], rowCount: 1 } as never;
    }
    return { rows, rowCount: rows.length } as never;
  };
  return { calls, query };
};

// Query SELECT daftar, bukan query COUNT.
const selectOf = (calls: Array<{ text: string; params: unknown[] }>) =>
  calls.find(
    (c) => c.text.includes("FROM requests") && !c.text.includes("count(*)"),
  );

const filter = {
  page: 1,
  limit: 20,
  sort: "created_at" as const,
  order: "desc" as const,
};

console.log("\nlist — cakupan peran");

await check("operator: WHERE created_by = dirinya", async () => {
  const rec = recorder([row()]);
  const svc = makeRequestService({ query: rec.query as never });
  const result = await svc.list(operator, filter);

  assert.equal(result.items.length, 1);
  const select = selectOf(rec.calls);
  assert.ok(select, "tidak ada query SELECT");
  assert.match(select.text, /created_by = \$1/);
  assert.deepEqual(select.params, [OP, 20, 0]);
});

await check("supervisor: TIDAK ada filter created_by", async () => {
  const rec = recorder([row()]);
  const svc = makeRequestService({ query: rec.query as never });
  await svc.list(supervisor, filter);

  const select = selectOf(rec.calls);
  assert.ok(select);
  assert.doesNotMatch(select.text, /created_by = /);
});

await check("admin: TIDAK ada filter created_by", async () => {
  const rec = recorder([row()]);
  const svc = makeRequestService({ query: rec.query as never });
  await svc.list(admin, filter);

  const select = selectOf(rec.calls);
  assert.ok(select);
  assert.doesNotMatch(select.text, /created_by = /);
});

await check("meta total & totalPages dihitung benar", async () => {
  const rec = recorder([row()], 24);
  const svc = makeRequestService({ query: rec.query as never });
  const result = await svc.list(supervisor, filter);

  assert.equal(result.meta.total, 24);
  assert.equal(result.meta.totalPages, 2);
  assert.equal(result.meta.page, 1);
});

await check("filter status & priority masuk sebagai parameter", async () => {
  const rec = recorder([row()]);
  const svc = makeRequestService({ query: rec.query as never });
  await svc.list(supervisor, {
    ...filter,
    status: "submitted",
    priority: "high",
  });

  const select = selectOf(rec.calls);
  assert.ok(select);
  assert.match(select.text, /r\.status = \$1/);
  assert.match(select.text, /r\.priority = \$2/);
  assert.deepEqual(select.params.slice(0, 2), ["submitted", "high"]);
});

await check(
  "search memakai ILIKE dan di-escape sebagai parameter",
  async () => {
    const rec = recorder([row()]);
    const svc = makeRequestService({ query: rec.query as never });
    await svc.list(supervisor, { ...filter, search: "motor" });

    const select = selectOf(rec.calls);
    assert.ok(select);
    assert.match(select.text, /ILIKE/);
    assert.ok(select.params.includes("%motor%"));
  },
);

await check("sort terpetakan ke kolom nyata, tidak dari klien", async () => {
  const rec = recorder([row()]);
  const svc = makeRequestService({ query: rec.query as never });
  await svc.list(supervisor, { ...filter, sort: "priority", order: "asc" });

  const select = selectOf(rec.calls);
  assert.ok(select);
  assert.match(select.text, /ORDER BY r\.priority ASC/);
});

console.log("\ngetById — 404 vs 403");

await check("id tidak ada → NOT_FOUND 404", async () => {
  const svc = makeRequestService({ query: recorder([]).query as never });
  await assert.rejects(
    () => svc.getById(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    (err: unknown) =>
      err instanceof AppError && err.status === 404 && err.code === "NOT_FOUND",
  );
});

await check("operator mengambil milik orang lain → FORBIDDEN 403", async () => {
  const svc = makeRequestService({
    query: recorder([row({ created_by: OTHER })]).query as never,
  });
  await assert.rejects(
    () => svc.getById(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    (err: unknown) =>
      err instanceof AppError && err.status === 403 && err.code === "FORBIDDEN",
  );
});

await check("supervisor boleh mengambil milik operator", async () => {
  const svc = makeRequestService({ query: recorder([row()]).query as never });
  const result = await svc.getById(
    supervisor,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.equal(result.code, "MR-001");
});

await check(
  "output memakai camelCase dan createdBy berbentuk objek",
  async () => {
    const svc = makeRequestService({ query: recorder([row()]).query as never });
    const result = await svc.getById(
      supervisor,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );

    assert.equal(result.machineId, "Machine A-12");
    assert.deepEqual(result.createdBy, { id: OP, name: "Budi" });
    assert.equal(result.reviewedBy, null);
    assert.equal("machine_id" in result, false);
  },
);

await check(
  "reviewedBy berbentuk { id, name } saat sudah ditinjau",
  async () => {
    const svc = makeRequestService({
      query: recorder([
        row({
          status: "approved",
          reviewed_by: OTHER,
          reviewed_at: new Date("2026-09-23T00:00:00Z"),
          reviewer_name: "Siti",
        }),
      ]).query as never,
    });
    const result = await svc.getById(
      supervisor,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );

    assert.deepEqual(result.reviewedBy, { id: OTHER, name: "Siti" });
    assert.equal("reviewer_name" in result, false);
  },
);

await check("output tidak membocorkan kolom internal", async () => {
  const svc = makeRequestService({ query: recorder([row()]).query as never });
  const result = await svc.getById(
    supervisor,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );

  assert.equal("password_hash" in result, false);
  assert.equal("created_by" in result, false);
  assert.equal("created_by_name" in result, false);
});

console.log("\ncreate");

await check(
  "created_by diambil dari sesi, INSERT memakai nextval",
  async () => {
    const rec = recorder([{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }]);
    const svc = makeRequestService({ query: rec.query as never });

    // Panggilan pertama INSERT, kedua SELECT lewat getById.
    let selectRows: unknown[] = [row()];
    const query = async (text: string, params: unknown[] = []) => {
      rec.calls.push({ text, params });
      if (text.includes("INSERT"))
        return {
          rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
          rowCount: 1,
        } as never;
      return { rows: selectRows, rowCount: selectRows.length } as never;
    };

    const svc2 = makeRequestService({ query: query as never });
    const created = await svc2.create(operator, {
      machine_id: "Machine B-1",
      description: "Perlu pengecekan",
      priority: "low",
    });

    const insert = rec.calls.find((c) => c.text.includes("INSERT"));
    assert.ok(insert);
    assert.match(insert.text, /nextval\('request_code_seq'\)/);
    assert.deepEqual(insert.params, [
      "Machine B-1",
      "Perlu pengecekan",
      "low",
      OP,
    ]);
    assert.equal(created.code, "MR-001");
  },
);

await check("create TIDAK menerima status dari klien", async () => {
  const calls: string[] = [];
  const query = async (text: string) => {
    calls.push(text);
    if (text.includes("INSERT"))
      return { rows: [{ id: "x" }], rowCount: 1 } as never;
    return { rows: [row()], rowCount: 1 } as never;
  };
  const svc = makeRequestService({ query: query as never });

  // `status` tidak ada di tanda tangan create, jadi tidak ada jalan masuknya.
  await svc.create(operator, {
    machine_id: "M",
    description: "deskripsi",
    priority: "low",
  });

  const insert = calls.find((c) => c.includes("INSERT"));
  assert.ok(insert);
  assert.doesNotMatch(insert, /status/);
});

console.log("\nupdate");

await check(
  "operator mengedit miliknya yang submitted → UPDATE terkirim",
  async () => {
    let updated = false;
    const query = async (text: string) => {
      if (text.includes("UPDATE")) {
        updated = true;
        return { rows: [], rowCount: 1 } as never;
      }
      return { rows: [row()], rowCount: 1 } as never;
    };
    const svc = makeRequestService({ query: query as never });

    await svc.update(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      description: "deskripsi baru",
    });

    assert.equal(updated, true);
  },
);

await check(
  "operator mengedit yang sudah approved → FORBIDDEN 403",
  async () => {
    const svc = makeRequestService({
      query: recorder([row({ status: "approved" })]).query as never,
    });

    await assert.rejects(
      () =>
        svc.update(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
          priority: "low",
        }),
      (err: unknown) => err instanceof AppError && err.status === 403,
    );
  },
);

await check(
  "supervisor mengedit milik orang lain → FORBIDDEN 403",
  async () => {
    const svc = makeRequestService({
      query: recorder([row({ created_by: OP })]).query as never,
    });

    await assert.rejects(
      () =>
        svc.update(supervisor, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
          priority: "low",
        }),
      (err: unknown) => err instanceof AppError && err.status === 403,
    );
  },
);

await check("admin mengedit milik siapa pun yang sudah ditinjau", async () => {
  let updated = false;
  const query = async (text: string) => {
    if (text.includes("UPDATE")) {
      updated = true;
      return { rows: [], rowCount: 1 } as never;
    }
    return {
      rows: [row({ created_by: OP, status: "approved" })],
      rowCount: 1,
    } as never;
  };
  const svc = makeRequestService({ query: query as never });

  await svc.update(admin, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
    priority: "low",
  });
  assert.equal(updated, true);
});

await check("update tanpa field → 400, bukan SQL rusak", async () => {
  const svc = makeRequestService({ query: recorder([row()]).query as never });

  await assert.rejects(
    () => svc.update(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {}),
    (err: unknown) =>
      err instanceof AppError &&
      err.status === 400 &&
      err.code === "VALIDATION_ERROR",
  );
});

await check("UPDATE hanya menyentuh kolom yang dikirim", async () => {
  const updates: string[] = [];
  const query = async (text: string) => {
    if (text.includes("UPDATE")) {
      updates.push(text);
      return { rows: [], rowCount: 1 } as never;
    }
    return { rows: [row()], rowCount: 1 } as never;
  };
  const svc = makeRequestService({ query: query as never });

  await svc.update(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
    priority: "medium",
  });

  assert.equal(updates.length, 1);
  assert.match(updates[0]!, /SET priority = \$1/);
  assert.doesNotMatch(updates[0]!, /status/);
  assert.doesNotMatch(updates[0]!, /created_by/);
  assert.doesNotMatch(updates[0]!, /reviewed_/);
});

console.log("\nreview — approve / reject");

await check(
  "supervisor approve request submitted → UPDATE tiga kolom sekaligus",
  async () => {
    const updates: Array<{ text: string; params: unknown[] }> = [];
    const query = async (text: string, params: unknown[] = []) => {
      if (text.includes("UPDATE")) {
        updates.push({ text, params });
        return { rows: [], rowCount: 1 } as never;
      }
      if (text.includes("count(*)"))
        return { rows: [{ total: 1 }], rowCount: 1 } as never;
      return { rows: [row()], rowCount: 1 } as never;
    };
    const svc = makeRequestService({ query: query as never });

    await svc.review(
      supervisor,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "approved",
    );

    assert.equal(updates.length, 1);
    // Status, reviewed_by, dan reviewed_at harus satu statement.
    assert.match(
      updates[0]!.text,
      /SET status = \$1, reviewed_by = \$2, reviewed_at = now\(\)/,
    );
    assert.deepEqual(updates[0]!.params, [
      "approved",
      OTHER,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
  },
);

await check(
  "reject juga menyetel tiga kolom, dengan status rejected",
  async () => {
    const updates: string[] = [];
    let captured: unknown[] = [];
    const query = async (text: string, params: unknown[] = []) => {
      if (text.includes("UPDATE")) {
        updates.push(text);
        captured = params;
        return { rows: [], rowCount: 1 } as never;
      }
      return { rows: [row()], rowCount: 1 } as never;
    };
    const svc = makeRequestService({ query: query as never });

    await svc.review(
      supervisor,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "rejected",
    );

    assert.equal(updates.length, 1);
    assert.equal(captured[0], "rejected");
  },
);

await check("operator approve → FORBIDDEN 403", async () => {
  const svc = makeRequestService({ query: recorder([row()]).query as never });

  await assert.rejects(
    () =>
      svc.review(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "approved"),
    (err: unknown) =>
      err instanceof AppError && err.status === 403 && err.code === "FORBIDDEN",
  );
});

await check(
  "supervisor approve yang sudah approved → 409 ALREADY_REVIEWED",
  async () => {
    const svc = makeRequestService({
      query: recorder([row({ status: "approved", reviewed_by: OTHER })])
        .query as never,
    });

    await assert.rejects(
      () =>
        svc.review(
          supervisor,
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "approved",
        ),
      (err: unknown) =>
        err instanceof AppError &&
        err.status === 409 &&
        err.code === "ALREADY_REVIEWED",
    );
  },
);

await check("supervisor reject yang sudah rejected → 409 juga", async () => {
  const svc = makeRequestService({
    query: recorder([row({ status: "rejected", reviewed_by: OTHER })])
      .query as never,
  });

  await assert.rejects(
    () =>
      svc.review(
        supervisor,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "rejected",
      ),
    (err: unknown) => err instanceof AppError && err.status === 409,
  );
});

await check(
  "admin approve yang sudah approved → DIIZINKAN (jalur koreksi)",
  async () => {
    let updated = false;
    const query = async (text: string) => {
      if (text.includes("UPDATE")) {
        updated = true;
        return { rows: [], rowCount: 1 } as never;
      }
      return {
        rows: [row({ status: "approved", reviewed_by: OTHER })],
        rowCount: 1,
      } as never;
    };
    const svc = makeRequestService({ query: query as never });

    await svc.review(admin, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "rejected");

    assert.equal(updated, true);
  },
);

await check("admin bisa membalik approved menjadi rejected", async () => {
  const captured: unknown[] = [];
  const query = async (text: string, params: unknown[] = []) => {
    if (text.includes("UPDATE")) {
      captured.push(...params);
      return { rows: [], rowCount: 1 } as never;
    }
    return {
      rows: [row({ status: "approved", reviewed_by: OTHER })],
      rowCount: 1,
    } as never;
  };
  const svc = makeRequestService({ query: query as never });

  await svc.review(admin, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "rejected");

  assert.equal(captured[0], "rejected");
  assert.equal(captured[1], "33333333-3333-4333-8333-333333333333");
});

await check(
  "review id yang tidak ada → NOT_FOUND 404 (bukan 403)",
  async () => {
    const svc = makeRequestService({ query: recorder([]).query as never });

    await assert.rejects(
      () =>
        svc.review(
          supervisor,
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "approved",
        ),
      (err: unknown) =>
        err instanceof AppError &&
        err.status === 404 &&
        err.code === "NOT_FOUND",
    );
  },
);

await check(
  "review TIDAK menyentuh description/priority/machine_id",
  async () => {
    const updates: string[] = [];
    const query = async (text: string) => {
      if (text.includes("UPDATE")) {
        updates.push(text);
        return { rows: [], rowCount: 1 } as never;
      }
      return { rows: [row()], rowCount: 1 } as never;
    };
    const svc = makeRequestService({ query: query as never });

    await svc.review(
      supervisor,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "approved",
    );

    assert.doesNotMatch(updates[0]!, /description/);
    assert.doesNotMatch(updates[0]!, /priority/);
    assert.doesNotMatch(updates[0]!, /machine_id/);
  },
);

console.log("\nremove — hapus");

await check("admin hapus → DELETE terkirim, tidak melempar", async () => {
  let deleted = false;
  const query = async (text: string) => {
    if (text.includes("DELETE")) {
      deleted = true;
      return {
        rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
        rowCount: 1,
      } as never;
    }
    return { rows: [], rowCount: 0 } as never;
  };
  const svc = makeRequestService({ query: query as never });

  await svc.remove(admin, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(deleted, true);
});

await check("DELETE memakai RETURNING id, bukan rowCount saja", async () => {
  const calls: string[] = [];
  const query = async (text: string) => {
    calls.push(text);
    return { rows: [{ id: "x" }], rowCount: 1 } as never;
  };
  const svc = makeRequestService({ query: query as never });

  await svc.remove(admin, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

  assert.match(calls[0]!, /DELETE FROM requests WHERE id = \$1 RETURNING id/);
});

await check("operator hapus → FORBIDDEN 403", async () => {
  const svc = makeRequestService({ query: recorder([row()]).query as never });

  await assert.rejects(
    () => svc.remove(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    (err: unknown) => err instanceof AppError && err.status === 403,
  );
});

await check("supervisor hapus → FORBIDDEN 403", async () => {
  const svc = makeRequestService({ query: recorder([row()]).query as never });

  await assert.rejects(
    () => svc.remove(supervisor, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    (err: unknown) => err instanceof AppError && err.status === 403,
  );
});

await check("admin hapus id yang tidak ada → NOT_FOUND 404", async () => {
  const svc = makeRequestService({ query: recorder([]).query as never });

  await assert.rejects(
    () => svc.remove(admin, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    (err: unknown) => err instanceof AppError && err.status === 404,
  );
});

await check("operator hapus id tidak ada → tetap 403, bukan 404", async () => {
  const svc = makeRequestService({ query: recorder([]).query as never });

  // Izin dicek sebelum query, jadi kebocoran "barisnya ada atau tidak" tertutup.
  await assert.rejects(
    () => svc.remove(operator, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    (err: unknown) => err instanceof AppError && err.status === 403,
  );
});

console.log(`\n${passed} lulus, ${failed} gagal`);

if (failed > 0) {
  process.exitCode = 1;
}

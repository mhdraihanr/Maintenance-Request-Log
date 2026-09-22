import assert from "node:assert/strict";
import type { AuthUser } from "../../src/middleware/auth";
import {
  canDelete,
  canEdit,
  canReview,
  canView,
  reviewDenial,
  type RequestForPolicy,
} from "../../src/policies/permissions";

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  OK  ${name}`);
  } catch (err) {
    failed += 1;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL ${name}\n       ${message}`);
  }
}

const OPERATOR_ID = "11111111-1111-4111-8111-111111111111";
const SUPERVISOR_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";

// Tiap peran punya id sendiri, supaya "milik siapa" tidak pernah ambigu.
const user = (role: "operator" | "supervisor" | "admin"): AuthUser => ({
  id: { operator: OPERATOR_ID, supervisor: SUPERVISOR_ID, admin: ADMIN_ID }[
    role
  ],
  username: role,
  name: role,
  role,
  isActive: true,
});

// `req` hanya butuh dua kolom — bentuk sempit ini adalah bagian dari desainnya.
const submittedOwn: RequestForPolicy = {
  createdBy: OPERATOR_ID,
  status: "submitted",
};
const submittedOther: RequestForPolicy = {
  createdBy: SUPERVISOR_ID,
  status: "submitted",
};
const reviewedOwn: RequestForPolicy = {
  createdBy: OPERATOR_ID,
  status: "approved",
};

const operator = user("operator");
const supervisor = user("supervisor");
const admin = user("admin");

console.log("\ncanView — baris matriks 2 & 3");

check("operator melihat miliknya", () => {
  assert.equal(canView(operator, submittedOwn), true);
});

check("operator TIDAK melihat milik orang lain", () => {
  assert.equal(canView(operator, submittedOther), false);
});

check(
  "operator tetap tidak melihat milik orang lain yang sudah ditinjau",
  () => {
    assert.equal(
      canView(operator, { createdBy: SUPERVISOR_ID, status: "approved" }),
      false,
    );
  },
);

check("supervisor melihat milik siapa pun", () => {
  assert.equal(canView(supervisor, submittedOther), true);
});

check("admin melihat milik siapa pun", () => {
  assert.equal(canView(admin, submittedOther), true);
});

console.log("\ncanEdit — baris matriks 4 & 5");

check("operator mengedit miliknya yang submitted", () => {
  assert.equal(canEdit(operator, submittedOwn), true);
});

check("operator TIDAK mengedit milik orang lain", () => {
  assert.equal(canEdit(operator, submittedOther), false);
});

check("operator TIDAK mengedit miliknya yang sudah ditinjau", () => {
  assert.equal(canEdit(operator, reviewedOwn), false);
});

check("supervisor mengedit miliknya yang submitted", () => {
  assert.equal(canEdit(supervisor, submittedOther), true);
});

check("supervisor TIDAK mengedit milik orang lain", () => {
  assert.equal(canEdit(supervisor, submittedOwn), false);
});

check("supervisor juga terkunci pada miliknya yang sudah ditinjau", () => {
  assert.equal(canEdit(supervisor, reviewedOwn), false);
});

check("admin mengedit milik siapa pun, kapan pun", () => {
  assert.equal(canEdit(admin, reviewedOwn), true);
  assert.equal(canEdit(admin, submittedOwn), true);
});

console.log("\ncanReview — baris matriks 6");

check("operator TIDAK boleh meninjau", () => {
  assert.equal(canReview(operator, submittedOwn), false);
});

check("supervisor meninjau yang masih submitted", () => {
  assert.equal(canReview(supervisor, submittedOther), true);
});

check("supervisor TIDAK meninjau ulang yang sudah ditinjau", () => {
  assert.equal(canReview(supervisor, reviewedOwn), false);
});

check("admin meninjau yang masih submitted", () => {
  assert.equal(canReview(admin, submittedOther), true);
});

check("admin BOLEH meninjau ulang (jalur koreksi)", () => {
  assert.equal(canReview(admin, reviewedOwn), true);
});

console.log("\ncanDelete — baris matriks 7");

check("operator dan supervisor TIDAK boleh menghapus", () => {
  assert.equal(canDelete(operator), false);
  assert.equal(canDelete(supervisor), false);
});

check("admin boleh menghapus", () => {
  assert.equal(canDelete(admin), true);
});

console.log("\nreviewDenial — pembeda 403 vs 409");

check("boleh meninjau → null", () => {
  assert.equal(reviewDenial(supervisor, submittedOther), null);
  assert.equal(reviewDenial(admin, reviewedOwn), null);
});

check("operator → 'forbidden' (403)", () => {
  assert.equal(reviewDenial(operator, submittedOwn), "forbidden");
});

check("supervisor pada request terditinjau → 'already_reviewed' (409)", () => {
  assert.equal(reviewDenial(supervisor, reviewedOwn), "already_reviewed");
});

console.log("\nfungsi murni — tidak saling mencemari");

check("pemanggilan berulang memberi hasil sama", () => {
  assert.equal(
    canEdit(operator, submittedOwn),
    canEdit(operator, submittedOwn),
  );
});

check("tidak ada state yang tersimpan antar pemanggilan", () => {
  const before = canReview(supervisor, submittedOther);
  canReview(admin, reviewedOwn);
  assert.equal(canReview(supervisor, submittedOther), before);
});

console.log(`\n${passed} lulus, ${failed} gagal`);

if (failed > 0) {
  process.exitCode = 1;
}

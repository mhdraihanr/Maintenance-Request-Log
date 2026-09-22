import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../../src/utils/errors";

const cases = [
  badRequest("Input tidak valid", { machine_id: "Wajib diisi" }),
  unauthorized(),
  forbidden(),
  notFound(),
  conflict("ALREADY_REVIEWED", "Request sudah ditinjau"),
];

for (const err of cases) {
  console.log(
    `${err.status} ${err.code.padEnd(14)} ${err.message.padEnd(24)} fields=${
      err.fields ? JSON.stringify(err.fields) : "-"
    }`,
  );
}

const sample = cases[0]!;
console.log();
console.log("instanceof Error   :", sample instanceof Error);
console.log("instanceof AppError:", sample instanceof AppError);
console.log("name               :", sample.name);

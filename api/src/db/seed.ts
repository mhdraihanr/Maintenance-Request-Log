import { withTransaction, pool } from "./pool";
import { hashPassword } from "../utils/password";
import type { Role } from "../types";

type SeedUser = {
  username: string;
  password: string;
  name: string;
  role: Role;
};

type SeedRequest = {
  machine_id: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "submitted" | "approved" | "rejected";
  created_by: string;
  reviewed_by: string | null;
  /** Berapa hari ke belakang dari sekarang. */
  daysAgo: number;
};

const USERS: SeedUser[] = [
  {
    username: "bud",
    password: "operator123",
    name: "Budi Santoso",
    role: "operator",
  },
  {
    username: "siti",
    password: "supervisor123",
    name: "Siti Nurhaliza",
    role: "supervisor",
  },
  {
    username: "andi",
    password: "admin123",
    name: "Andi Pratama",
    role: "admin",
  },
];

const REQUESTS: SeedRequest[] = [
  {
    machine_id: "Machine A-12",
    description: "Bearing kasar dan berbunyi saat putaran tinggi.",
    priority: "high",
    status: "submitted",
    created_by: "bud",
    reviewed_by: null,
    daysAgo: 1,
  },
  {
    machine_id: "Conveyor B-03",
    description: "Belt geser ke kiri, perlu penyetelan ulang tensioner.",
    priority: "medium",
    status: "approved",
    created_by: "bud",
    reviewed_by: "siti",
    daysAgo: 2,
  },
  {
    machine_id: "Press C-01",
    description: "Tekanan hidrolik tidak stabil, hasil cetak bervariasi.",
    priority: "high",
    status: "rejected",
    created_by: "siti",
    reviewed_by: "andi",
    daysAgo: 3,
  },
  {
    machine_id: "Air Compressor",
    description: "Kebocoran halus pada sambungan pipa keluaran.",
    priority: "medium",
    status: "approved",
    created_by: "bud",
    reviewed_by: "siti",
    daysAgo: 4,
  },
  {
    machine_id: "Robot Arm",
    description: "Kalibrasi ulang sumbu ketiga setelah ganti gripper.",
    priority: "low",
    status: "submitted",
    created_by: "siti",
    reviewed_by: null,
    daysAgo: 5,
  },
  {
    machine_id: "Cooling Fan",
    description: "Debu menumpuk di kisi, aliran udara menurun.",
    priority: "medium",
    status: "approved",
    created_by: "bud",
    reviewed_by: "andi",
    daysAgo: 6,
  },
  {
    machine_id: "Packaging Line",
    description: "Sensor fotoelektrik sering gagal mendeteksi kardus.",
    priority: "high",
    status: "submitted",
    created_by: "siti",
    reviewed_by: null,
    daysAgo: 7,
  },
  {
    machine_id: "Boiler",
    description: "Tekanan naik di luar batas aman saat beban puncak.",
    priority: "high",
    status: "rejected",
    created_by: "bud",
    reviewed_by: "siti",
    daysAgo: 8,
  },
];

const isForced = process.env.SEED_FORCE === "true";

async function seed(): Promise<void> {
  const userCount = await withTransaction(async (client) => {
    const existing = await client.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM users",
    );

    if (existing.rows[0]!.total > 0) {
      if (!isForced) {
        console.log(
          "Seed dilewati: tabel users sudah ada isinya. Pakai SEED_FORCE=true untuk menimpa.",
        );
        return null;
      }

      // Urutan penting: requests dulu, karena created_by memakai ON DELETE RESTRICT.
      await client.query("DELETE FROM requests");
      await client.query("DELETE FROM users");
      // DELETE tidak mereset sequence — tanpa ini kode jadi MR-017, bukan MR-001.
      await client.query("ALTER SEQUENCE request_code_seq RESTART WITH 1");
      console.log("SEED_FORCE=true — data lama dihapus, sequence direset.");
    }

    const ids = new Map<string, string>();
    const usersCreatedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const user of USERS) {
      const hash = await hashPassword(user.password);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (username, name, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [user.username, user.name, hash, user.role, usersCreatedAt],
      );
      ids.set(user.username, inserted.rows[0]!.id);
    }

    const day = 24 * 60 * 60 * 1000;

    for (const request of REQUESTS) {
      const createdBy = ids.get(request.created_by);
      const reviewedBy = request.reviewed_by
        ? ids.get(request.reviewed_by)
        : null;

      if (!createdBy) {
        throw new Error(`User seed tidak ada: ${request.created_by}`);
      }

      const createdAtRequest = new Date(Date.now() - request.daysAgo * day);
      const reviewedAt =
        request.status === "submitted"
          ? null
          : new Date(createdAtRequest.getTime() + 6 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO requests
           (code, machine_id, description, priority, status,
            created_by, created_at, reviewed_by, reviewed_at)
         VALUES
           ('MR-' || lpad(nextval('request_code_seq')::text, 3, '0'),
            $1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          request.machine_id,
          request.description,
          request.priority,
          request.status,
          createdBy,
          createdAtRequest,
          reviewedBy,
          reviewedAt,
        ],
      );
    }

    return ids.size;
  });

  if (userCount === null) return;

  console.log(`Seed selesai: ${userCount} user, ${REQUESTS.length} request.`);
}

try {
  await seed();
} catch (err) {
  console.error("Seed gagal.");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  // Tanpa ini proses menggantung karena pool masih memegang koneksi.
  await pool.end();
}

import type { AuthUser, MaintenanceRequest, PublicUser } from "@/api/types";

/**
 * Cerminan `api/src/policies/permissions.ts`.
 *
 * Ini HANYA untuk menyembunyikan tombol yang pasti akan ditolak server.
 * Otorisasi tetap milik server — kalau file ini salah, API tetap menolak.
 * Setiap perubahan di sini harus mengikuti file API-nya, bukan sebaliknya.
 */

type RequestLike = Pick<MaintenanceRequest, "status"> & {
  createdBy: { id: string };
};

type UserLike = Pick<AuthUser, "id" | "role">;

export function canView(user: UserLike | null, request: RequestLike): boolean {
  if (!user) return false;
  if (user.role === "operator") return request.createdBy.id === user.id;
  return true;
}

export function canEdit(user: UserLike | null, request: RequestLike): boolean {
  if (!user) return false;
  if (request.status !== "submitted") return false;

  return user.role === "admin" || request.createdBy.id === user.id;
}

export function canDelete(
  user: UserLike | null,
  _request: RequestLike,
): boolean {
  return Boolean(user) && user?.role === "admin";
}

export function canReview(
  user: UserLike | null,
  request: RequestLike,
): boolean {
  if (!user) return false;
  if (user.role === "operator") return false;
  return request.status === "submitted";
}

/** Admin tidak boleh menonaktifkan akunnya sendiri. */
export function canDeactivate(
  actor: UserLike | null,
  target: Pick<PublicUser, "id" | "isActive">,
): boolean {
  if (!actor || actor.role !== "admin") return false;
  if (actor.id === target.id) return false;
  return target.isActive;
}

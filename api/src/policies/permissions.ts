import type { AuthUser } from "../middleware/auth";
import type { Role } from "../types";

export type RequestForPolicy = {
  createdBy: string;
  status: "submitted" | "approved" | "rejected";
};

const canReviewRole = (role: Role): boolean =>
  role === "supervisor" || role === "admin";

export const canView = (user: AuthUser, req: RequestForPolicy): boolean => {
  if (user.role === "admin" || user.role === "supervisor") return true;

  // Menyembunyikan, bukan menolak: pemanggil menjawab 404, bukan 403.
  return req.createdBy === user.id;
};

export const canEdit = (user: AuthUser, req: RequestForPolicy): boolean => {
  if (user.role === "admin") return true;

  // Peran lain hanya miliknya, dan terkunci begitu ditinjau.
  if (req.createdBy !== user.id) return false;
  return req.status === "submitted";
};

export const canReview = (user: AuthUser, req: RequestForPolicy): boolean => {
  if (!canReviewRole(user.role)) return false;

  // Admin boleh meninjau ulang sebagai jalur koreksi; supervisor tidak.
  if (user.role === "admin") return true;
  return req.status === "submitted";
};

export const canDelete = (user: AuthUser): boolean => user.role === "admin";

export type ReviewDenial = "forbidden" | "already_reviewed";

export const reviewDenial = (
  user: AuthUser,
  req: RequestForPolicy,
): ReviewDenial | null => {
  if (canReview(user, req)) return null;

  if (!canReviewRole(user.role)) return "forbidden";

  return "already_reviewed";
};

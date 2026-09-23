import type { Priority, RequestStatus, Role } from "@/api/types";

/** "24 Sep 2026 08:32" — konsisten di seluruh aplikasi. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const day = date.getDate();
  const month = MONTHS[date.getMonth()] ?? "";
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${day} ${month} ${year} ${hour}:${minute}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Label Indonesia. Dipakai di badge, filter, dan timeline. */
export const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const ROLE_LABEL: Record<Role, string> = {
  operator: "Operator",
  supervisor: "Supervisor",
  admin: "Admin",
};

/** Aksen ikon StatCard, mengikuti docs/05-ui-ux.md bagian 4.2. */
export const STATUS_TONE: Record<RequestStatus, string> = {
  submitted: "info",
  approved: "success",
  rejected: "danger",
};

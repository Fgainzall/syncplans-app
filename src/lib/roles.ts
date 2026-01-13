export type GroupRole = "owner" | "admin" | "member";

export function canManage(role: GroupRole) {
  return role === "owner" || role === "admin";
}

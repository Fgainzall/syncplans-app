// src/lib/auth.ts
export type AuthUser = {
  name: string;
  email: string;
  verified?: boolean;
};

const KEY = "syncplans_auth_v1";

function hasWindow() {
  return typeof window !== "undefined";
}

export function getUser(): AuthUser | null {
  try {
    if (!hasWindow()) return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || typeof u !== "object") return null;
    if (!u.email) return null;
    return u as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthed() {
  return !!getUser();
}

export function signIn(params: { email: string; password?: string; name?: string }) {
  const email = (params.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Correo inválido");

  const user: AuthUser = {
    email,
    name: params.name?.trim() || email.split("@")[0] || "Fernando",
    verified: true,
  };

  if (hasWindow()) localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

export function signUp(params: { name: string; email: string; password?: string }) {
  const name = (params.name ?? "").trim();
  const email = (params.email ?? "").trim().toLowerCase();
  if (!name) throw new Error("Nombre requerido");
  if (!email.includes("@")) throw new Error("Correo inválido");

  const user: AuthUser = { name, email, verified: true };
  if (hasWindow()) localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

export function signOut() {
  try {
    if (!hasWindow()) return;
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

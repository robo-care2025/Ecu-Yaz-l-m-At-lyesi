import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser } from "./handlers";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Ortam değişkeni eksik: ${name}`);
  return v;
}

/** Kullanıcının erişim anahtarıyla Supabase istemcisi: RLS bu kullanıcı adına çalışır. */
export function supabaseForUser(token: string): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** "Authorization: Bearer <token>" başlığından kullanıcıyı ve atölyesini bulur. */
export async function authenticate(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const db = supabaseForUser(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const profile = await db.from("profiles").select("workshop_id").eq("user_id", data.user.id).maybeSingle();
  if (profile.error || !profile.data) return null;
  return { userId: data.user.id, workshopId: profile.data.workshop_id as string, token };
}

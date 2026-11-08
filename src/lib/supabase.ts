import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

export const ENTRIES_TABLE = "calorie_app_entries";

let client: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/** Browser client (anon key) — used only for Supabase Auth. */
export function getSupabaseClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not set");
  }

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

/** Server-side only: bypasses RLS using the service role key */
export function getSupabaseServiceClient() {
  if (serviceClient) return serviceClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role environment variables are not set");
  }

  serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

/** Server-side: resolves the signed-in user from the request's Bearer token. */
export async function getRequestUser(request: Request): Promise<User | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await getSupabaseServiceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

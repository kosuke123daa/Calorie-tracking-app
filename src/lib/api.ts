import { getSupabaseClient } from "@/lib/supabase";

/** fetch() that attaches the current Supabase session's access token. */
export async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await getSupabaseClient().auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}

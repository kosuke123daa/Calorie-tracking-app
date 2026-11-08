import { NextRequest, NextResponse } from "next/server";
import { ENTRIES_TABLE, getRequestUser, getSupabaseServiceClient } from "@/lib/supabase";
import { isDateKey, parseEntryInput } from "@/lib/validate";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!isDateKey(from) || !isDateKey(to)) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }

  const { data, error } = await getSupabaseServiceClient()
    .from(ENTRIES_TABLE)
    .select("id, eaten_on, name, calories, created_at, updated_at")
    .eq("user_id", user.id)
    .gte("eaten_on", from)
    .lte("eaten_on", to)
    .order("eaten_on", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();

  const input = parseEntryInput(await request.json().catch(() => null));
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  const { data, error } = await getSupabaseServiceClient()
    .from(ENTRIES_TABLE)
    .insert({ ...input, user_id: user.id })
    .select("id, eaten_on, name, calories, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import {
  ENTRIES_TABLE,
  ENTRY_COLUMNS,
  ENTRY_COLUMNS_WITHOUT_PROTEIN,
  getRequestUser,
  getSupabaseServiceClient,
  isMissingProteinColumn,
} from "@/lib/supabase";
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

  const query = (columns: string) =>
    getSupabaseServiceClient()
      .from(ENTRIES_TABLE)
      .select(columns)
      .eq("user_id", user.id)
      .gte("eaten_on", from)
      .lte("eaten_on", to)
      .order("eaten_on", { ascending: true })
      .order("created_at", { ascending: true });

  let { data, error } = await query(ENTRY_COLUMNS);
  // Keep the app working until migration 002 has been run.
  if (isMissingProteinColumn(error)) ({ data, error } = await query(ENTRY_COLUMNS_WITHOUT_PROTEIN));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST accepts one entry, or an array of entries (saved together).
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const isBatch = Array.isArray(body);
  const raw: unknown[] = isBatch ? body : [body];
  if (raw.length === 0 || raw.length > 50) {
    return NextResponse.json({ error: "1〜50件で指定してください" }, { status: 400 });
  }

  const inputs = [];
  for (const item of raw) {
    const input = parseEntryInput(item);
    if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
    inputs.push({ ...input, user_id: user.id });
  }

  const { data, error } = await getSupabaseServiceClient()
    .from(ENTRIES_TABLE)
    .insert(inputs)
    .select(ENTRY_COLUMNS_WITHOUT_PROTEIN);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(isBatch ? data : data[0], { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import {
  ENTRIES_TABLE,
  ENTRY_COLUMNS_WITHOUT_PROTEIN,
  getRequestUser,
  getSupabaseServiceClient,
  isMissingProteinColumn,
} from "@/lib/supabase";
import { parseEntryInput } from "@/lib/validate";

type Context = { params: Promise<{ id: string }> };

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

async function parseId(context: Context) {
  const { id } = await context.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(request: NextRequest, context: Context) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  const id = await parseId(context);
  if (!id) return notFound();

  const input = parseEntryInput(await request.json().catch(() => null));
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  const { data: current, error: readError } = await supabase
    .from(ENTRIES_TABLE)
    .select("name, calories")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return notFound();

  // A protein estimate no longer matches once the food or its amount changes.
  const stale = current.name !== input.name || current.calories !== input.calories;
  const update = (extra: Record<string, unknown>) =>
    supabase
      .from(ENTRIES_TABLE)
      .update({ ...input, ...extra, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select(ENTRY_COLUMNS_WITHOUT_PROTEIN)
      .maybeSingle();

  let { data, error } = await update(stale ? { protein_g: null } : {});
  if (stale && isMissingProteinColumn(error)) ({ data, error } = await update({}));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return notFound();
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, context: Context) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  const id = await parseId(context);
  if (!id) return notFound();

  const { error } = await getSupabaseServiceClient()
    .from(ENTRIES_TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

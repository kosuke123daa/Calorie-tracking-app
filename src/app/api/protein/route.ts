import { NextRequest, NextResponse } from "next/server";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ENTRIES_TABLE, getRequestUser, getSupabaseServiceClient, isMissingProteinColumn } from "@/lib/supabase";
import { isDateKey } from "@/lib/validate";
import {
  anthropicErrorResponse,
  CLAUDE_MODEL,
  FALLBACK_OPTIONS,
  getAnthropicClient,
  missingKeyResponse,
} from "@/lib/anthropic";

export const maxDuration = 60;

const ProteinSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().describe("入力で渡された項目の id"),
      protein_g: z.number().describe("推定たんぱく質量（g、小数第1位まで）"),
    })
  ),
});

const SYSTEM_PROMPT = `あなたは管理栄養士です。1日に食べたものの一覧（品名と記録されたカロリー）から、品ごとのたんぱく質量（g）を推定します。

- 記録されたカロリーを量の手がかりにして、その量に対するたんぱく質量を推定してください。
- 品名が曖昧な場合（例:「朝ごはん」）は、そのカロリーの一般的な日本の食事として推定してください。
- 入力のすべての id について、1件ずつ結果を返してください。`;

// POST /api/protein { date: "YYYY-MM-DD", all?: boolean }
// Estimates protein for the signed-in user's entries on that date and saves it
// to calorie_app_entries.protein_g. By default only entries without an estimate
// are sent; `all: true` re-estimates every entry of the day.
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  const body = (await request.json().catch(() => null)) as { date?: unknown; all?: unknown } | null;
  if (!isDateKey(body?.date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const { data: entries, error } = await supabase
    .from(ENTRIES_TABLE)
    .select("id, name, calories, protein_g")
    .eq("user_id", user.id)
    .eq("eaten_on", body.date)
    .order("created_at", { ascending: true });

  if (isMissingProteinColumn(error)) {
    return NextResponse.json(
      { error: "DB にたんぱく質の列がありません。Supabase で 002_add_protein_g.sql を実行してください" },
      { status: 409 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targets = (entries ?? []).filter((e) => body.all === true || e.protein_g === null);
  if (targets.length === 0) return NextResponse.json({ updated: 0 });

  const list = targets.map((e) => `- id: ${e.id} / 品名: ${e.name} / ${e.calories} kcal`).join("\n");

  let estimates: Map<number, number>;
  try {
    const response = await getAnthropicClient().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(ProteinSchema),
      },
      ...FALLBACK_OPTIONS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `食べたもの:\n${list}` }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "推定できませんでした" }, { status: 422 });
    }
    if (!response.parsed_output) {
      return NextResponse.json({ error: "推定結果を読み取れませんでした" }, { status: 502 });
    }
    estimates = new Map(response.parsed_output.items.map((i) => [i.id, i.protein_g]));
  } catch (error) {
    return anthropicErrorResponse(error, "たんぱく質の推定に失敗しました");
  }

  const results = await Promise.all(
    targets
      .filter((e) => estimates.has(e.id))
      .map((e) =>
        supabase
          .from(ENTRIES_TABLE)
          .update({ protein_g: Math.min(9999.9, Math.max(0, Math.round(estimates.get(e.id)! * 10) / 10)) })
          .eq("id", e.id)
          .eq("user_id", user.id)
      )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json({ updated: results.length });
}

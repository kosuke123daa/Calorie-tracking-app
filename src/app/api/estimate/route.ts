import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getRequestUser } from "@/lib/supabase";

// Image analysis can take a while; give the function room on Vercel.
export const maxDuration = 60;

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

// ~5MB of image data as base64. The client downsizes before sending, so real
// requests are far smaller (and must stay under Vercel's 4.5MB body limit).
const MAX_BASE64_LENGTH = 7_000_000;

const EstimateSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("料理・食品の名前（日本語）"),
      portion: z.string().describe("写真から推定した量（例: 茶碗1杯 約150g）"),
      calories: z.number().describe("推定カロリー（kcal、整数）"),
    })
  ),
});

const SYSTEM_PROMPT = `あなたは管理栄養士です。食事の写真から、写っている料理・食品を品ごとに分けて、それぞれのカロリーを推定します。

- 写っている品をすべて、別々の項目として挙げてください（ご飯・味噌汁・主菜・副菜・飲み物など）。
- 量は器の大きさや見た目から推定し、portion に簡潔に書いてください。
- calories はその量に対する推定 kcal を整数で入れてください。
- 料理名は日本語で、一般的な名前にしてください。
- 食べ物が写っていない場合は items を空にしてください。`;

let anthropic: Anthropic | null = null;
function getClient() {
  // Reads ANTHROPIC_API_KEY from the environment.
  anthropic ??= new Anthropic();
  return anthropic;
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { media_type?: unknown; data?: unknown } | null;
  const mediaType = body?.media_type;
  const data = body?.data;
  if (
    typeof mediaType !== "string" ||
    !MEDIA_TYPES.includes(mediaType as MediaType) ||
    typeof data !== "string" ||
    data.length === 0 ||
    data.length > MAX_BASE64_LENGTH
  ) {
    return NextResponse.json({ error: "画像が不正です" }, { status: 400 });
  }

  try {
    const response = await getClient().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(EstimateSchema),
      },
      // On a safety decline, let the API retry on its recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as MediaType, data } },
            { type: "text", text: "この写真の料理を品ごとに分けて、推定カロリーを教えてください。" },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "この画像は解析できませんでした" }, { status: 422 });
    }
    if (!response.parsed_output) {
      return NextResponse.json({ error: "解析結果を読み取れませんでした" }, { status: 502 });
    }

    const items = response.parsed_output.items
      .map((item) => ({
        name: item.name.trim().slice(0, 200),
        portion: item.portion.trim(),
        calories: Math.max(0, Math.min(100000, Math.round(item.calories))),
      }))
      .filter((item) => item.name);

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "混み合っています。少し待ってから再試行してください" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error", error.status, error.message);
      return NextResponse.json({ error: "画像の解析に失敗しました" }, { status: 502 });
    }
    throw error;
  }
}

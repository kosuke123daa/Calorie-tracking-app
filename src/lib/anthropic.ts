import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const CLAUDE_MODEL = "claude-opus-5-5";
// On a safety decline, the API retries on Anthropic's recommended fallback model.
export const FALLBACK_OPTIONS: {
  betas: Anthropic.Beta.AnthropicBeta[];
  fallbacks: Anthropic.Beta.Messages.BetaFallbacksParam;
} = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

let client: Anthropic | null = null;

/** Server-side only. Reads ANTHROPIC_API_KEY from the environment. */
export function getAnthropicClient() {
  client ??= new Anthropic();
  return client;
}

export function missingKeyResponse() {
  if (process.env.ANTHROPIC_API_KEY) return null;
  return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
}

/** Maps Anthropic SDK errors to a JSON response; rethrows anything else. */
export function anthropicErrorResponse(error: unknown, failureMessage: string) {
  if (error instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: "混み合っています。少し待ってから再試行してください" }, { status: 429 });
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Anthropic API error", error.status, error.message);
    return NextResponse.json({ error: failureMessage }, { status: 502 });
  }
  throw error;
}

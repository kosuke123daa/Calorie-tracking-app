"use client";

import { useState } from "react";
import { Beef, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authedFetch } from "@/lib/api";

interface Props {
  date: string;
  hasEntries: boolean;
}

interface Result {
  items: { id: number; name: string; calories: number; protein: number | null }[];
  total: number;
}

const formatGrams = (g: number) => `${g.toFixed(1)} g`;

/**
 * Asks Claude for an estimate of the day's protein. Display only, nothing is saved.
 * Remount it (via `key`) when the day's entries change so a stale result disappears.
 */
export function ProteinEstimate({ date, hasEntries }: Props) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const estimate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/protein", { method: "POST", body: JSON.stringify({ date }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "推定に失敗しました");
        return;
      }
      setResult(json as Result);
    } catch (e) {
      console.error(e);
      setError("推定に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (!result) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" className="w-full" onClick={estimate} disabled={!hasEntries || loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Beef className="h-4 w-4 mr-2" />}
          {loading ? "たんぱく質を推定中..." : "この日のたんぱく質量を推定"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">たんぱく質（推定）</span>
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold tabular-nums">{formatGrams(result.total)}</span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResult(null)} aria-label="閉じる">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ul className="text-sm divide-y">
        {result.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2 py-1">
            <span className="truncate">{item.name}</span>
            <span className="tabular-nums text-muted-foreground shrink-0">
              {item.protein === null ? "—" : formatGrams(item.protein)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">品名とカロリーから AI が推定した目安です。</p>
    </div>
  );
}

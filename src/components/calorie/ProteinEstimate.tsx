"use client";

import { useState } from "react";
import { Beef, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authedFetch } from "@/lib/api";
import type { CalorieEntry } from "@/types/calorie";

interface Props {
  date: string;
  entries: CalorieEntry[];
  onSaved: () => Promise<void> | void;
}

export const formatGrams = (g: number) => `${g.toFixed(1)} g`;

/** Day protein total (saved in the DB) plus a button that asks Claude to fill in missing estimates. */
export function ProteinEstimate({ date, entries, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const estimated = entries.filter((e) => e.protein_g != null);
  const missing = entries.length - estimated.length;
  const total = estimated.reduce((s, e) => s + Number(e.protein_g), 0);

  const estimate = async (all: boolean) => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/protein", { method: "POST", body: JSON.stringify({ date, all }) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "推定に失敗しました");
        return;
      }
      await onSaved();
    } catch (e) {
      console.error(e);
      setError("推定に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      {estimated.length > 0 && (
        <div className="rounded-lg border px-4 py-2 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            たんぱく質（推定）
            {missing > 0 && <span className="ml-1 text-xs">※{missing}品は未推定</span>}
          </span>
          <span className="flex items-center gap-1">
            <span className="text-xl font-bold tabular-nums">{formatGrams(total)}</span>
            {missing === 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => estimate(true)}
                disabled={loading}
                aria-label="すべて再推定"
                title="すべて再推定"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            )}
          </span>
        </div>
      )}
      {missing > 0 && (
        <Button type="button" variant="outline" className="w-full" onClick={() => estimate(false)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Beef className="h-4 w-4 mr-2" />}
          {loading
            ? "たんぱく質を推定中..."
            : estimated.length === 0
              ? "この日のたんぱく質量を推定"
              : `未推定の${missing}品のたんぱく質を推定`}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

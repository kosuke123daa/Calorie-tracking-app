"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Flame, LogOut, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient } from "@/lib/supabase";
import { authedFetch } from "@/lib/api";
import { addDays, cn, formatDateLabel, formatKcal, toDateKey } from "@/lib/utils";
import type { CalorieEntry } from "@/types/calorie";
import type { DailyTotal } from "@/components/calorie/CalorieChart";

const CalorieChart = dynamic(
  () => import("@/components/calorie/CalorieChart").then((m) => m.CalorieChart),
  {
    ssr: false,
    loading: () => <div className="h-[280px] flex items-center justify-center text-muted-foreground">読み込み中...</div>,
  }
);

const RANGES = [7, 30, 90] as const;

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [today, setToday] = useState(() => toDateKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const [dayEntries, setDayEntries] = useState<CalorieEntry[]>([]);
  const [rangeEntries, setRangeEntries] = useState<CalorieEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<CalorieEntry | null>(null);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSupabaseClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) router.replace("/login");
        else setAuthChecked(true);
      });
  }, [router]);

  // Keep "today" correct if the tab stays open past midnight.
  useEffect(() => {
    const id = setInterval(() => setToday(toDateKey(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  const rangeStart = addDays(today, -(range - 1));

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [dayRes, rangeRes] = await Promise.all([
        authedFetch(`/api/entries?from=${selectedDate}&to=${selectedDate}`),
        authedFetch(`/api/entries?from=${rangeStart}&to=${today}`),
      ]);
      if (dayRes.status === 401 || rangeRes.status === 401) {
        router.replace("/login");
        return;
      }
      if (dayRes.ok) setDayEntries(await dayRes.json());
      if (rangeRes.ok) setRangeEntries(await rangeRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, rangeStart, today, router]);

  useEffect(() => {
    if (authChecked) fetchEntries();
  }, [authChecked, fetchEntries]);

  const chartData: DailyTotal[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of rangeEntries) totals.set(e.eaten_on, (totals.get(e.eaten_on) ?? 0) + e.calories);
    return Array.from({ length: range }, (_, i) => {
      const date = addDays(rangeStart, i);
      return { date, calories: totals.get(date) ?? 0 };
    });
  }, [rangeEntries, range, rangeStart]);

  const dayTotal = dayEntries.reduce((s, e) => s + e.calories, 0);
  const recordedDays = chartData.filter((d) => d.calories > 0);
  const average = recordedDays.length
    ? Math.round(recordedDays.reduce((s, d) => s + d.calories, 0) / recordedDays.length)
    : 0;

  const resetForm = () => {
    setEditing(null);
    setName("");
    setCalories("");
  };

  const changeDate = (date: string) => {
    if (!date) return;
    setSelectedDate(date);
    resetForm();
  };

  const startEdit = (entry: CalorieEntry) => {
    setEditing(entry);
    setName(entry.name);
    setCalories(String(entry.calories));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = JSON.stringify({
        eaten_on: editing?.eaten_on ?? selectedDate,
        name,
        calories: Number(calories),
      });
      const res = editing
        ? await authedFetch(`/api/entries/${editing.id}`, { method: "PUT", body })
        : await authedFetch("/api/entries", { method: "POST", body });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`保存に失敗しました: ${err.error ?? res.statusText}`);
        return;
      }
      resetForm();
      await fetchEntries();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: CalorieEntry) => {
    if (!confirm(`「${entry.name}」を削除しますか？`)) return;
    const res = await authedFetch(`/api/entries/${entry.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除に失敗しました");
      return;
    }
    if (editing?.id === entry.id) resetForm();
    await fetchEntries();
  };

  const handleLogout = async () => {
    await getSupabaseClient().auth.signOut();
    router.replace("/login");
  };

  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Flame className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">カロリー記録</h1>
              <p className="text-xs text-muted-foreground">Calorie Tracker</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            ログアウト
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Day entries */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="icon" onClick={() => changeDate(addDays(selectedDate, -1))} aria-label="前の日">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <CardTitle className="text-base">{formatDateLabel(selectedDate)}</CardTitle>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => changeDate(e.target.value)}
                    className="text-xs bg-transparent text-muted-foreground [color-scheme:light_dark]"
                    aria-label="日付を選択"
                  />
                  {selectedDate !== today && (
                    <button className="text-xs text-primary hover:underline" onClick={() => changeDate(today)}>
                      今日
                    </button>
                  )}
                </div>
              </div>
              <Button variant="outline" size="icon" onClick={() => changeDate(addDays(selectedDate, 1))} aria-label="次の日">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted px-4 py-3 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">合計</span>
              <span className="text-2xl font-bold tabular-nums">{formatKcal(dayTotal)}</span>
            </div>

            {dayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {loading ? "読み込み中..." : "まだ記録がありません"}
              </p>
            ) : (
              <ul className="divide-y">
                {dayEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className={cn("flex items-center gap-2 py-2", editing?.id === entry.id && "bg-muted/60 rounded-md px-2")}
                  >
                    <span className="flex-1 min-w-0 truncate">{entry.name}</span>
                    <span className="tabular-nums text-sm font-medium">{formatKcal(entry.calories)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(entry)} aria-label="編集">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(entry)} aria-label="削除">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleSubmit} className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">{editing ? "記録を編集" : "記録を追加"}</p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="name">食べたもの</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 朝ごはん" maxLength={200} required />
                </div>
                <div className="sm:w-36 space-y-1.5">
                  <Label htmlFor="calories">カロリー (kcal)</Label>
                  <Input
                    id="calories"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100000}
                    step={1}
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1 sm:flex-none">
                    {editing ? (
                      "更新"
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        追加
                      </>
                    )}
                  </Button>
                  {editing && (
                    <Button type="button" variant="outline" size="icon" onClick={resetForm} aria-label="編集をやめる">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">日ごとのカロリー</CardTitle>
                <CardDescription>
                  記録日の平均 {formatKcal(average)}（バーをタップでその日を表示）
                </CardDescription>
              </div>
              <div className="flex shrink-0 rounded-md border p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded whitespace-nowrap",
                      range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {r}日
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CalorieChart data={chartData} selectedDate={selectedDate} onSelectDate={changeDate} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

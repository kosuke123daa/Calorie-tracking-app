"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authedFetch } from "@/lib/api";
import { formatKcal } from "@/lib/utils";

interface Props {
  date: string; // YYYY-MM-DD the entries are saved to
  onSaved: () => Promise<void> | void;
}

interface Row {
  key: number;
  include: boolean;
  name: string;
  calories: string;
  portion: string;
}

// Long edge in px. Big enough for Claude to read the dishes, small enough to
// keep the upload well under Vercel's 4.5MB request body limit.
const MAX_EDGE = 1568;

async function toJpegBase64(file: File): Promise<{ data: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), previewUrl: dataUrl };
}

let nextKey = 1;

export function PhotoEstimate({ date, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setPreview(null);
    setRows(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setRows(null);
    setAnalyzing(true);
    try {
      const { data, previewUrl } = await toJpegBase64(file);
      setPreview(previewUrl);
      const res = await authedFetch("/api/estimate", {
        method: "POST",
        body: JSON.stringify({ media_type: "image/jpeg", data }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "解析に失敗しました");
        return;
      }
      const items = (json.items ?? []) as { name: string; calories: number; portion: string }[];
      if (items.length === 0) {
        setError("料理が見つかりませんでした。手入力するか、別の写真で試してください。");
      }
      setRows(
        items.map((item) => ({
          key: nextKey++,
          include: true,
          name: item.name,
          calories: String(item.calories),
          portion: item.portion,
        }))
      );
    } catch (e) {
      console.error(e);
      setError("画像を読み込めませんでした");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  const removeRow = (key: number) => setRows((rs) => rs?.filter((r) => r.key !== key) ?? null);

  const addRow = () =>
    setRows((rs) => [...(rs ?? []), { key: nextKey++, include: true, name: "", calories: "", portion: "" }]);

  const selected = (rows ?? []).filter((r) => r.include);
  const selectedValid = selected.every(
    (r) => r.name.trim() && r.calories !== "" && Number.isInteger(Number(r.calories)) && Number(r.calories) >= 0
  );
  const selectedTotal = selected.reduce((s, r) => s + (Number(r.calories) || 0), 0);

  const handleSave = async () => {
    if (selected.length === 0 || !selectedValid) return;
    setSaving(true);
    try {
      const res = await authedFetch("/api/entries", {
        method: "POST",
        body: JSON.stringify(
          selected.map((r) => ({ eaten_on: date, name: r.name.trim(), calories: Number(r.calories) }))
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(`登録に失敗しました: ${err.error ?? res.statusText}`);
        return;
      }
      reset();
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const open = preview !== null || analyzing;

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!open && (
        <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
          <Camera className="h-4 w-4 mr-2" />
          写真からカロリーを推定
        </Button>
      )}

      {open && (
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex gap-3 items-start">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="食事の写真" className="h-20 w-20 rounded-md object-cover shrink-0" />
            )}
            <div className="text-sm flex-1 min-w-0">
              {analyzing ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI が解析中...（10〜30秒ほど）
                </p>
              ) : (
                <p className="text-muted-foreground">
                  推定結果です。内容を直してから登録できます。チェックを外した品は登録しません。
                </p>
              )}
            </div>
          </div>

          {rows && rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.key} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                    className="mt-3 h-4 w-4 accent-[var(--color-primary)]"
                    aria-label="登録する"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex gap-2">
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(row.key, { name: e.target.value })}
                        placeholder="品名"
                        maxLength={200}
                        className="flex-1 min-w-0"
                        disabled={!row.include}
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100000}
                        value={row.calories}
                        onChange={(e) => updateRow(row.key, { calories: e.target.value })}
                        placeholder="kcal"
                        className="w-24"
                        disabled={!row.include}
                      />
                    </div>
                    {row.portion && <p className="text-xs text-muted-foreground pl-1">{row.portion}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-8 text-destructive"
                    onClick={() => removeRow(row.key)}
                    aria-label="行を削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {rows && (
            <Button type="button" variant="ghost" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" />
              品を追加
            </Button>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={analyzing || saving}>
              キャンセル
            </Button>
            {rows && (
              <Button
                type="button"
                className="flex-1"
                onClick={handleSave}
                disabled={saving || selected.length === 0 || !selectedValid}
              >
                {saving ? "登録中..." : `${selected.length}品を登録（${formatKcal(selectedTotal)}）`}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import type { CalorieEntryInput } from "@/types/calorie";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/** Returns a clean input, or an error message. */
export function parseEntryInput(body: unknown): CalorieEntryInput | string {
  if (!body || typeof body !== "object") return "Invalid body";
  const { eaten_on, name, calories } = body as Record<string, unknown>;

  if (!isDateKey(eaten_on)) return "eaten_on must be YYYY-MM-DD";
  if (typeof name !== "string" || !name.trim() || name.trim().length > 200) {
    return "name is required (max 200 chars)";
  }
  const kcal = typeof calories === "string" ? Number(calories) : calories;
  if (typeof kcal !== "number" || !Number.isInteger(kcal) || kcal < 0 || kcal > 100000) {
    return "calories must be an integer between 0 and 100000";
  }

  return { eaten_on, name: name.trim(), calories: kcal };
}

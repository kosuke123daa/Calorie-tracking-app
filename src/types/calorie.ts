export interface CalorieEntry {
  id: number;
  eaten_on: string; // YYYY-MM-DD
  name: string;
  calories: number;
  created_at?: string;
  updated_at?: string;
}

export type CalorieEntryInput = Pick<CalorieEntry, "eaten_on" | "name" | "calories">;

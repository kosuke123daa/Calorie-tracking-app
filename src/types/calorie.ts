export interface CalorieEntry {
  id: number;
  eaten_on: string; // YYYY-MM-DD
  name: string;
  calories: number;
  protein_g?: number | null; // estimated protein (g); null = not estimated
  created_at?: string;
  updated_at?: string;
}

export type CalorieEntryInput = Pick<CalorieEntry, "eaten_on" | "name" | "calories">;

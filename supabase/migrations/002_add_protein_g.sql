-- Estimated protein (g) per entry, filled in by the "たんぱく質を推定" button.
-- NULL = not estimated yet (also reset to NULL when the entry's name/calories change).
ALTER TABLE calorie_app_entries
  ADD COLUMN IF NOT EXISTS protein_g NUMERIC(6, 1) CHECK (protein_g >= 0);

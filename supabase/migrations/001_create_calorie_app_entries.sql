-- Calorie tracking app.
-- This Supabase project is shared with other apps (salary_app_*, ...), so every
-- object here uses the calorie_app_ prefix and nothing else is touched.

CREATE TABLE IF NOT EXISTS calorie_app_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  eaten_on DATE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  calories INTEGER NOT NULL CHECK (calories >= 0 AND calories <= 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calorie_app_entries_user_date
  ON calorie_app_entries (user_id, eaten_on);

-- RLS on with no policies: anon/authenticated keys cannot read or write this
-- table directly. The app only accesses it from API routes with the service
-- role key, after verifying the user's access token.
ALTER TABLE calorie_app_entries ENABLE ROW LEVEL SECURITY;

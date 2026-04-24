-- Migration 010: team_results table
-- Records race event results for each team profile.

CREATE TABLE IF NOT EXISTS public.team_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id uuid NOT NULL REFERENCES public.team_profiles(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_name text NOT NULL DEFAULT '',
  track text NOT NULL DEFAULT '',
  class text NOT NULL DEFAULT '',
  position integer,
  best_lap_time text DEFAULT '',
  top_speed_kmh numeric(6,1),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index so we can efficiently look up results per team
CREATE INDEX IF NOT EXISTS team_results_team_profile_id_idx
  ON public.team_results (team_profile_id, event_date DESC);

-- RLS: allow public read, restrict writes to service role
ALTER TABLE public.team_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view team results"
  ON public.team_results FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage team results"
  ON public.team_results FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

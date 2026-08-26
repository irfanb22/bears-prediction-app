-- Let logged-out visitors preview the available 2026 game schedule.
-- Picks and forecasts remain restricted to authenticated users.
DROP POLICY IF EXISTS "Available game pick schedules are readable" ON public.game_pick_games;

CREATE POLICY "Available game pick schedules are readable"
  ON public.game_pick_games FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_pick_seasons s
      WHERE s.season = game_pick_games.season
        AND (s.state IN ('open', 'locked') OR public.current_user_is_admin())
    )
  );

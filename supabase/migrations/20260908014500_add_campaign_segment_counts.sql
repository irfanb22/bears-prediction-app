/*
  # Named campaign segments

  Broadcasts could only go to every subscribed user, so reaching a group — the
  people who played last season and have not come back, the ones who signed up
  but never picked — meant hand-assembling an address list and posting it to the
  send function directly. That path has no UI, so it could not be rehearsed
  before a real send.

  Segment membership is defined here rather than in the edge function so the
  admin console's recipient count and the send itself read the same definition.
  A preview that disagrees with what actually goes out is worse than no preview.

  `get_users_with_predictions` exists because auth.users is not reachable over
  PostgREST; the edge function already assembles the subscriber list in
  TypeScript and only needs the season membership sets to filter it.
*/

CREATE OR REPLACE FUNCTION public.get_users_with_predictions(target_season integer)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id
  FROM public.predictions p
  JOIN public.questions q ON q.id = p.question_id
  WHERE q.season = target_season;
$$;

REVOKE ALL ON FUNCTION public.get_users_with_predictions(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_users_with_predictions(integer) TO authenticated, service_role;

/*
  Per-segment recipient counts for the composer's audience picker.

  Mirrors the edge function's eligibility rules exactly: a confirmed email
  address and marketing_subscribed. The admin check gates the whole result via
  a cross join — a WHERE on the final branch of a UNION ALL would only filter
  that branch and leak the other counts.
*/
CREATE OR REPLACE FUNCTION public.get_campaign_segment_counts()
RETURNS TABLE (segment text, recipient_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH admin_check AS (
    SELECT public.current_user_is_admin() AS is_admin
  ),
  mailable AS (
    SELECT u.id
    FROM auth.users u
    JOIN public.email_preferences ep
      ON ep.user_id = u.id AND ep.marketing_subscribed
    WHERE u.email IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL
  ),
  played_2026 AS (SELECT user_id FROM public.get_users_with_predictions(2026)),
  played_2025 AS (SELECT user_id FROM public.get_users_with_predictions(2025)),
  totals AS (
    SELECT 'all_subscribed_users'::text AS segment, count(*)::bigint AS recipient_count
    FROM mailable
    UNION ALL
    SELECT 'no_2026_picks', count(*)::bigint
    FROM mailable m
    WHERE NOT EXISTS (SELECT 1 FROM played_2026 p WHERE p.user_id = m.id)
    UNION ALL
    SELECT 'lapsed_2025_players', count(*)::bigint
    FROM mailable m
    WHERE NOT EXISTS (SELECT 1 FROM played_2026 p WHERE p.user_id = m.id)
      AND EXISTS (SELECT 1 FROM played_2025 p WHERE p.user_id = m.id)
  )
  SELECT t.segment, t.recipient_count
  FROM totals t
  CROSS JOIN admin_check a
  WHERE a.is_admin;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_segment_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_segment_counts() TO authenticated;

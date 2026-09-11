/*
  # Incomplete 2026 campaign segment

  A user is complete only after answering all 25 regular-season questions and
  all 17 game picks. The resolved draft question is deliberately excluded.

  The membership function is service-role only because it returns auth user
  identifiers. The admin count RPC and campaign Edge Function both use it, so
  the number shown in the composer is the audience that is actually queued.
*/

CREATE OR REPLACE FUNCTION public.get_incomplete_2026_campaign_user_ids()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH expected AS (
    SELECT
      (
        SELECT count(*)::integer
        FROM public.questions q
        WHERE q.season = 2026
          AND q.id <> 'f6a8dc28-c6d7-4ba2-9492-437292ec0d2f'::uuid
      ) AS question_count,
      (
        SELECT count(*)::integer
        FROM public.game_pick_games g
        WHERE g.season = 2026
      ) AS game_count
  ),
  regular_counts AS (
    SELECT p.user_id, count(DISTINCT p.question_id)::integer AS answer_count
    FROM public.predictions p
    JOIN public.questions q ON q.id = p.question_id
    WHERE q.season = 2026
      AND q.id <> 'f6a8dc28-c6d7-4ba2-9492-437292ec0d2f'::uuid
    GROUP BY p.user_id
  ),
  game_counts AS (
    SELECT p.user_id, count(DISTINCT p.game_id)::integer AS pick_count
    FROM public.game_picks p
    JOIN public.game_pick_games g ON g.id = p.game_id
    WHERE g.season = 2026
    GROUP BY p.user_id
  )
  SELECT u.id
  FROM auth.users u
  CROSS JOIN expected e
  LEFT JOIN regular_counts r ON r.user_id = u.id
  LEFT JOIN game_counts g ON g.user_id = u.id
  WHERE coalesce(r.answer_count, 0) < e.question_count
     OR coalesce(g.pick_count, 0) < e.game_count;
$$;

REVOKE ALL ON FUNCTION public.get_incomplete_2026_campaign_user_ids()
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_incomplete_2026_campaign_user_ids()
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_campaign_segment_counts()
RETURNS TABLE (segment text, recipient_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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
  incomplete_2026 AS (
    SELECT user_id FROM public.get_incomplete_2026_campaign_user_ids()
  ),
  totals AS (
    SELECT 'all_subscribed_users'::text AS segment, count(*)::bigint AS recipient_count
    FROM mailable
    UNION ALL
    SELECT 'incomplete_2026_picks', count(*)::bigint
    FROM mailable m
    WHERE EXISTS (SELECT 1 FROM incomplete_2026 i WHERE i.user_id = m.id)
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

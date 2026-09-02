/*
  # Limit marketing campaigns to confirmed email addresses

  The campaign sender already excludes unsubscribed accounts. It now also
  requires `auth.users.email_confirmed_at`, so abandoned or mistyped signup
  addresses are not treated as subscribers. This function uses the same rule so
  the admin dashboard and confirmation modal match the actual send audience.
*/

CREATE OR REPLACE FUNCTION public.get_admin_email_audience_counts()
RETURNS TABLE (
  subscribed_total bigint,
  subscribed_with_predictions bigint,
  unsubscribed_total bigint,
  production_segment_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  WITH prediction_users AS (
    SELECT DISTINCT p.user_id
    FROM public.predictions p
    WHERE p.question_id IS NOT NULL
  ),
  confirmed_users AS (
    SELECT
      u.id AS user_id,
      COALESCE(ep.marketing_subscribed, true) AS marketing_subscribed
    FROM auth.users u
    LEFT JOIN public.email_preferences ep ON ep.user_id = u.id
    WHERE u.email IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE cu.marketing_subscribed) AS subscribed_total,
    COUNT(*) FILTER (
      WHERE cu.marketing_subscribed
        AND pu.user_id IS NOT NULL
    ) AS subscribed_with_predictions,
    COUNT(*) FILTER (WHERE NOT cu.marketing_subscribed) AS unsubscribed_total,
    COUNT(*) FILTER (WHERE cu.marketing_subscribed) AS production_segment_count
  FROM confirmed_users cu
  LEFT JOIN prediction_users pu ON pu.user_id = cu.user_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_email_audience_counts() TO authenticated;

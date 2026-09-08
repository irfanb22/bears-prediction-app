/*
  # Scope the 'no_predictions' audience to a single season

  The nudge asks "you have not made your picks yet". Its audience filter tested
  for predictions across every season at once, so anyone who played in 2025
  counted as having picked and was skipped — even with an empty 2026 card. That
  excluded exactly the group the nudge exists for: returning players who have
  not come back yet. On today's data that is 40 of the 54 people who played in
  2025.

  Season is a nullable column rather than a hardcoded year so the automation
  does not need a migration every August. NULL preserves the old any-season
  behaviour, which keeps the welcome email (audience 'all') untouched — it
  short-circuits before this branch either way.

  Predictions carry season only through their question, so the check joins
  through `questions`. Game-picker rows have a null question_id and therefore
  never satisfy the check on their own: filling in a record prediction is not
  the same as answering the question set the nudge is about.
*/

ALTER TABLE public.lifecycle_email_configs
  ADD COLUMN IF NOT EXISTS season integer;

COMMENT ON COLUMN public.lifecycle_email_configs.season IS
  'Restricts the no_predictions audience to one season. NULL means any season.';

CREATE OR REPLACE FUNCTION public.get_lifecycle_recipients(
  p_email_type text,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cfg public.lifecycle_email_configs%ROWTYPE;
  max_age_hours constant integer := 72;
BEGIN
  SELECT * INTO cfg FROM public.lifecycle_email_configs c WHERE c.email_type = p_email_type;

  IF NOT FOUND OR NOT cfg.enabled THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text
  FROM auth.users u
  JOIN public.email_preferences ep ON ep.user_id = u.id AND ep.marketing_subscribed
  WHERE u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL
    AND u.created_at >= cfg.starts_at
    AND u.created_at <= now() - make_interval(hours => cfg.delay_hours)
    AND u.created_at >= now() - make_interval(hours => cfg.delay_hours + max_age_hours)
    AND NOT EXISTS (
      SELECT 1 FROM public.lifecycle_emails le
      WHERE le.user_id = u.id AND le.email_type = p_email_type
    )
    AND (
      cfg.audience = 'all'
      OR NOT EXISTS (
        SELECT 1
        FROM public.predictions p
        JOIN public.questions q ON q.id = p.question_id
        WHERE p.user_id = u.id
          AND (cfg.season IS NULL OR q.season = cfg.season)
      )
    )
  ORDER BY u.created_at
  LIMIT p_limit;
END $function$;

REVOKE ALL ON FUNCTION public.get_lifecycle_recipients(text, integer) FROM public, anon, authenticated;

/*
  Point the nudge at 2026 and shorten its delay.

  72 hours was set when there was no deadline in sight. The 2026 question set
  locks Sun 13 Sep 12:00 CT, so a 72-hour delay would nudge anyone who signed
  up after Thu noon only once their picks could no longer be made. At 24 hours
  the last person who can still be reached in time signs up Sat 12 Sep noon.
*/
UPDATE public.lifecycle_email_configs
SET delay_hours = 24,
    season = 2026,
    updated_at = now()
WHERE email_type = 'first_prediction_nudge';

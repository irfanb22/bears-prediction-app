/*
  # Stop a paused automation from backfilling when it resumes

  `starts_at` already prevents enabling an automation from mailing everyone who
  ever registered. It does not cover the second version of the same problem:
  turn the welcome email on in September, off in October, back on in December,
  and every signup from the paused stretch becomes eligible at once — dozens of
  greetings arriving months late.

  So eligibility becomes a window rather than a floor. A signup qualifies from
  the moment its delay elapses until MAX_AGE_HOURS later, and never again.

  The trade is explicit: if nothing runs the automation for longer than that
  window, those people are skipped permanently rather than greeted late. Given
  scheduling is not installed yet, that is the safer failure — and it is the
  behaviour the Automations tab describes to the admin.

  72 hours is a constant rather than a column on purpose. It is a safety rail,
  not a knob worth exposing; widening it should be a deliberate migration.
*/

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
      OR NOT EXISTS (SELECT 1 FROM public.predictions p WHERE p.user_id = u.id)
    )
  ORDER BY u.created_at
  LIMIT p_limit;
END $function$;

REVOKE ALL ON FUNCTION public.get_lifecycle_recipients(text, integer) FROM public, anon, authenticated;

/*
  # Report lifecycle scheduler health to the admin console
*/

CREATE TABLE public.lifecycle_scheduler_heartbeat (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lifecycle_scheduler_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lifecycle_scheduler_heartbeat FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lifecycle_scheduler_heartbeat TO service_role;
INSERT INTO public.lifecycle_scheduler_heartbeat (id) VALUES (true);

CREATE OR REPLACE FUNCTION public.get_lifecycle_scheduler_health()
RETURNS TABLE (
  status text,
  scheduler_installed boolean,
  job_active boolean,
  schedule text,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  checked_at timestamptz,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  heartbeat public.lifecycle_scheduler_heartbeat%ROWTYPE;
  cron_job_active boolean;
  cron_schedule text;
  health_status text;
  health_message text;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT j.active, j.schedule
  INTO cron_job_active, cron_schedule
  FROM cron.job j
  WHERE j.jobname = 'run-lifecycle-emails'
  ORDER BY j.jobid DESC
  LIMIT 1;

  SELECT h.* INTO heartbeat
  FROM public.lifecycle_scheduler_heartbeat h
  WHERE h.id = true;

  IF cron_job_active IS DISTINCT FROM true THEN
    health_status := 'inactive';
    health_message := 'The lifecycle email cron job is missing or disabled.';
  ELSIF cron_schedule IS DISTINCT FROM '*/5 * * * *' THEN
    health_status := 'degraded';
    health_message := 'The lifecycle email cron job is running on an unexpected schedule.';
  ELSIF heartbeat.last_succeeded_at IS NULL THEN
    health_status := 'starting';
    health_message := 'The scheduler is installed and waiting for its first successful check-in.';
  ELSIF heartbeat.last_failed_at IS NOT NULL
        AND heartbeat.last_failed_at > heartbeat.last_succeeded_at THEN
    health_status := 'degraded';
    health_message := 'The scheduler is installed, but its latest run failed.';
  ELSIF heartbeat.last_succeeded_at < now() - interval '15 minutes' THEN
    health_status := 'degraded';
    health_message := 'The scheduler is installed, but its last successful check-in is stale.';
  ELSE
    health_status := 'active';
    health_message := 'Enabled automations are being checked every five minutes.';
  END IF;

  RETURN QUERY SELECT
    health_status,
    cron_job_active IS NOT NULL,
    COALESCE(cron_job_active, false),
    cron_schedule,
    heartbeat.last_started_at,
    heartbeat.last_succeeded_at,
    heartbeat.last_failed_at,
    now(),
    health_message;
END
$function$;

REVOKE ALL ON FUNCTION public.get_lifecycle_scheduler_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lifecycle_scheduler_health() TO authenticated;

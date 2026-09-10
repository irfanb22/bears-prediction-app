/*
  # Enable lifecycle email scheduling safely

  - Turning an automation on resets `starts_at` to that moment, so an old
    disabled configuration can never sweep in historical signups.
  - Supabase Cron invokes `run-lifecycle` every five minutes.
  - The service-role credential lives in Vault and is never stored in this
    migration. The deployment step provisions the two named Vault secrets.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_lifecycle_enabled(
  p_email_type text,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cfg public.lifecycle_email_configs%ROWTYPE;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO cfg
  FROM public.lifecycle_email_configs
  WHERE email_type = p_email_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No automation named %', p_email_type;
  END IF;

  IF p_enabled THEN
    IF btrim(coalesce(cfg.subject, '')) = ''
       OR jsonb_array_length(coalesce(cfg.blocks, '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'Add a subject and email content before switching this on';
    END IF;
  END IF;

  UPDATE public.lifecycle_email_configs
  SET enabled = p_enabled,
      starts_at = CASE
        WHEN p_enabled AND NOT cfg.enabled THEN now()
        ELSE starts_at
      END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE email_type = p_email_type;
END
$function$;

GRANT EXECUTE ON FUNCTION public.set_lifecycle_enabled(text, boolean) TO authenticated;

DO $block$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'run-lifecycle-emails'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$block$;

SELECT cron.schedule(
  'run-lifecycle-emails',
  '*/5 * * * *',
  $job$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'project_url'
      ) || '/functions/v1/run-lifecycle',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
        ),
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $job$
);

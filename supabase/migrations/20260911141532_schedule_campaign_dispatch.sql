/*
  # Schedule campaign dispatch

  Campaign recipients can be queued ahead of time but are not claimable until
  `send_after`. A database cron tick invokes the existing resumable dispatcher,
  so a scheduled broadcast does not depend on an admin keeping the browser open.

  Five concurrent requests let the existing 25-recipient batches drain a normal
  campaign promptly while `FOR UPDATE SKIP LOCKED` prevents double claims.
*/

ALTER TABLE public.email_campaign_recipients
  ADD COLUMN IF NOT EXISTS send_after timestamptz NOT NULL DEFAULT now();

DROP INDEX IF EXISTS public.idx_campaign_recipients_pending;
CREATE INDEX idx_campaign_recipients_pending
  ON public.email_campaign_recipients (campaign_id, send_after, created_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.claim_campaign_recipients(
  p_campaign_id uuid,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (id uuid, email text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Respect an opt-out made after a campaign was scheduled but before it sends.
  UPDATE public.email_campaign_recipients r
  SET status = 'failed',
      error_message = 'Recipient unsubscribed before dispatch'
  WHERE r.campaign_id = p_campaign_id
    AND r.status = 'pending'
    AND r.send_after <= now()
    AND r.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.email_preferences ep
      WHERE ep.user_id = r.user_id
        AND NOT ep.marketing_subscribed
    );

  RETURN QUERY
  UPDATE public.email_campaign_recipients r
  SET status = 'sending', attempts = r.attempts + 1
  WHERE r.id IN (
    SELECT c.id
    FROM public.email_campaign_recipients c
    WHERE c.campaign_id = p_campaign_id
      AND c.status = 'pending'
      AND c.send_after <= now()
    ORDER BY c.send_after, c.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.id, r.email, r.user_id;
END $$;

REVOKE ALL ON FUNCTION public.claim_campaign_recipients(uuid, integer)
  FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_active_campaigns()
RETURNS TABLE (campaign_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.campaign_id
  FROM public.email_campaign_recipients r
  JOIN public.email_send_logs l ON l.id = r.campaign_id
  WHERE r.status = 'pending'
    AND r.send_after <= now()
    AND l.status IN ('queued', 'sending');
$$;

REVOKE ALL ON FUNCTION public.get_active_campaigns()
  FROM public, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $block$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'dispatch-marketing-campaigns'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$block$;

SELECT cron.schedule(
  'dispatch-marketing-campaigns',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'project_url'
      ) || '/functions/v1/dispatch-campaign',
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
    ) AS request_id
    FROM generate_series(1, 5);
  $job$
);

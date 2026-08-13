/*
  # Add campaign dispatch queue

  Why:
  - Production sends used to run inside a single edge function invocation. The
    edge runtime allows roughly 2 seconds of CPU per request, and MIME-encoding
    one ~50KB message costs ~18ms of it — measured, not estimated. At a few
    hundred recipients that budget is gone and the invocation is killed partway
    through: some people mailed, some not, and no way to resume.
  - Splitting the work into claimable batches makes a send resumable and lets it
    survive the admin closing the tab.

  What this adds:
  - `public.email_campaign_recipients` — one row per recipient per campaign.
  - `claim_campaign_recipients()` — atomic batch claim. FOR UPDATE SKIP LOCKED
    is the important part: the cron tick and an admin-triggered dispatch can run
    at the same time and will take different rows rather than both grabbing the
    same ones and double-sending.
  - `get_campaign_progress()` — powers the admin progress bar.
  - `get_active_campaigns()` — what the cron tick scans.
  - Two new `email_send_logs` states, since a campaign now outlives one request.

  Note: `claim_campaign_recipients` is intentionally not granted to any client
  role. Only the dispatcher, using the service-role key, may claim work.
*/

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_send_logs(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_campaign_recipients'
      AND policyname = 'Admins can read campaign recipients'
  ) THEN
    CREATE POLICY "Admins can read campaign recipients"
      ON public.email_campaign_recipients FOR SELECT TO authenticated
      USING (public.current_user_is_admin());
  END IF;
END $$;

-- Partial index: the claim query only ever scans pending rows.
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_pending
  ON public.email_campaign_recipients (campaign_id)
  WHERE status = 'pending';

ALTER TABLE public.email_send_logs DROP CONSTRAINT IF EXISTS email_send_logs_status_check;
ALTER TABLE public.email_send_logs ADD CONSTRAINT email_send_logs_status_check
  CHECK (status IN ('started', 'queued', 'sending', 'succeeded', 'failed'));

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
  RETURN QUERY
  UPDATE public.email_campaign_recipients r
  SET status = 'sending', attempts = r.attempts + 1
  WHERE r.id IN (
    SELECT c.id FROM public.email_campaign_recipients c
    WHERE c.campaign_id = p_campaign_id AND c.status = 'pending'
    ORDER BY c.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.id, r.email, r.user_id;
END $$;

REVOKE ALL ON FUNCTION public.claim_campaign_recipients(uuid, integer) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_campaign_progress(p_campaign_id uuid)
RETURNS TABLE (total bigint, pending bigint, sent bigint, failed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*),
         count(*) FILTER (WHERE status IN ('pending', 'sending')),
         count(*) FILTER (WHERE status = 'sent'),
         count(*) FILTER (WHERE status = 'failed')
  FROM public.email_campaign_recipients
  WHERE campaign_id = p_campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_progress(uuid) TO authenticated;

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
  WHERE r.status = 'pending' AND l.status IN ('queued', 'sending');
$$;

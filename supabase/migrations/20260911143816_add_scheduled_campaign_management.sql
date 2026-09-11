/*
  # Scheduled campaign management

  Expose future campaigns to the authenticated admin console and provide a
  guarded cancellation path. Scheduled campaigns remain normal queued campaigns;
  their recipient rows simply cannot be claimed before `send_after`.
*/

ALTER TABLE public.email_campaign_recipients
  DROP CONSTRAINT IF EXISTS email_campaign_recipients_status_check;
ALTER TABLE public.email_campaign_recipients
  ADD CONSTRAINT email_campaign_recipients_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled'));

ALTER TABLE public.email_send_logs
  DROP CONSTRAINT IF EXISTS email_send_logs_status_check;
ALTER TABLE public.email_send_logs
  ADD CONSTRAINT email_send_logs_status_check
  CHECK (status IN ('started', 'queued', 'sending', 'succeeded', 'failed', 'cancelled'));

CREATE OR REPLACE FUNCTION public.get_scheduled_campaigns()
RETURNS TABLE (
  campaign_id uuid,
  subject text,
  segment text,
  recipient_count bigint,
  send_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    l.id,
    l.subject,
    l.segment,
    count(*) FILTER (WHERE r.status = 'pending')::bigint,
    min(r.send_after),
    l.created_at
  FROM public.email_send_logs l
  JOIN public.email_campaign_recipients r ON r.campaign_id = l.id
  WHERE public.current_user_is_admin()
    AND l.mode = 'send'
    AND l.status = 'queued'
    AND r.status = 'pending'
  GROUP BY l.id, l.subject, l.segment, l.created_at
  HAVING min(r.send_after) > now()
  ORDER BY min(r.send_after);
$$;

REVOKE ALL ON FUNCTION public.get_scheduled_campaigns() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_scheduled_campaigns() TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_campaign(p_campaign_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  campaign_status text;
  scheduled_for timestamptz;
  cancelled_count integer;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT l.status
  INTO campaign_status
  FROM public.email_send_logs l
  WHERE l.id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheduled campaign not found';
  END IF;

  SELECT min(r.send_after)
  INTO scheduled_for
  FROM public.email_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id
    AND r.status = 'pending';

  IF campaign_status <> 'queued' OR scheduled_for IS NULL OR scheduled_for <= now() THEN
    RAISE EXCEPTION 'Campaign can no longer be cancelled';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.email_campaign_recipients r
    WHERE r.campaign_id = p_campaign_id
      AND r.status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'Campaign dispatch has already started';
  END IF;

  UPDATE public.email_campaign_recipients r
  SET status = 'cancelled',
      error_message = 'Cancelled by admin before scheduled send'
  WHERE r.campaign_id = p_campaign_id
    AND r.status = 'pending';
  GET DIAGNOSTICS cancelled_count = ROW_COUNT;

  UPDATE public.email_send_logs l
  SET status = 'cancelled',
      error_message = 'Cancelled before scheduled send',
      response_snapshot = jsonb_build_object(
        'cancelled', cancelled_count,
        'cancelledAt', now()
      )
  WHERE l.id = p_campaign_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_campaign(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_campaign(uuid) TO authenticated;

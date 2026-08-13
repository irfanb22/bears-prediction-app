/*
  # Add SES engagement tracking

  Why:
  - `email_send_logs` records that we handed a message to SES, nothing more.
    "succeeded" means SES accepted it — not that it was delivered, opened, or
    even wanted. Bounces and complaints were previously invisible.
  - Complaints need to unsubscribe the recipient automatically; leaving a
    complainer on the list is how a sending domain's reputation degrades.

  What this adds:
  - `public.email_marketing_events` — one row per SES event (delivery, open,
    click, bounce, complaint, reject), written by the `ses-events` webhook.
  - `campaign_id` foreign-keys back to the `email_send_logs` row, which the
    sender stamps onto each message as an SES message tag. That tag is what
    makes attribution possible without a join table.
  - Admin-only read access, matching `email_send_logs`.

  Note: the webhook writes with the service-role key, which bypasses RLS. The
  policy here exists so the admin dashboard can read events directly.
*/

CREATE TABLE IF NOT EXISTS public.email_marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- SES event types, lowercased on write so queries don't have to care about
  -- Amazon's casing (it sends "Delivery", "Open", "Bounce", ...).
  event_type text NOT NULL CHECK (event_type IN (
    'send', 'delivery', 'open', 'click', 'bounce', 'complaint',
    'reject', 'renderingfailure', 'deliverydelay', 'subscription'
  )),
  campaign_id uuid REFERENCES public.email_send_logs(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient text,
  ses_message_id text,
  -- Amazon's own timestamp for the event, which can lag the row's created_at
  -- by minutes when SNS retries.
  occurred_at timestamptz,
  -- Bounce/complaint subtype ("Permanent"/"Transient", "abuse", ...) and the
  -- clicked URL for click events. Kept flat so the dashboard can group without
  -- digging into the payload.
  detail text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.email_marketing_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_marketing_events'
      AND policyname = 'Admins can read marketing events'
  ) THEN
    CREATE POLICY "Admins can read marketing events"
      ON public.email_marketing_events
      FOR SELECT
      TO authenticated
      USING (public.current_user_is_admin());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_marketing_events_campaign
  ON public.email_marketing_events (campaign_id, event_type);

CREATE INDEX IF NOT EXISTS idx_email_marketing_events_recipient
  ON public.email_marketing_events (lower(recipient));

CREATE INDEX IF NOT EXISTS idx_email_marketing_events_occurred
  ON public.email_marketing_events (occurred_at DESC);

/*
  Per-campaign rollup for the admin dashboard.

  Opens and clicks are counted DISTINCT by recipient: SES fires an open event
  every time the tracking pixel loads, so a recipient who reads a message four
  times would otherwise look like four opens. Raw event rows stay in the table
  for anyone who wants the ungrouped view.
*/
CREATE OR REPLACE FUNCTION public.get_email_campaign_stats()
RETURNS TABLE (
  campaign_id uuid,
  subject text,
  sent_at timestamptz,
  recipient_count integer,
  delivered bigint,
  opened bigint,
  clicked bigint,
  bounced bigint,
  complained bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.subject,
    l.created_at,
    l.recipient_count,
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'delivery'),
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'open'),
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'click'),
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'bounce'),
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'complaint')
  FROM public.email_send_logs l
  LEFT JOIN public.email_marketing_events e ON e.campaign_id = l.id
  WHERE l.mode = 'send'
  GROUP BY l.id, l.subject, l.created_at, l.recipient_count
  ORDER BY l.created_at DESC;
$$;

/*
  # Filter campaign stats by kind, and report send-ledger counts

  Two fixes and one addition.

  Fix 1 — the lifecycle anchors leaked into the campaign list.
  `20260813032230_add_lifecycle_emails.sql` gives each automation an anchor row
  in `email_send_logs` (kind = 'lifecycle') purely so SES engagement events have
  something to attribute to. Its comment claims the anchor "stays out of the
  campaign history list", but nothing filtered on `kind` — so both seeded
  anchors surfaced as phantom "0 recipient" campaigns, and once automations
  start sending, their engagement would have shown up as a campaign nobody sent.

  Fix 2 — the same filter is what lets automations reuse this function. With
  `p_kind` defaulting to 'campaign', the existing zero-argument call site keeps
  working untouched, and the Automations tab can ask for `p_kind => 'lifecycle'`
  to get per-automation engagement out of the same pipeline. No second RPC.

  Addition — `sent_count` / `failed_count` from the dispatch ledger, so the send
  history can show "N of M sent" instead of only the queued total.

  Why those two are correlated subqueries rather than another LEFT JOIN: joining
  `email_marketing_events` and `email_campaign_recipients` in one query fans the
  rows out multiplicatively. The event counts survive that because they're
  `count(DISTINCT recipient)`, but a plain `count(*)` over the ledger would be
  multiplied by however many events each recipient generated.

  These counts are deliberately NOT called "delivered". They record what SES
  accepted at the API, which is a different fact from the `delivery` webhook
  events feeding the `delivered` column — an accepted message can still bounce
  or be silently dropped by the account suppression list.

  New columns are appended rather than inserted, so nothing reading by position
  breaks. `SECURITY INVOKER` is retained: both underlying tables already carry
  admin-only SELECT policies, and RLS should stay the single source of truth for
  who can read this.
*/

DROP FUNCTION IF EXISTS public.get_email_campaign_stats();

CREATE FUNCTION public.get_email_campaign_stats(p_kind text DEFAULT 'campaign')
RETURNS TABLE (
  campaign_id uuid,
  subject text,
  sent_at timestamptz,
  recipient_count integer,
  delivered bigint,
  opened bigint,
  clicked bigint,
  bounced bigint,
  complained bigint,
  kind text,
  sent_count bigint,
  failed_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    l.id,
    l.subject,
    l.created_at,
    l.recipient_count,
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'delivery'),
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'open'),
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'click'),
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'bounce'),
    count(DISTINCT e.recipient) FILTER (WHERE e.event_type = 'complaint'),
    l.kind,
    (SELECT count(*) FROM public.email_campaign_recipients r
      WHERE r.campaign_id = l.id AND r.status = 'sent'),
    (SELECT count(*) FROM public.email_campaign_recipients r
      WHERE r.campaign_id = l.id AND r.status = 'failed')
  FROM public.email_send_logs l
  LEFT JOIN public.email_marketing_events e ON e.campaign_id = l.id
  WHERE l.mode = 'send'
    AND l.kind = p_kind
  GROUP BY l.id, l.subject, l.created_at, l.recipient_count, l.kind
  ORDER BY l.created_at DESC;
$function$;

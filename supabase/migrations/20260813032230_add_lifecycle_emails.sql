/*
  # Add lifecycle email automations

  Why:
  - Campaigns are one-off blasts an admin composes and sends. Onboarding is the
    opposite shape: the same message, sent to each user individually, triggered
    by where they are in their own timeline rather than by a calendar date.

  What this adds:
  - `lifecycle_email_configs` — one row per automation. Content uses the same
    block model as the campaign composer and is rendered at send time, so copy
    edits never need a deploy.
  - `lifecycle_emails` — idempotency ledger keyed on (user, type). This is what
    guarantees nobody can receive the same automation twice, regardless of how
    often the runner ticks or how it crashes mid-batch.
  - `email_send_logs.kind` — each automation owns one anchor log row whose id is
    stamped as the SES `campaign_id` tag, so opens and clicks flow through the
    existing webhook → `email_marketing_events` → stats pipeline unchanged. The
    anchor is `kind = 'lifecycle'` so it stays out of the campaign history list,
    and `succeeded` so the campaign dispatcher's active scan ignores it.

  The retroactive-send guard:
  - `starts_at` exists because the obvious eligibility rule — "signed up more
    than delay_hours ago" — matches every user who ever registered. Switching on
    a welcome email would blast the entire existing list with a greeting years
    late. Only users who signed up after `starts_at` are eligible, and it
    defaults to the moment the automation is created.
*/

ALTER TABLE public.email_send_logs
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'campaign';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_send_logs_kind_check'
  ) THEN
    ALTER TABLE public.email_send_logs
      ADD CONSTRAINT email_send_logs_kind_check CHECK (kind IN ('campaign', 'lifecycle'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.lifecycle_email_configs (
  email_type text PRIMARY KEY,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  -- Hours after signup before the user becomes eligible.
  delay_hours integer NOT NULL DEFAULT 24 CHECK (delay_hours >= 0),
  -- 'all' greets everyone; 'no_predictions' targets users who registered but
  -- never actually played, which is the group worth nudging.
  audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'no_predictions')),
  -- Nobody who signed up before this instant is eligible. See the note above:
  -- without it, enabling an automation mails the entire back catalogue.
  starts_at timestamptz NOT NULL DEFAULT now(),
  subject text NOT NULL DEFAULT '',
  preview_text text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats_campaign_id uuid NOT NULL REFERENCES public.email_send_logs(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.lifecycle_email_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lifecycle_email_configs'
      AND policyname = 'Admins can read lifecycle configs'
  ) THEN
    CREATE POLICY "Admins can read lifecycle configs"
      ON public.lifecycle_email_configs FOR SELECT TO authenticated
      USING (public.current_user_is_admin());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.lifecycle_emails (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL
    REFERENCES public.lifecycle_email_configs(email_type) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, email_type)
);

ALTER TABLE public.lifecycle_emails ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lifecycle_emails'
      AND policyname = 'Admins can read lifecycle sends'
  ) THEN
    CREATE POLICY "Admins can read lifecycle sends"
      ON public.lifecycle_emails FOR SELECT TO authenticated
      USING (public.current_user_is_admin());
  END IF;
END $$;

/*
  Users eligible for an automation right now.

  Every clause here is a guard against mailing someone we shouldn't:
    - unconfirmed accounts are excluded, since an unverified address is exactly
      the kind that hard-bounces and costs reputation
    - unsubscribed users are excluded
    - the ledger join is what makes repeat sends impossible
    - `starts_at` keeps the back catalogue out
*/
CREATE OR REPLACE FUNCTION public.get_lifecycle_recipients(
  p_email_type text,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.lifecycle_email_configs%ROWTYPE;
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
    AND NOT EXISTS (
      SELECT 1 FROM public.lifecycle_emails le
      WHERE le.user_id = u.id AND le.email_type = p_email_type
    )
    AND (
      cfg.audience = 'all'
      OR NOT EXISTS (
        SELECT 1 FROM public.predictions p WHERE p.user_id = u.id
      )
    )
  ORDER BY u.created_at
  LIMIT p_limit;
END $$;

REVOKE ALL ON FUNCTION public.get_lifecycle_recipients(text, integer) FROM public, anon, authenticated;

/* Automation list plus how many have actually gone out, for the admin UI. */
CREATE OR REPLACE FUNCTION public.get_lifecycle_configs()
RETURNS TABLE (
  email_type text,
  name text,
  description text,
  enabled boolean,
  delay_hours integer,
  audience text,
  starts_at timestamptz,
  subject text,
  preview_text text,
  blocks jsonb,
  stats_campaign_id uuid,
  sent_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.email_type, c.name, c.description, c.enabled, c.delay_hours, c.audience,
         c.starts_at, c.subject, c.preview_text, c.blocks, c.stats_campaign_id,
         (SELECT count(*) FROM public.lifecycle_emails le WHERE le.email_type = c.email_type)
  FROM public.lifecycle_email_configs c
  WHERE public.current_user_is_admin()
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_lifecycle_configs() TO authenticated;

-- Seed two automations, both disabled and empty. Content is composed in
-- /admin/email; nothing sends until an admin writes copy and switches it on.
DO $$
DECLARE
  v_anchor uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lifecycle_email_configs WHERE email_type = 'welcome') THEN
    INSERT INTO public.email_send_logs (mode, subject, status, kind, recipient_count)
    VALUES ('send', 'Lifecycle: Welcome', 'succeeded', 'lifecycle', 0)
    RETURNING id INTO v_anchor;

    INSERT INTO public.lifecycle_email_configs
      (email_type, name, description, delay_hours, audience, subject, stats_campaign_id)
    VALUES ('welcome', 'Welcome email',
            'Sent once, shortly after a new account confirms its email address.',
            1, 'all', 'Welcome to Bears Prediction Tracker', v_anchor);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.lifecycle_email_configs WHERE email_type = 'first_prediction_nudge') THEN
    INSERT INTO public.email_send_logs (mode, subject, status, kind, recipient_count)
    VALUES ('send', 'Lifecycle: First prediction nudge', 'succeeded', 'lifecycle', 0)
    RETURNING id INTO v_anchor;

    INSERT INTO public.lifecycle_email_configs
      (email_type, name, description, delay_hours, audience, subject, stats_campaign_id)
    VALUES ('first_prediction_nudge', 'First prediction nudge',
            'Sent to users who registered but have not made a single prediction yet.',
            72, 'no_predictions', 'You have not made your picks yet', v_anchor);
  END IF;
END $$;

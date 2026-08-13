/*
  # Give lifecycle emails their own header copy

  `buildSeasonRecapEmail` renders its header unconditionally and falls back to
  the 2025 season-recap strings ("2025 Season Recap" / "How Bears Fans Predicted
  the Season" / "Irfan | Mar 31") whenever the caller omits them. That's correct
  for the campaign it was written for and wrong for everything else — a welcome
  email would have arrived headed "2025 Season Recap".

  Rather than hardcode a second set of strings in the runner, each automation
  carries its own header and footer copy, editable alongside its body.
*/

ALTER TABLE public.lifecycle_email_configs
  ADD COLUMN IF NOT EXISTS header_eyebrow text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS header_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS header_meta text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_link_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_link_href text NOT NULL DEFAULT 'https://bearsprediction.com';

UPDATE public.lifecycle_email_configs
SET header_eyebrow = 'Welcome',
    header_title = 'Welcome to Bears Prediction Tracker',
    footer_link_label = 'Visit the site'
WHERE email_type = 'welcome' AND header_title = '';

UPDATE public.lifecycle_email_configs
SET header_eyebrow = 'Your picks',
    header_title = 'You have not made your picks yet',
    footer_link_label = 'Make your predictions'
WHERE email_type = 'first_prediction_nudge' AND header_title = '';

DROP FUNCTION IF EXISTS public.get_lifecycle_configs();

CREATE FUNCTION public.get_lifecycle_configs()
RETURNS TABLE (
  email_type text, name text, description text, enabled boolean,
  delay_hours integer, audience text, starts_at timestamptz,
  subject text, preview_text text, blocks jsonb,
  header_eyebrow text, header_title text, header_meta text,
  footer_link_label text, footer_link_href text,
  stats_campaign_id uuid, sent_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.email_type, c.name, c.description, c.enabled, c.delay_hours, c.audience,
         c.starts_at, c.subject, c.preview_text, c.blocks,
         c.header_eyebrow, c.header_title, c.header_meta,
         c.footer_link_label, c.footer_link_href,
         c.stats_campaign_id,
         (SELECT count(*) FROM public.lifecycle_emails le WHERE le.email_type = c.email_type)
  FROM public.lifecycle_email_configs c
  WHERE public.current_user_is_admin()
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_lifecycle_configs() TO authenticated;

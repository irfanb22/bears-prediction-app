/*
  # Give the admin UI a way to write lifecycle automations

  `lifecycle_email_configs` shipped with an admin SELECT policy and nothing
  else, so the automations editor had no supported save path.

  These are functions rather than an UPDATE policy, for four reasons:

  1. `starts_at` must stay unwritable. It is the retroactive-send guard: only
     users who signed up after it are eligible, which is what keeps enabling an
     automation from mailing the entire back catalogue. An UPDATE policy exposes
     every column, so a client could set it to '-infinity' and, the moment
     scheduling is enabled, greet years of existing accounts. These functions
     simply do not accept it as a parameter, which makes it unwritable by
     construction rather than by client discipline. Same for `stats_campaign_id`,
     which anchors engagement attribution.
  2. "enabled may become true only when content exists" is a transition rule,
     not a row predicate — a CHECK can't express it, and a WITH CHECK policy
     would surface a generic RLS violation instead of a message worth showing.
     Here it raises text the UI can display verbatim, and it mirrors the guard
     in run-lifecycle/index.ts so the two cannot drift apart.
  3. `updated_at` / `updated_by` get stamped server-side rather than trusted.
  4. Every other admin write path in this schema is already a function.

  Named `update_`, not `upsert_`: creating an automation would first require
  minting an anchor row in `email_send_logs`, which these do not do.
*/

CREATE OR REPLACE FUNCTION public.update_lifecycle_config(
  p_email_type text,
  p_subject text,
  p_preview_text text,
  p_delay_hours integer,
  p_audience text,
  p_header_eyebrow text,
  p_header_title text,
  p_header_meta text,
  p_footer_link_label text,
  p_footer_link_href text,
  p_blocks jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_delay_hours IS NULL OR p_delay_hours < 1 OR p_delay_hours > 720 THEN
    RAISE EXCEPTION 'Delay must be between 1 and 720 hours';
  END IF;

  IF p_audience IS NOT NULL AND p_audience NOT IN ('all', 'no_predictions') THEN
    RAISE EXCEPTION 'Unknown audience: %', p_audience;
  END IF;

  UPDATE public.lifecycle_email_configs
  SET subject           = coalesce(p_subject, subject),
      preview_text      = p_preview_text,
      delay_hours       = p_delay_hours,
      audience          = coalesce(p_audience, audience),
      header_eyebrow    = coalesce(p_header_eyebrow, header_eyebrow),
      header_title      = coalesce(p_header_title, header_title),
      header_meta       = coalesce(p_header_meta, header_meta),
      footer_link_label = coalesce(p_footer_link_label, footer_link_label),
      footer_link_href  = coalesce(p_footer_link_href, footer_link_href),
      blocks            = coalesce(p_blocks, blocks),
      updated_at        = now(),
      updated_by        = auth.uid()
  WHERE email_type = p_email_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No automation named %', p_email_type;
  END IF;
END $function$;

GRANT EXECUTE ON FUNCTION public.update_lifecycle_config(
  text, text, text, integer, text, text, text, text, text, text, jsonb
) TO authenticated;

/*
  Turning an automation on is separate from editing it, because switching it on
  is the only action here with an outward consequence.

  The content check deliberately refuses rather than silently no-ops: an admin
  who flips the switch on an empty automation should be told why it didn't take,
  not left believing it is running.
*/
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

  SELECT * INTO cfg FROM public.lifecycle_email_configs WHERE email_type = p_email_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No automation named %', p_email_type;
  END IF;

  IF p_enabled THEN
    IF btrim(coalesce(cfg.subject, '')) = '' OR jsonb_array_length(coalesce(cfg.blocks, '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'Add a subject and email content before switching this on';
    END IF;
  END IF;

  UPDATE public.lifecycle_email_configs
  SET enabled = p_enabled, updated_at = now(), updated_by = auth.uid()
  WHERE email_type = p_email_type;
END $function$;

GRANT EXECUTE ON FUNCTION public.set_lifecycle_enabled(text, boolean) TO authenticated;

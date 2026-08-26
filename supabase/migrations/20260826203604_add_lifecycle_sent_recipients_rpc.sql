/*
  # List who has actually received an automation

  Powers the "View recipients" drill-in on the Automations tab.

  Must be SECURITY DEFINER: the ledger stores only `user_id`, and the address
  lives in `auth.users`, which is not reachable through PostgREST from a client.

  Because it is DEFINER *and* granted to `authenticated`, the admin check in the
  body is the only thing standing between any signed-in user and every
  subscriber's email address. It is not optional.

  Named distinctly from `get_lifecycle_recipients`, which answers the unrelated
  question of who is currently *eligible* and is deliberately revoked from
  clients. Confusing the two in client code yields a permission error rather
  than the wrong data, but the names are kept far apart regardless.
*/

CREATE OR REPLACE FUNCTION public.get_lifecycle_sent_recipients(
  p_email_type text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  email text,
  email_type text,
  sent_at timestamptz,
  signed_up_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT u.email::text, le.email_type, le.sent_at, u.created_at
  FROM public.lifecycle_emails le
  JOIN auth.users u ON u.id = le.user_id
  WHERE (p_email_type IS NULL OR le.email_type = p_email_type)
    AND u.email IS NOT NULL
  ORDER BY le.sent_at DESC
  LIMIT least(coalesce(p_limit, 100), 500);
END $function$;

GRANT EXECUTE ON FUNCTION public.get_lifecycle_sent_recipients(text, integer) TO authenticated;

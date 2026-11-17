/*
  # Keep scheduler logs from filling the database

  The two cron jobs (campaign dispatch every minute with 5 requests per tick,
  lifecycle emails every 5 minutes) wrote ~1,700 cron runs and ~7,500 pg_net
  responses a day. `cron.job_run_details` is never purged, and pg_net's
  6-hour response cleanup leaves the freed space inside the table, so the two
  log tables grew to ~1.1 GB while the app's own data is a few MB.

  1. Dispatch campaigns every 5 minutes instead of every minute. Each tick
     still sends up to 5 x 25 = 125 recipients; scheduled sends may start up
     to 5 minutes after `send_after`. The lifecycle job is unchanged because
     its admin health check expects `*/5 * * * *`.
  2. Purge cron run history older than 7 days, daily.
  3. Truncate both log tables once to release the space already used.
     Nothing in the app reads them.
*/

DO $block$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('dispatch-marketing-campaigns', 'purge-cron-run-history')
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$block$;

SELECT cron.schedule(
  'dispatch-marketing-campaigns',
  '*/5 * * * *',
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

SELECT cron.schedule(
  'purge-cron-run-history',
  '17 3 * * *',
  $job$
    DELETE FROM cron.job_run_details
    WHERE end_time < now() - interval '7 days';
  $job$
);

TRUNCATE cron.job_run_details;
TRUNCATE net._http_response;

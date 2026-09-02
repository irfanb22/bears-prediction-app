# Supabase Email Functions

These Edge Functions send Bears Prediction Tracker email through Amazon SES,
manage campaign batches, record engagement events, and process unsubscribes.

## Functions

- `send-brevo-email`
  - Legacy route name retained so the deployed admin console keeps working.
  - No provider-specific implementation remains: test messages are sent through
    SES and production campaigns are queued for the SES dispatcher.
  - Supports `mode: "test"` for one inbox and `mode: "send"` for the built-in
    `all_subscribed_users` segment.
- `dispatch-campaign`
  - Claims and sends queued campaign recipients through SES in batches of 25.
  - The admin page currently drives the batches. Keep it open until the campaign
    finishes; no database cron backstop is installed.
- `run-lifecycle`
  - Sends enabled lifecycle emails through SES.
- `ses-events`
  - Receives SES/SNS delivery, open, click, bounce, and complaint events.
  - Complaints are recorded and immediately unsubscribe the associated account.
- `unsubscribe-email`
  - A GET renders a confirmation form without changing account state, protecting
    recipients from inbox security scanners that visit links automatically.
  - The confirmation POST verifies the signed recipient token, updates
    `public.email_preferences`, and redirects to the public status page.

## Required Supabase Secrets

Set these before deploying:

```bash
supabase secrets set \
  SES_SMTP_USER=... \
  SES_SMTP_PASSWORD=... \
  SES_SENDER_EMAIL=updates@updates.bearsprediction.com \
  SES_SENDER_NAME="Bears Prediction Tracker" \
  SES_REPLY_TO_EMAIL=reply@bearsprediction.com \
  SES_CONFIG_SET=bears-marketing \
  SES_REGION=us-east-1 \
  SES_WEBHOOK_TOKEN=... \
  DISPATCH_TOKEN=... \
  UNSUBSCRIBE_SIGNING_SECRET=... \
  EMAIL_UNSUBSCRIBE_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/unsubscribe-email
```

`SES_SMTP_USER` and `SES_SMTP_PASSWORD` must be SES SMTP credentials, not a raw
AWS access key. `SES_CONFIG_SET` stamps every message so the SNS event destination
can attribute delivery and engagement events to the correct campaign.

Supabase-managed secrets already expected by the functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
supabase functions deploy send-brevo-email
supabase functions deploy dispatch-campaign
supabase functions deploy run-lifecycle
supabase functions deploy ses-events
supabase functions deploy unsubscribe-email
```

The `send-brevo-email` route should be renamed only as a coordinated migration:
deploy the replacement function first, update the admin console, deploy the site,
verify a test send, and then delete the legacy function.

## Local Serve

```bash
supabase functions serve send-brevo-email --env-file .env.local
```

## Test Send Example

The endpoint requires an authenticated admin bearer token.

```bash
curl -i --request POST \
  'http://127.0.0.1:54321/functions/v1/send-brevo-email' \
  --header 'Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "mode": "test",
    "testEmail": "you@example.com",
    "subject": "Test message",
    "previewText": "Preview copy",
    "blocks": []
  }'
```

## Production Segment Example

```bash
curl -i --request POST \
  'http://127.0.0.1:54321/functions/v1/send-brevo-email' \
  --header 'Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "mode": "send",
    "segment": "all_subscribed_users",
    "subject": "Campaign subject",
    "previewText": "Campaign preview",
    "blocks": []
  }'
```

## Operational Notes

- Messages are sent individually so recipient addresses are never exposed to
  one another and SES can attribute engagement per recipient.
- `marketing_subscribed = false` recipients are excluded from campaigns.
- Accounts without an `email_preferences` row currently default to subscribed.
- Campaigns include only confirmed auth addresses. The sender and the admin
  audience-count RPC intentionally apply the same eligibility rule.
- Production emails receive a signed, recipient-specific unsubscribe URL.
- Unsubscribe links carry `ses:no-track` so SES does not rewrite them or count
  automated security checks as engagement.
- Visiting an unsubscribe URL is read-only; the preference changes only after
  the recipient submits the confirmation form.
- Public email images must use HTTPS URLs.

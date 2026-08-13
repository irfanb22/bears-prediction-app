# Supabase Email Functions

This directory contains the first-pass Brevo integration for Bears Prediction Tracker.

## Function

- `send-brevo-email`
  - Sends the 2025 season recap email through the Brevo transactional API.
  - Supports:
    - `mode: "test"` to send to a single inbox
    - `mode: "send"` to send to explicit recipients or the built-in `season_2025_participants` segment
- `unsubscribe-email`
  - handles app-managed unsubscribe requests
  - updates `public.email_preferences`

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
  UNSUBSCRIBE_SIGNING_SECRET=... \
  EMAIL_UNSUBSCRIBE_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/unsubscribe-email
```

`SES_SMTP_USER` / `SES_SMTP_PASSWORD` are **SES SMTP credentials** (SES console →
SMTP settings → Create SMTP credentials), not a raw AWS access key. The password
is displayed once at creation — save it to a password manager before leaving the
page. `SES_CONFIG_SET` is what makes Bears sends show up separately from
q2Kindle's in per-product reputation metrics; sends still work without it, but
you lose the ability to tell which product moved the account bounce rate.

Supabase-managed secrets already expected by Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
supabase functions deploy send-brevo-email
supabase functions deploy unsubscribe-email
```

## Local Serve

```bash
supabase functions serve send-brevo-email --env-file .env.local
```

## Test Send Example

```bash
curl -i --request POST \
  'http://127.0.0.1:54321/functions/v1/send-brevo-email' \
  --header 'Authorization: Bearer YOUR_SUPABASE_ANON_OR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "mode": "test",
    "testEmail": "you@example.com",
    "imageUrls": {
      "hero": "https://your-cdn.example.com/hero.jpg",
      "communityAccuracy": "https://your-cdn.example.com/community-chart.png",
      "calebRecord": "https://your-cdn.example.com/caleb-record.png",
      "playoff": "https://your-cdn.example.com/playoff.png",
      "romeOdunze": "https://your-cdn.example.com/rome-card.png",
      "offenseSurprise": "https://your-cdn.example.com/offense-card.png",
      "draft": "https://your-cdn.example.com/draft.png"
    }
  }'
```

## Send To Built-In Segment

```bash
curl -i --request POST \
  'http://127.0.0.1:54321/functions/v1/send-brevo-email' \
  --header 'Authorization: Bearer YOUR_SUPABASE_ANON_OR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "mode": "send",
    "segment": "season_2025_participants",
    "imageUrls": {
      "hero": "https://your-cdn.example.com/hero.jpg",
      "communityAccuracy": "https://your-cdn.example.com/community-chart.png",
      "calebRecord": "https://your-cdn.example.com/caleb-record.png",
      "playoff": "https://your-cdn.example.com/playoff.png",
      "romeOdunze": "https://your-cdn.example.com/rome-card.png",
      "offenseSurprise": "https://your-cdn.example.com/offense-card.png",
      "draft": "https://your-cdn.example.com/draft.png"
    }
  }'
```

## Notes

- This first version sends one transactional email per recipient to avoid exposing recipient addresses to each other.
- The built-in segment targets users with at least one 2025 prediction and a non-empty auth email.
- Recipients with `marketing_subscribed = false` in `public.email_preferences` are skipped.
- The unsubscribe link is app-managed and updates Supabase directly.
- Image URLs should be hosted publicly over HTTPS.

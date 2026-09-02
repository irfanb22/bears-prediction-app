# Bears Prediction Tracker - Project Context

Last updated: 2026-04-05
Repository path: `/Users/irfan/Projects/bears-tracker-may22-main`

## 1. What This Site Is

This app is a Chicago Bears fan prediction platform.

Core idea:
- Fans make predictions about the Bears season (player stats, team outcomes, draft items).
- Users attach a confidence level to each prediction.
- Community sentiment is shown as aggregate percentages.
- Users track their own picks and points in a personal dashboard.
- Admin can manage questions and season content.

Positioning:
- Not a gambling product.
- A fan knowledge and bragging-rights tracker.

Product origin story:
- Started from a recurring personal problem: you and your brother make Bears predictions, then later forget who said what.
- UX inspiration includes the simplicity of Polymarket-style yes/no markets.
- Initial implementation was built with Bolt.

Current primary business goal:
- Score all existing 2025-season user predictions in the database.

## 2. Current Feature Summary

### Public
- Home page with 2025 season prediction questions.
- 2026 season draft question onboarding flow for signed-in users.
- Category filters:
  - `all`
  - `qb`
  - `rookies`
  - `player_stats`
  - `team_stats`
  - `awards`
  - `draft_predictions`
  - `playoffs`
- Community percentages shown per question.
- "How It Works" page explaining product intent.

### Auth
- Email/password sign up and login.
- Email verification callback flow.
- Forgot password + reset password flow.

### Logged-In User
- Create/update prediction per question (upsert behavior).
- Select confidence: `low`, `medium`, `high`.
- Deadline enforcement for predictions.
- Guided onboarding:
  - Step 1 asks for a user display name if none is saved.
  - Step 2 walks the user through one live 2026 prediction with guided highlights.
  - After first save, user is redirected to `My Predictions` and shown a one-time dashboard tip.
- Dashboard with:
  - total predictions
  - active/upcoming predictions
  - season score/points
  - latest prediction cards

### Admin
- Admin-protected route/dashboard.
- Create new questions.
- Edit question details:
  - text
  - category
  - type (`yes_no` or `multiple_choice`)
  - deadline
  - featured flag
  - status (`pending`, `live`, `completed`)
  - correct answer
- Manage multiple-choice options.

## 2.1 Quick Memory Guide (Plain English)

### What the app does
- This is a Bears fan prediction app.
- People sign up, make picks, and see how they compare to other fans.
- It is for fun and bragging rights, not gambling.

### Main user flow
1. User signs up (email + password).
2. User confirms email from inbox.
3. If the user has no saved display name, onboarding asks what they should be called.
4. If the user has no `2026` predictions yet, onboarding opens one live 2026 question and guides them through answer choice, confidence, and deadline.
5. User picks an answer (`yes/no` or multiple choice) and sets confidence.
6. User can update their prediction while the question is still live.
7. User is redirected to Dashboard (`My Predictions`) after onboarding save and sees a one-time orientation tip.
8. User sees their picks and results in Dashboard.
9. User checks community standings in Leaderboard.

### Admin flow
1. Admin logs in.
2. Admin opens Admin Dashboard.
3. Admin creates/edits questions (text, type, category, deadline, status, featured, correct answer).
4. Questions set to `live` become available for users to predict.
5. Questions set to `completed` + correct answer drive scoring and leaderboard updates.

### Core product rules (current)
- One current prediction per user per question (latest saved value wins).
- Predictions can only be created/updated before deadline.
- Confidence is shown, but does not change points right now.
- Scoring policy: `1` point correct, `0` incorrect/unresolved.
- Accuracy only counts resolved questions.
- Leaderboard is for authenticated users and uses masked display names.
- Display names are now collected during onboarding for any signed-in user missing `users.display_name`.
- 2026 onboarding prediction guidance only appears if the signed-in user has no `2026` predictions yet.

### Access and security rules (current)
- Public can browse core prediction content.
- Authenticated users can write their own predictions only.
- Admin actions are role-based in the database (`user_roles`), not just email checks in UI.
- Secrets must stay out of client env (`VITE_*` only for public browser-safe keys).

## 3. Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- `react-router-dom`
- `date-fns`
- `react-day-picker`
- `lucide-react`

### Backend / Data
- Supabase
  - Auth
  - Postgres
  - Realtime subscriptions
  - RLS policies and migrations

## 4. Important App Architecture Notes

- App entry:
  - `src/main.tsx`
  - `src/App.tsx`
- Global providers:
  - `AuthProvider` in `src/lib/auth.tsx`
  - `PredictionProvider` in `src/lib/PredictionContext.tsx`
- Main app pages/components:
  - `src/components/PredictionInterface.tsx`
  - `src/components/Dashboard.tsx`
  - `src/components/AdminDashboard.tsx`
  - `src/components/HowItWorks.tsx`
  - `src/components/PredictionEditorModal.tsx`
- Supabase client:
  - `src/lib/supabase.ts`

## 5. Data/Domain Model (High-Level)

Primary entities currently used:
- `questions`
- `predictions`
- `choices`
- `prediction_types`
- `games`

Prediction behavior:
- User has one current prediction per question (`upsert` on `user_id, question_id`).
- Aggregates are computed from all predictions for community percentages.

Game prediction model (current schema):
- `predictions` supports both question picks and game picks.
- A prediction targets either `question_id` or `game_id` (not both).
- `prediction_type_id` is used to distinguish `question` vs `game`.
- `games.season` is now part of the data model for explicit season separation.

## 5.1 Official Scoring Policy (Current)

Scope:
- Current scoring scope is the `2025` Bears season.
- Future seasons (for example `2026`) should use the same framework but be scored separately by season.

Core scoring rules:
- `1 point` for each correct prediction.
- `0 points` for each incorrect prediction.
- Confidence (`low`, `medium`, `high`) does **not** affect points.

Resolution rules:
- A prediction is considered `resolved` when its related question has a final `correct_answer` (and/or is marked completed).
- Unresolved predictions are excluded from accuracy until resolved.

Accuracy formula:
- `accuracy = correct_predictions / resolved_predictions`
- Pending/unresolved predictions should be shown separately and should not reduce accuracy.

Confidence product intent:
- Confidence is a fan-sentiment signal, not a scoring multiplier.
- Use confidence to understand community conviction on a topic (for example, how strongly fans feel about a yes/no outcome).

## 5.2 Confidence Sentiment Aggregation (Current Rule)

Intent:
- Confidence drives sentiment/meter display only.
- Confidence does not affect points.

Aggregation logic:
- Map confidence levels to numeric values:
  - `low = 1`
  - `medium = 2`
  - `high = 3`
- For each question, compute the average confidence across users.
- Each user contributes one confidence value per question (latest saved value only).

Meter conversion:
- Convert average confidence (`1..3`) to percent (`0..100`) with:
  - `meter_percent = ((avg_confidence_score - 1) / 2) * 100`

Current label thresholds in database function:
- `Low` if meter `< 40`
- `Medium` if meter `>= 40` and `< 70`
- `High` if meter `>= 70`

Current implementation status:
- Database aggregation function exists in production:
  - `public.get_question_confidence_sentiment(target_season integer default 2025)`
- Home card meter UI is wired to this function, with client-side fallback logic if needed.

## 5.3 Taxonomy Baseline (Locked for 2026 Foundation)

Canonical topic/tag set:
- `all`
- `qb`
- `rookies`
- `player_stats`
- `team_stats`
- `awards`
- `playoffs`
- `draft_predictions`

2025 question set status:
- Test question removed from production.
- Active 2025 set is `13` questions.
- 2025 categories were recategorized to align with the canonical tags above.

## 6. Environment and Credentials (Safe Handling)

Use local env files and never commit secrets.

### Client-exposed variables (okay for browser bundle)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Secret variables (server-only; never in `VITE_*`)
- Supabase service role key
- SMTP provider credentials
- Domain/DNS provider API keys
- Transactional email API keys

Recommended local files:
- `.env.local` for local dev values
- Keep ignored via `.gitignore`

## 7. Hosting / Domain / Email Provider

Known:
- Domain: `bearsprediction.com`
- Domain registrar/owner platform: Squarespace
- App hosting provider: Netlify
- Email provider: Amazon SES for campaigns, lifecycle messages, and Supabase Auth SMTP
- Campaign engagement: SES configuration set -> SNS -> `ses-events` Edge Function
- Legacy compatibility: the campaign entrypoint is still deployed under the historical
  `send-brevo-email` route name, but its implementation sends exclusively through SES
- Retired-provider cleanup still pending outside the repository:
  - delete the three unused `BREVO_*` Supabase Edge Function secrets
  - replace the DMARC aggregate-report destination `rua@dmarc.brevo.com`
- Netlify-style redirect file exists: `public/_redirects`

To fill in:
- DNS host (if separate from Squarespace):
- Primary support/admin email:

## 8. Supabase Project Notes

Confirmed from the live Supabase Auth configuration on 2026-09-02:
- Supabase project name: `bears-prediction-market`
- Environment label visible in Supabase UI: `PRODUCTION`
- Auth mode in use: Supabase Auth (email/password)
- User signups: enabled
- Confirm email: enabled
- Manual account linking: disabled
- Anonymous sign-ins: disabled
- Custom SMTP: enabled
  - Sender email: `noreply@bearsprediction.com`
  - Sender name: `Bears Prediction`
  - SMTP host: `email-smtp.us-east-1.amazonaws.com` (Amazon SES)
  - Port: `587`
  - Minimum interval per user: `60 seconds`

Still to confirm:
- RLS strategy summary (can be derived from migrations and policies)

Confirmed from additional screenshots:
- Supabase project ID/reference: `mvyvfvwguwqowytnkvvs`
- Supabase project URL: `https://mvyvfvwguwqowytnkvvs.supabase.co`
- Current setup appears to be a single Supabase project with one active branch (`main`) marked `PRODUCTION`.
- No separate staging project currently in use.
- Auth URL configuration:
  - Site URL: `https://bearsprediction.com/`
  - Redirect URLs allowlist:
    - `http://localhost:5173/auth/callback`
    - `https://bears-predictions.netlify.app/auth/callback`
    - `https://bearsprediction.com/auth/callback`

## 9. Development Workflow Notes

- This project was initially built with Bolt.
- Ongoing development now in Codex.
- Current working style is vibe coding / iterative no-heavy-process development.
- Keep this file updated after major feature, infra, or auth changes.
- Git safety rule (critical, added 2026-03-05):
  - Always start work on a dedicated branch prefixed with `codex/`.
  - Never commit directly to `main`.
  - Never push directly to `origin/main`.
  - Before any push action, explicitly ask user for confirmation.
  - If current branch is `main`, stop and ask whether to create/switch to a `codex/*` branch before continuing.
  - Branch and save naming should be plain-English and easy to understand (example: `codex/redesign-mobile-qa`, `codex/confidence-meter-logic`).
  - At the start of each new session, ask user to confirm preferred branch name and commit/save naming for that session.
- Review workflow preference (added 2026-03-05):
  - When a session includes UI review, interaction testing, or click-through QA, explicitly start local dev server and provide localhost URL.
  - At session start, confirm whether user wants live browser review mode enabled for that session.
  - Default local review URL pattern: `http://127.0.0.1:5173/` unless port changes.

## 11. Git / GitHub Setup Status

Local machine status (as of 2026-02-22):
- Git identity is configured globally:
  - `user.name=irfanb22`
  - `user.email=77904897+irfanb22@users.noreply.github.com`
- Repository initialized locally with `git init` at:
  - `/Users/irfan/Projects/bears-tracker-may22-main`
- SSH key created for GitHub auth:
  - Private key: `~/.ssh/id_ed25519_github`
  - Public key: `~/.ssh/id_ed25519_github.pub`
- SSH config updated to use that key for `github.com`.
- SSH authentication verified successfully against GitHub.
- Remote configured:
  - `origin = git@github.com:irfanb22/bears-tracker-may22.git`
- Local-vs-remote file comparison completed:
  - All shared files are identical to `origin/main`.
  - Local-only file: `PROJECT_CONTEXT.md`.

Pending repo wiring:
- Push initial commit from this local git repo only when approved.

## 10. Current Priority Order (Updated 2026-03-30)

Current phase status (as of 2026-03-30):
- Active roadmap phase: **Phase 1 (Consolidated): View Recap + User Email Campaign**.
- Phase 1 completion state: **nearly complete**.
- Phase 3 completion state: **complete**.
- Phase 4 completion state: **complete**.
- 2026 game-by-game expansion moved to **Phase 7 (final phase, not scheduled yet)**.
- Major done items already verified:
  - role-based admin access is working
  - scoring policy is defined (`1`/`0`, confidence excluded from points)
  - basic scoring/dashboard updates shipped
  - UI redesign pass is complete for Home/Navbar/My Predictions/Leaderboard
  - fan confidence sentiment phase is complete
  - on-site `View Recap` experience is live
  - recap homepage banner CTA is live
  - first 2026 draft question exists and is linked from recap flows
  - admin email console is live at `/admin/email`
  - AWS SES campaign send, engagement tracking, and unsubscribe flows are live

### 2026-03-30 Session Update: Recap Email System
- Built a lightweight block-based email composer into `/admin/email`.
- Composer supports editable:
  - subject
  - preview text
  - headings
  - paragraphs
  - images
  - buttons
  - spacers
  - signature block
- Added live admin preview so draft edits can be reviewed before test send.
- Updated the campaign sender (deployed under the legacy `send-brevo-email` route)
  to render the current composed draft instead of relying only on a fixed hardcoded recap template.
- Refreshed recap email copy so it matches the live on-site recap language.
- Added public hosted recap email assets under `public/email/recap-2025/`.
- Rebuilt/iterated recap graphics for email readability:
  - fixed clipped exports
  - removed confusing extra framing
  - increased in-image typography
  - tuned widths for mobile readability
  - added cache-busting versioning to image URLs during testing
- Added real CTA links in the email for:
  - `My Predictions`
  - `Leaderboard`
- Added login-aware CTA routing so signed-out users can be pushed toward auth before continuing to protected pages.
- Added clickable 2026 draft-question card to the email `What's Next` section.
- Updated the draft-question email card to:
  - match the live product direction more closely
  - use `What position will the Bears select with the 25th pick?`
  - include expanded option list plus `Other`
- Cleaned up recap chart wording by removing confusing `(no)` suffixes in:
  - email assets
  - website recap visuals
- Added email ending/signoff:
  - `Thanks for joining the community.`
  - signature-style `Irfan`
- Current status:
  - recap email system is functionally live
  - production test-email workflow is live
  - final polish is focused on remaining readability/image-size tuning before campaign send

### Priority 1: Build `View Recap` End-of-Season Experience
- `View Recap` is implemented and live as the on-site end-of-season report experience.
- Remaining work in this phase is now tied mainly to final recap email polish and send readiness.

### Priority 2: Active User List + AWS SES Marketing Email
- Admin-driven recap email workflow is built and live.
- Amazon SES send path is wired through the Supabase Edge Function currently
  deployed under the legacy `send-brevo-email` route name.
- Remaining work:
  - final visual/content polish in test emails
  - final QA on mobile + inbox rendering
  - production send to the intended active-user segment
- Current email content now includes:
  - recap summary details
  - CTA links to user results / leaderboard flows
  - live 2026 draft-question CTA

### Priority 3: Roadmap Sequencing Cleanup
- Keep Phase 3 and Phase 4 marked complete in planning docs.
- Keep 2026 full game-by-game expansion deferred to final phase planning.

### Priority 4: 2026 Product Expansion (Deferred to Final Phase)
- 2026 game-by-game picks are intentionally deferred until scheduled later.
- This is now Phase 7 and treated as last-phase scope.

### Question Management Operating Decision (Current)
- Do question creation/deadline updates through **Codex/terminal** for now.
- Admin date picker bug is **deferred** and not a current priority.
- Admin UI remains available for occasional spot checks/edits.

### UX/UI Redesign Decisions Locked (Session Notes)
- Selected visual direction: **Halas Desk** style.
- Typography decision: keep current family (`Option A` direction), but use **heavier key text hierarchy** for headers/titles/labels.
- Background decision: keep primary page background **white**.
- Terminology decision: use **fan** language (`Fan Volume`, `Fan Confidence`) instead of "community".
- Interaction decision (cards): keep hybrid actions:
  - quick choice entry points on option labels (`Yes` / `No` and top multiple-choice options)
  - keep primary `Make Prediction` action button on cards.
- Navigation decision:
  - primary nav: `Home`, `Leaderboard`, `My Predictions` (plus `Admin` for admins)
  - de-emphasize `How It Works` (move to footer/secondary location).
- IA decision: do **not** create standalone Account Settings yet.
  - keep display-name edit inline within `My Predictions`.
- Homepage decision: include top banner for season recap discovery:
  - `2025 Fan Results Are Live` + `View Fan Recap` CTA.
- 2026 scope placeholder decision:
  - include **game-by-game pick flow** (users choose Bears win/loss for each game)
  - include these picks in 2026 prediction tracking/scoring views.

### Resume Here (Next Session Starting Point)
1. Finalize recap email readability/image sizing based on latest test-email feedback.
2. Send one more full test email and confirm mobile + desktop inbox rendering.
3. Once approved, send recap marketing email to the production segment.
4. After send approval, update this project context again to mark Phase 1 complete.
5. Keep 2026 game-by-game scope deferred:
   - Phase 7 (final phase), not scheduled yet

Reference mockup artifacts created in this session:
- `mockups-halas-locked-foundation.html` (final typography/foundation baseline)
- `mockups-halas-home-and-my-predictions.html` (approved IA/layout direction)
- `mockups-halas-desk-v2.html` (rich card spec reference)

## 12. Upcoming Roadmap (Phased)

### Phase 1 (Consolidated Former Phase 1 + Phase 2): View Recap + User Communication
- `View Recap` experience is built and live.
- Admin email composer + test-send workflow are built and live.
- Amazon SES campaign email system is built and live.
- Remaining phase work:
  - final email rendering polish
  - campaign QA
  - production recap send

### Phase 3: Full UX/UI Redesign (Completed)
- Redesign the full site for a cleaner, easier experience:
  - better layout and spacing
  - clearer navigation and status states
  - more polished mobile and desktop behavior
- Goal: make the app feel easier to use and more modern.

### Phase 4: Fan Confidence Sentiment (Completed)
- Add a community confidence sentiment indicator per prediction/question.
- Use average confidence across users to show simple labels:
  - High confidence
  - Medium confidence
  - Low confidence
- Show this sentiment alongside existing prediction percentages.

### Phase 7 (Final): 2026 Product Expansion (Deferred / Not Scheduled Yet)
- Add game-to-game predictions for the full Bears season:
  - each game gets its own prediction prompts
  - users can make and update picks by game before deadlines
  - game picks become part of dashboard + scoring views

### Notes for Implementation
- Keep this in plain language for users (avoid technical jargon in UI copy).
- Keep scoring rules separate from sentiment:
  - sentiment explains fan confidence
  - scoring still follows official points rules unless intentionally changed later

### Planned Reports Feature (Future Scope)
- Add top-level `Reports` page containing long-form report entries (blog-style reading experience).
- Planned recurring reports:
  1. `Season Recap Report` (post-season):
     - analyze fan prediction accuracy for the full season
     - summarize optimism vs pessimism patterns
     - highlight easiest vs hardest questions for users
     - compare expectation vs actual season outcome
  2. `Season Kickoff Report` (preseason/start of season):
     - introduce upcoming season questions (for example, `20+` predictions)
     - explain categories and why each question/storyline matters
  3. `Mid-Season Report` (halfway point):
     - summarize in-progress prediction performance
     - highlight trend shifts and emerging season narratives
- Distribution model:
  - each report is published in the site `Reports` section
  - each report is also emailed to existing users for engagement and progress updates

### Reports TODO (Planning Backlog)
- Define `Reports` route and information architecture placement (top nav vs footer/secondary entry).
- Define report data model and storage (title, slug, publish date, season, summary, body, status).
- Build reports listing page + single report detail page.
- Add admin/editor workflow for drafting, editing, and publishing report posts.
- Connect reports to email workflow so published reports can be adapted for user announcements.
- Sequence dependency:
  - complete consolidated Phase 1 recap + AWS SES email flow first
  - keep Phase 7 as last-phase scope (not scheduled yet)
  - produce season recap report using finalized aggregates

---

## Change Log

### 2026-09-02 (Amazon SES Migration Verified)

- Amazon SES now sends campaigns, lifecycle messages, and Supabase Auth email.
- SES delivery, open, click, bounce, and complaint events flow through SNS to
  the `ses-events` Edge Function and appear in the admin dashboard.
- A live test campaign was verified end to end for delivery, open, and click.
- Production campaign audiences include confirmed email addresses only; pending,
  abandoned, or mistyped unconfirmed signups are excluded.
- Unsubscribe links use the SES `ses:no-track` marker so they are not rewritten
  or counted as engagement. Their GET endpoint is read-only; only the recipient's
  confirmation POST changes the preference, protecting against link scanners.
- Production site deploy `6a9852730febf54bd1a0e97f` published the confirmation
  screen and updated privacy copy on 2026-09-02.
- The old provider implementation is gone. The campaign Edge Function retains
  the historical `send-brevo-email` route name only for production compatibility.
- Current cleanup still requiring a coordinated production change:
  - rename the legacy campaign function route
  - remove unused `BREVO_*` Edge Function secrets
  - replace the old DMARC aggregate-report destination

### 2026-03-07 (Taxonomy + Confidence + Season Model Decisions Locked)
- Locked canonical topic/tag set for ongoing use:
  - `all`, `qb`, `rookies`, `player_stats`, `team_stats`, `awards`, `playoffs`, `draft_predictions`
- Completed 2025 question taxonomy cleanup in production:
  - recategorized questions to new tags
  - removed test question
  - confirmed final 2025 question count is `13`
- Confirmed confidence policy and scoring separation:
  - confidence is sentiment-only (not points)
  - scoring remains simple `1`/`0`
- Added production DB function for question confidence sentiment aggregation:
  - `public.get_question_confidence_sentiment(target_season integer default 2025)`
  - uses `low=1`, `medium=2`, `high=3` and meter percent conversion
- Updated game scoring function behavior in production to simple `1`/`0` (confidence ignored).
- Added repo migration for explicit game season separation:
  - `supabase/migrations/20260307103000_add_season_to_games.sql`
  - adds `games.season`, backfills by NFL season rollover logic, and indexes `season`
- Noted remaining UI task:
  - wire home confidence meter from dummy frontend values to DB aggregation function output.

### 2026-03-06 (Reports Feature Planning Added)
- Added planned `Reports` feature scope for site + email communication workflow.
- Captured three recurring report types:
  - season recap
  - season kickoff
  - mid-season update
- Added explicit writing ownership model:
  - user writes primary content
  - Codex edits/structures/formats
- Added Reports TODO backlog and sequencing note:
  - complete confidence logic + question tag audit before recap report wiring.

### 2026-03-05 (Mobile QA + Interaction Cleanup)
- Completed iterative mobile QA pass and visual cleanup across redesigned routes:
  - removed topic placement toggle (`Under Nav` / `Under Hero`); locked topics under hero
  - improved recap banner responsiveness on mobile (stacked layout + centered headline on small screens)
  - updated recap banner copy to `2025 Predictions Are Live`
  - reduced oversized footer typography on mobile
  - moved season toggle above topics in My Predictions for clearer hierarchy
  - removed non-essential `Updated` timestamp column/row metadata from My Predictions
  - added question avatar/icon treatment to My Predictions mobile rows
- Modal consistency improvements:
  - introduced shared `PredictionEditorModal` component and unified modal experience between Home and My Predictions
  - removed residual check/X icon language in prediction editing flow
- Navigation/layout consistency improvements:
  - moved footer to global app layout so it appears on all routes
  - added route-based scroll reset so top-level navigation lands at page top
- Home paging UX update:
  - added secondary bottom pager control on mobile for card-page navigation visibility
- Cleanup:
  - removed dev-only active preview row from My Predictions after QA
- Process safeguard added after production push incident:
  - branch policy now requires `codex/*` branch workflow and no direct commits/pushes to `main`
  - explicit user confirmation required before push actions
  - naming policy added: easy-to-understand branch/commit names, confirmed with user at session start

### 2026-03-04 (Redesign Phase Lock - UI Only)
- Completed redesign lock pass and removed temporary preview artifact:
  - removed dev-only fake active question from `src/lib/PredictionContext.tsx`
- Home finalized updates:
  - hero copy updated to `2026 Bears season`
  - recap banner CTA text shortened to `View Recap`
  - recap banner made sticky under navbar
  - topics presentation locked to straight-line style (no bubble toggle)
  - added `Rookies` topic tag
  - card paging controls added (left/right arrows + page count) to reduce long scrolling
- Card/modal interaction finalized:
  - `Details` button removed from home cards
  - removed inline card footer details (`Your call`, `Fan confidence`) from card body
  - unified single primary card action (`Make Prediction` / `View / Edit Prediction` / `View Details`)
  - modal is click-away close (no explicit `X` close icon)
  - compact modal sizing/spacing/typography aligned with card design language
  - removed check/X icon language from answer selections and submit arrow icon
  - added visual-only fan confidence meter preview on cards (dummy data, no backend wiring)
- Navbar finalized updates:
  - removed `How It Works` from primary nav
  - removed redundant `Home` nav button (brand remains home link)
  - simplified icon usage to text-first nav language
  - improved desktop/mobile nav consistency and active states
- My Predictions redesign finalized:
  - shifted to eBay-style left-rail + main-content layout
  - topic filters + status filters (`all`, `active`, `pending`, `resolved`)
  - season switch (`2026` default, `2025` alternate)
  - rows-only presentation (cards view removed)
  - added top metrics (`Total Picks`, `Accuracy`)
  - added username inline edit module backed by `public.users.display_name` (with helper text)
  - added resolved outcome pills (`Correct` / `Incorrect`) in rows
- Leaderboard redesign finalized:
  - restyled leaderboard to match My Predictions visual language
  - removed always-visible tie-rank explainer from subtitle
  - replaced with hover helper: `How we rank`

### 2026-03-03 (Home Mockup Saved + Commit)
- Completed and committed current redesign mockup state on local `main`:
  - commit: `e4ef49b` (`ui: save home and dashboard redesign mockup state`)
- Home updates in current mockup:
  - restored original hero styling/copy with animated underlines
  - moved recap callout to yellow flash banner under navbar
  - updated flash text to `2025 Season Prediction Results Are In`
  - added topic tags for `QB`, `Pro Bowlers`, `Playoffs`, and renamed `Draft Picks` to `Draft`
  - added live comparison toggles for topic filter presentation:
    - `Topics` vs `Bubbles`
    - `Under Nav` vs `Under Hero`
- Prediction cards received a stronger visual refresh (featured treatment, hierarchy, quick-pick entry points) while keeping behavior stable.

### 2026-03-02 (Priority Order Updated)
- Replaced `Now/Next/Later` with explicit ordered priorities:
  - `1) visual refresh + mobile quality`
  - `2) user email list + send`
  - `3) build out 2026 questions`
- Marked admin date picker issue as deferred for now.
- Confirmed question management approach:
  - Codex/terminal-first for question creation and deadline updates.

### 2026-03-02 (Priority Clarification)
- Clarified that "visual refresh" is the same as **Phase 3 Full UX/UI Redesign**.
- Set full UX/UI redesign as the immediate next build focus.

### 2026-03-24 (Historical Brevo Integration — Superseded 2026-08-12)

> Historical record only. Amazon SES replaced this provider for campaign,
> lifecycle, and Supabase Auth email. The details below describe the original
> implementation and are not current operating instructions.
- Built and deployed a first-pass Brevo email integration through a Supabase Edge Function.
- Purpose:
  - stop relying on Brevo's visual campaign editor for recap/reminder emails
  - keep email templates in code
  - pull recipients directly from the app database
  - create a reusable path for future deadline reminders, midseason emails, and season recap sends
- Current implementation files:
  - `supabase/functions/send-brevo-email/index.ts`
  - `supabase/functions/_shared/seasonRecapEmail.ts`
  - `supabase/functions/README.md`
  - `supabase/queries/season_2025_recap_recipients.sql`
- Current branch for this work:
  - `codex/brevo-email-integration`
- What is already proven:
  - Supabase CLI installed locally
  - function deployed successfully to production Supabase project
  - Brevo API key configured in Supabase Edge Function secrets
  - sender secrets configured:
    - `BREVO_SENDER_EMAIL=noreply@bearsprediction.com`
    - `BREVO_SENDER_NAME=Bears Prediction Tracker`
  - test send to `irfanbhanji1@gmail.com` succeeded
  - HTML email rendered successfully in Gmail
  - unsubscribe system is now also working end-to-end:
    - `email_preferences` table created in production
    - `unsubscribe-email` function deployed
    - unsubscribe link in email updates Supabase correctly
    - verified `marketing_subscribed = false` and populated `unsubscribed_at` for test account
- Important operational note:
  - Brevo IP security blocked initial API requests because Supabase Edge Functions used previously unrecognized outbound IPv6 addresses.
  - To get the test send working, unknown IP blocking in Brevo had to be relaxed/disabled.
  - This must be revisited later for a cleaner long-term security setup.
- Current send model:
  - transactional/API-based send through Brevo
  - not a Brevo drag-and-drop marketing campaign workflow
  - recipient segment can be resolved directly from `2025` prediction participants in the database
- Current limitations:
  - no reply-to handling configured yet
  - image hosting strategy still needs to be finalized
- Plain-English workflow right now:
  - update the email template in code
  - open the admin email console on the site
  - send a test email from the browser
  - review in inbox
  - send to full audience when ready
- TODO for this email system:
  - decide final image strategy for recap emails
  - add real recap graphics/images to the coded template
  - add `reply-to` support once desired inbox is confirmed
  - create reusable templates for:
    - season recap
    - deadline reminder
    - new question live
    - midseason update
  - next immediate content pass:
    - refine the 2025 recap email writing
    - add/finalize recap images inside the coded template

### 2026-03-26 (Admin Email Console + Unsubscribe Flow Simplified)
- Completed the first production admin email console on the site.
- Frontend additions:
  - added `/admin/email` route for admin-only email operations
  - added audience counts for:
    - subscribed users
    - subscribed users with at least one prediction
    - unsubscribed users
    - current production segment count
  - added browser-based test send flow
  - added browser-based production send flow with confirmation modal
  - added recent send history list
- Backend additions:
  - added `public.email_send_logs` table
  - added `public.current_user_is_admin()`
  - added `public.get_admin_email_audience_counts()`
  - hardened `send-brevo-email` to require admin auth and write send logs
- Important troubleshooting learned today:
  - test send failures from the admin page were not auth/UI bugs once logged in
  - failed test sends correctly occurred when the target address had already unsubscribed
  - `marketing_subscribed = false` blocks future marketing test sends as intended
- Unsubscribe flow was simplified to a more reliable architecture:
  - `unsubscribe-email` still handles token verification + DB update
  - instead of trying to render HTML directly from the Supabase function, it now redirects to the main site
  - new public site route: `/email/unsubscribed`
  - the site route shows a generic success/error confirmation page
- Why the architecture changed:
  - Supabase Edge Function responses were being displayed as raw text in the browser even though the unsubscribe logic itself worked
  - redirecting back to the main site proved to be the simpler, more durable solution
- Verified current working state:
  - admin email console is live on production site
  - browser-based test send works
  - unsubscribe updates `email_preferences` correctly
  - unsubscribe confirmation now lands on the site instead of raw Supabase HTML
- Copy cleanup completed:
  - updated unsubscribe success text from the confusing resubscribe note to:
    - `You are all set. Your email preferences have been updated.`
- Next focused step for the email system:
  - modify the 2025 season recap email copy
  - add/finalize recap images in the coded email template before wider send

### 2026-03-02 (Design Decisions + Resume Point Captured)
- Logged locked UX/UI decisions from redesign working session (Halas Desk, terminology, nav, interaction model).
- Added explicit "Resume Here" checklist for next chat continuation.
- Added references to approved mockup files for implementation handoff.

### 2026-02-25 (Roadmap Added)
- Added phased upcoming roadmap:
  - user email announcement for 2025 closeout + leaderboard live
  - 2026 full-season game-to-game predictions
  - full site redesign
  - confidence sentiment feature (high/medium/low) based on community confidence averages

### 2026-02-25 (Follow-up QA)
- Verified end-to-end auth for new account `irfan1+22@gmail.com`:
  - registration succeeded
  - confirmation email received
  - verified and logged in
- Verified authenticated routes load:
  - dashboard works
  - leaderboard works
- Confirmed current product-state behavior:
  - no prediction submissions possible until 2026 questions are created
  - dashboard CTA sends users back to main predictions screen, which currently has no active/new questions
- Logged new admin QA issue:
  - deadline date picker month navigation stuck on February 2026 when creating a question
- Verified admin access and prediction workflow after role fix:
  - admin account now recognized via role-based access
  - admin created a live question successfully
  - user successfully submitted prediction
  - prediction appears in dashboard and can be edited/updated while question is live

### 2026-02-25
- Added UI inconsistency backlog notes from local screenshots:
  - duplicate close icons in auth success modal
  - modal layering overlap with auth footer strip
  - desktop navbar misalignment/wrapping with long email

### 2026-02-22
- Created initial project context document with current app understanding.
- Added Git/GitHub setup status and remaining steps.
- Added product origin story, domain/hosting/email provider details, and primary scoring goal.
- Updated GitHub setup status to reflect successful SSH auth, remote setup, and local/remote parity check.
- Added confirmed Supabase authentication and Brevo SMTP configuration from dashboard screenshots.
- Added official scoring policy: 1 point per correct, confidence excluded from scoring, resolved-only accuracy.
- Added implementation artifacts for simple scoring:
  - Supabase migration: `supabase/migrations/20260222043000_simple_season_scoring.sql`
  - Dashboard metrics updated for 2025 resolved/pending/accuracy in `src/components/Dashboard.tsx`

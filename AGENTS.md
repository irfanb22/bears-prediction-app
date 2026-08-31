# Bears Prediction Project Memory

## 2026 season questions and release state

- The approved 2026 set contains 25 regular-season questions. The review copy remains in `src/data/season2026QuestionReview.ts`; the production database insert and manual-scoring notes are in `supabase/migrations/20260826120000_add_2026_regular_season_questions.sql`.
- That migration has already been applied directly to the linked production database. On August 31, 2026 the owner approved opening the set: all 25 questions are now `live` and pickable until the September 13 deadline.
- The 2026 draft question (`f6a8dc28-c6d7-4ba2-9492-437292ec0d2f`) was resolved on August 31, 2026. The Bears took Oregon safety Dillon Thieneman at No. 25, so `correct_answer` is `Secondary` and the question is `completed`. Its 32 predictions were scored 1 for correct and 0 otherwise, matching the 2025 set. `user_scores` is a view, so the leaderboard recomputed on its own; `actual_results` is unused and stayed empty.
- Production card-visual mappings live in `src/lib/PredictionContext.tsx`. Do not remove them or replace the production questions with the local review flag.
- Enable the draft locally or in a deploy preview with `VITE_2026_QUESTION_REVIEW=true`.
- When enabled, the app replaces fetched 2026 questions with the local review set while leaving other seasons intact. The home banner identifies the experience as draft review data.
- Keep prediction-card prompts concise and conversational. Scoring qualifications belong in supporting details only when they are truly necessary for fair grading.
- Do not silently change approved thresholds, choices, or wording. Key decisions include: Caleb at least 63% completions and all 17 starts; Kyler Gordon has 8+ official regular-season appearances; top-7 total offense, top-15 total defense, top-5 rushing, and 11+ wins; award questions count either Pro Bowl or first-/second-team All-Pro Team; and the three questions without a `Someone else` choice are intentional.
- All season questions use regular-season statistics. Tied leaders count for every tied player/rookie, and `Someone else` means the rest of the field—not a written-in answer. The owner will manually provide correct outcomes after the season; do not add stat fetching, automatic scoring, or single-answer tie workarounds.
- Revised on August 31, 2026 after the August 30 roster cutdown: Kyler Gordon opened on reserve/PUP and is out at least the first four games, so his threshold moved from 10+ to 8+ games; Kiran Amegadjie was waived and Jedrick Wills Jr. was released, so the left tackle choices are now Braxton Jones, Ozzy Trapilo, and Theo Benedet only. Applied to production in migration `20260831140000_update_2026_gordon_and_left_tackle_questions.sql`.
- The pick deadline is Sunday, September 13, 2026 at 12:00 PM Central. Existing application and database deadline guards prevent late picks.
- The Rome Odunze yes/no wording used in the visual context mockup is placeholder copy only. The review set's actual receiving question is the multiple-choice prompt `Who leads the Bears in receiving yards?`.

## Question status display

- Current database values remain `pending`, `live`, and `completed`. Do not change the schema or bulk-update question statuses without explicit approval.
- `src/components/PredictionInterface.tsx` derives user-facing status without modifying the database:
  - `pending` → **Coming Soon** with `CalendarClock`
  - `live` before the deadline → **Live** with `CircleDot`
  - `live` after the deadline → **Locked** with `Lock` and “Results pending”
  - `completed` → **Final** with `CheckCircle`
- This corrects expired live questions that previously still displayed as Live. It does not introduce any automatic result or scoring behavior.

## Player image system

- Approved production direction: player and coach portraits over a green turf background with a visible white yard line.
- Reserved future dark-mode direction: night-stadium background with blurred stadium lights and a small turf area.
- The other explored treatments—stadium silhouette, broadcast gradient, playbook pattern, and the earlier trading-card studies—are reference history, not approved production directions.
- Do not put a name, position, statistic, label, or other text inside a portrait asset. The prediction prompt supplies that context.
- Do not add an internal trading-card border. The prediction card already has a white surface, border, rounded image frame, and shadow.
- Preserve the original person's recognizable face and foreground. Production assets should use deterministic cutouts/compositing rather than generative alterations to facial details.
- Frame portraits as close head-and-shoulders crops. The current production image container is 64x64 CSS pixels on mobile and 72x72 on `sm` and larger screens; verify new assets at 64x64.
- Avoid assigning one player's portrait to a multiple-choice leader question when that portrait could bias the answer.

## Design-review assets

- Background studies and the live comparison page are in `public/design-concepts/2026-background-studies/`.
- Open `/design-concepts/2026-background-studies/card-context-preview.html` while the app is running to compare all five treatments inside prediction-card mockups.
- The `turf-yard-line-*` files are the approved visual references. Preserve the `night-stadium-*` files for a possible dark mode.
- Earlier experiments remain in `public/design-concepts/2026-trading-cards/` as design history; do not treat them as current direction.

## Release safety

- The 2026 questions, their portraits, and the status-icon treatment are already deployed to `https://bearsprediction.com` after explicit approval. The latest production deploy is Netlify deploy `6a95e7c6d39d8684be1e2068` (August 31, 2026 question revisions plus the Game Picks crash fix); the prior status-icon deploy was `6a8f622c48fd9aeb4e22daab`.
- `20260826123000_allow_public_game_pick_schedule.sql` was committed on August 26 but never applied to production, so logged-out visitors read zero rows from `game_pick_games` and Game Picks crashed. It was applied on August 31, 2026. Check `list_migrations` against `supabase/migrations/` before assuming a committed migration is live.
- Do not deploy further 2026 changes or write new production database changes without explicit approval. Preview deployments remain acceptable when requested.
- Preview deployments are acceptable when requested. Keep `VITE_2026_QUESTION_REVIEW` opt-in so the normal site remains unchanged by default.

## Working-tree note

- `.claude/` is an unrelated untracked local directory. Do not add it to commits unless the owner specifically asks.

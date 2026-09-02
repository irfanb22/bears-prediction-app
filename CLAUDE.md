# Bears Prediction Project Memory

## 2026 season question review

- The current 2026 question set is a review draft stored in `src/data/season2026QuestionReview.ts`.
- Enable the draft locally or in a deploy preview with `VITE_2026_QUESTION_REVIEW=true`.
- When enabled, the app replaces fetched 2026 questions with the local review set while leaving other seasons intact. The home banner identifies the experience as draft review data.
- Keep prediction-card prompts concise and conversational. Scoring qualifications belong in supporting details only when they are truly necessary for fair grading.
- Do not silently change the approved thresholds or wording. Important current decisions include: Caleb at least 63% completions; all 17 games; Kyler Gordon 8+ games; top-7 total offense; top-15 total defense; top-5 rushing; 11+ wins; initial Pro Bowl selections for scoring; Jaylon Johnson earns All-Pro honors.
- The Rome Odunze yes/no wording used in the visual context mockup is placeholder copy only. The review set's actual receiving question is the multiple-choice prompt `Who leads the Bears in receiving yards?`.

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

- The 2026 questions and portrait system are live in production. The latest production deploy is Netlify deploy `6a9852730febf54bd1a0e97f` (September 2, 2026 confirmed-only campaign audience plus scanner-safe unsubscribe confirmation).
- Production marketing campaigns include confirmed email addresses only. Unsubscribe links are excluded from SES click tracking and require a confirmation POST before preferences change.
- Do not deploy further 2026 changes or write new production database changes without explicit approval.
- Preview deployments are acceptable when requested. Keep `VITE_2026_QUESTION_REVIEW` opt-in so the normal site remains unchanged by default.

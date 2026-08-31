/*
  # Resolve the 2026 draft question and open the regular-season set

  - The Bears took Oregon safety Dillon Thieneman at No. 25, so the draft
    question's correct answer is `Secondary`.
  - Scores its 32 predictions the same way the 2025 set is scored: 1 point for
    a correct pick, 0 otherwise. Confidence does not affect points.
  - Flips the 25 approved regular-season questions from `pending` to `live` so
    they can be picked before the September 13 deadline.
  - `user_scores` is a view over `predictions.points_earned`, so the leaderboard
    needs no separate update.
*/

UPDATE public.questions
SET correct_answer = 'Secondary',
    status = 'completed'
WHERE id = 'f6a8dc28-c6d7-4ba2-9492-437292ec0d2f';

UPDATE public.predictions
SET points_earned = CASE
      WHEN lower(btrim(prediction)) = 'secondary' THEN 1
      ELSE 0
    END
WHERE question_id = 'f6a8dc28-c6d7-4ba2-9492-437292ec0d2f';

UPDATE public.questions
SET status = 'live'
WHERE season = 2026
  AND status = 'pending';

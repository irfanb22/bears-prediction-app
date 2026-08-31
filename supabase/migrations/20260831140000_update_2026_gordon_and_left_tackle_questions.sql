/*
  # Update two 2026 regular-season questions after the Aug 30 roster cutdown

  - Kyler Gordon opened on reserve/PUP and is out for at least the first four
    games, so the appearance threshold drops from 10+ to 8+.
  - Kiran Amegadjie was waived and Jedrick Wills Jr. was released, so both are
    removed from the left tackle choices. Braxton Jones, Ozzy Trapilo, and Theo
    Benedet remain.
  - Does not change question status, deadlines, correct answers, or scoring.
*/

UPDATE public.questions
SET text = 'Kyler Gordon plays 8+ games?'
WHERE id = 'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f008';

DELETE FROM public.choices
WHERE question_id = 'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009'
  AND text IN ('Kiran Amegadjie', 'Jedrick Wills Jr.');

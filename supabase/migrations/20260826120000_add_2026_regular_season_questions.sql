/*
  # Add the 2026 regular-season prediction questions

  - Seeds the approved 25-question regular-season set as `pending`.
  - Keeps the separately managed 2026 draft question untouched.
  - Stores the visible grading notes required for manual end-of-season scoring.
  - Does not set correct answers, create results, or score predictions.
*/

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS review_detail text;

INSERT INTO public.questions (
  id,
  text,
  category,
  season,
  question_type,
  deadline,
  featured,
  status,
  review_detail
)
VALUES
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f001', 'Caleb Williams throws for 4,000+ yards?', 'qb', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', true, 'pending', 'Uses official NFL regular-season passing yards.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f002', 'Caleb Williams completes at least 63% of his passes?', 'qb', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season completion percentage.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f003', 'Caleb Williams throws 30+ touchdowns?', 'qb', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season passing touchdowns.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f004', 'Caleb Williams starts all 17 games?', 'qb', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Official NFL regular-season starts count; a game still counts if he leaves early.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f005', 'Who leads the Bears in receiving yards?', 'player_stats', 2026, 'multiple_choice', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season receiving yards. Tied leaders count as correct.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006', 'Which offensive player scores the most touchdowns?', 'player_stats', 2026, 'multiple_choice', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season rushing and receiving touchdowns only; passing touchdowns do not count. Tied leaders count as correct. “Someone else” covers any Bears offensive player not listed.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f007', 'Who leads the Bears in sacks?', 'player_stats', 2026, 'multiple_choice', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season sacks. Tied leaders count as correct. “Someone else” covers any Bears player not listed.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f008', 'Kyler Gordon plays 10+ games?', 'player_stats', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Counts when he records an official NFL regular-season game appearance, not merely when he is active.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009', 'Which Bears left tackle starts the most regular-season games?', 'player_stats', 2026, 'multiple_choice', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season starts at left tackle. Tied leaders count as correct.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f010', 'D’Andre Swift rushes for 1,000+ yards?', 'player_stats', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season rushing yards.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f011', 'Colston Loveland reaches 1,000 receiving yards?', 'player_stats', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season receiving yards.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f012', 'Bears finish top 7 in total offense?', 'team_stats', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season total-offense yardage rankings.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f013', 'Bears finish top 15 in total defense?', 'team_stats', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season total-defense yardage rankings.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f014', 'Bears win 11+ games?', 'team_stats', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season wins.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f015', 'Bears win the NFC North?', 'team_stats', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', true, 'pending', 'Uses the official NFL regular-season division standings.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f016', 'Bears finish top 5 in rushing?', 'team_stats', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season rushing-yardage rankings.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f017', 'Caleb Williams makes the Pro Bowl or an All-Pro team?', 'awards', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f018', 'Joe Thuney makes the Pro Bowl or an All-Pro team?', 'awards', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f019', 'Darnell Wright makes the Pro Bowl or an All-Pro team?', 'awards', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f020', 'Ben Johnson wins Coach of the Year?', 'awards', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses the official NFL Coach of the Year award result.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f021', 'Jaylon Johnson makes the Pro Bowl or an All-Pro team?', 'awards', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f022', 'Colston Loveland makes the Pro Bowl or an All-Pro team?', 'awards', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f023', 'Bears make the playoffs?', 'playoffs', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL playoff qualification.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f024', 'Bears win a playoff game?', 'playoffs', 2026, 'yes_no', '2026-09-13T12:00:00-05:00', false, 'pending', 'Counts any official NFL postseason win.'),
  ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f025', 'Which Bears rookie plays the most snaps on offense or defense?', 'rookies', 2026, 'multiple_choice', '2026-09-13T12:00:00-05:00', false, 'pending', 'Uses official NFL regular-season offensive and defensive snap totals. Tied leaders count as correct; “Someone else” covers any rookie not listed.')
ON CONFLICT (id) DO UPDATE
SET
  text = EXCLUDED.text,
  category = EXCLUDED.category,
  season = EXCLUDED.season,
  question_type = EXCLUDED.question_type,
  deadline = EXCLUDED.deadline,
  featured = EXCLUDED.featured,
  status = EXCLUDED.status,
  review_detail = EXCLUDED.review_detail;

INSERT INTO public.choices (question_id, text)
SELECT seeded.question_id, seeded.text
FROM (
  VALUES
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f005'::uuid, 'Luther Burden III'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f005'::uuid, 'Colston Loveland'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f005'::uuid, 'Rome Odunze'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006'::uuid, 'D’Andre Swift'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006'::uuid, 'Colston Loveland'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006'::uuid, 'Rome Odunze'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006'::uuid, 'Luther Burden III'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006'::uuid, 'Kyle Monangai'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006'::uuid, 'Someone else'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f007'::uuid, 'Montez Sweat'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f007'::uuid, 'Austin Booker'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f007'::uuid, 'Dayo Odeyingbo'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f007'::uuid, 'Someone else'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009'::uuid, 'Braxton Jones'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009'::uuid, 'Ozzy Trapilo'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009'::uuid, 'Theo Benedet'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009'::uuid, 'Kiran Amegadjie'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009'::uuid, 'Jedrick Wills Jr.'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f025'::uuid, 'Dillon Thieneman'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f025'::uuid, 'Logan Jones'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f025'::uuid, 'Zavion Thomas'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f025'::uuid, 'Malik Muhammad'),
    ('bc0f2a3e-1df6-4f11-83c2-71f9f9c8f025'::uuid, 'Someone else')
) AS seeded(question_id, text)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.choices existing
  WHERE existing.question_id = seeded.question_id
    AND existing.text = seeded.text
);

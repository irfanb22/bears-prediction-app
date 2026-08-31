import type { Question } from '../lib/PredictionContext';

const REVIEW_DEADLINE = '2026-09-13T12:00:00-05:00';

function yesNoQuestion(
  id: string,
  text: string,
  category: string,
  featured = false,
  reviewDetail?: string
): Question {
  return {
    id: `preview-2026-${id}`,
    text,
    category,
    season: 2026,
    status: 'pending',
    deadline: REVIEW_DEADLINE,
    featured,
    question_type: 'yes_no',
    review_detail: reviewDetail,
  };
}

function multipleChoiceQuestion(
  id: string,
  text: string,
  category: string,
  choices: string[],
  reviewDetail?: string
): Question {
  return {
    id: `preview-2026-${id}`,
    text,
    category,
    season: 2026,
    status: 'pending',
    deadline: REVIEW_DEADLINE,
    featured: false,
    question_type: 'multiple_choice',
    review_detail: reviewDetail,
    choices: choices.map((choice, index) => ({
      id: `preview-2026-${id}-choice-${index + 1}`,
      text: choice,
      prediction_count: 0,
    })),
  };
}

export const season2026QuestionReview: Question[] = [
  yesNoQuestion('caleb-4000-yards', 'Caleb Williams throws for 4,000+ yards?', 'qb', true),
  yesNoQuestion('caleb-completion-rate', 'Caleb Williams completes at least 63% of his passes?', 'qb'),
  yesNoQuestion('caleb-30-touchdowns', 'Caleb Williams throws 30+ touchdowns?', 'qb'),
  yesNoQuestion(
    'caleb-17-starts',
    'Caleb Williams starts all 17 games?',
    'qb',
    false,
    'Official NFL starts count; a game still counts if he leaves early.'
  ),

  multipleChoiceQuestion(
    'receiving-yards-leader',
    'Who leads the Bears in receiving yards?',
    'player_stats',
    ['Luther Burden III', 'Colston Loveland', 'Rome Odunze'],
    'Tied leaders count as correct.'
  ),
  multipleChoiceQuestion(
    'touchdown-leader',
    'Which offensive player scores the most touchdowns?',
    'player_stats',
    ['D\u2019Andre Swift', 'Colston Loveland', 'Rome Odunze', 'Luther Burden III', 'Kyle Monangai', 'Someone else'],
    'Uses regular-season rushing and receiving touchdowns only; passing touchdowns do not count. Tied leaders count as correct. “Someone else” covers any Bears offensive player not listed.'
  ),
  multipleChoiceQuestion(
    'sack-leader',
    'Who leads the Bears in sacks?',
    'player_stats',
    ['Montez Sweat', 'Austin Booker', 'Dayo Odeyingbo', 'Someone else'],
    'Tied leaders count as correct. “Someone else” covers any Bears player not listed.'
  ),
  yesNoQuestion(
    'kyler-gordon-games',
    'Kyler Gordon plays 8+ games?',
    'player_stats',
    false,
    'Counts when he records an official NFL game appearance, not merely when he is active.'
  ),
  multipleChoiceQuestion(
    'left-tackle-starts-leader',
    'Which Bears left tackle starts the most regular-season games?',
    'player_stats',
    ['Braxton Jones', 'Ozzy Trapilo', 'Theo Benedet'],
    'Uses official regular-season starts at left tackle. Tied leaders count as correct.'
  ),
  yesNoQuestion('swift-1000-yards', 'D\u2019Andre Swift rushes for 1,000+ yards?', 'player_stats'),
  yesNoQuestion('loveland-1000-yards', 'Colston Loveland reaches 1,000 receiving yards?', 'player_stats'),

  yesNoQuestion('top-seven-offense', 'Bears finish top 7 in total offense?', 'team_stats'),
  yesNoQuestion('top-15-defense', 'Bears finish top 15 in total defense?', 'team_stats'),
  yesNoQuestion('11-wins', 'Bears win 11+ games?', 'team_stats'),
  yesNoQuestion('nfc-north', 'Bears win the NFC North?', 'team_stats', true),
  yesNoQuestion('top-five-rushing', 'Bears finish top 5 in rushing?', 'team_stats'),

  yesNoQuestion(
    'caleb-pro-bowl-or-all-pro',
    'Caleb Williams makes the Pro Bowl or an All-Pro team?',
    'awards',
    false,
    'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'
  ),
  yesNoQuestion(
    'thuney-pro-bowl-or-all-pro',
    'Joe Thuney makes the Pro Bowl or an All-Pro team?',
    'awards',
    false,
    'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'
  ),
  yesNoQuestion(
    'wright-pro-bowl-or-all-pro',
    'Darnell Wright makes the Pro Bowl or an All-Pro team?',
    'awards',
    false,
    'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'
  ),
  yesNoQuestion('ben-johnson-coach-of-year', 'Ben Johnson wins Coach of the Year?', 'awards'),
  yesNoQuestion(
    'jaylon-johnson-pro-bowl-or-all-pro',
    'Jaylon Johnson makes the Pro Bowl or an All-Pro team?',
    'awards',
    false,
    'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'
  ),
  yesNoQuestion(
    'loveland-pro-bowl-or-all-pro',
    'Colston Loveland makes the Pro Bowl or an All-Pro team?',
    'awards',
    false,
    'Counts if named to the initial Pro Bowl roster or a First-Team or Second-Team All-Pro selection.'
  ),

  yesNoQuestion('make-playoffs', 'Bears make the playoffs?', 'playoffs'),
  yesNoQuestion('win-playoff-game', 'Bears win a playoff game?', 'playoffs'),

  multipleChoiceQuestion(
    'rookie-snaps-leader',
    'Which Bears rookie plays the most snaps on offense or defense?',
    'rookies',
    ['Dillon Thieneman', 'Logan Jones', 'Zavion Thomas', 'Malik Muhammad', 'Someone else'],
    'Uses official NFL regular-season offensive and defensive snap totals. Tied leaders count as correct; “Someone else” covers any rookie not listed.'
  ),
];

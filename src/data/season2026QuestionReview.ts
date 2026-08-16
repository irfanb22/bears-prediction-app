import type { Question } from '../lib/PredictionContext';

const REVIEW_DEADLINE = '2026-09-13T12:00:00-05:00';

function yesNoQuestion(
  id: string,
  text: string,
  category: string,
  featured = false
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
  };
}

function multipleChoiceQuestion(
  id: string,
  text: string,
  category: string,
  choices: string[]
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
  yesNoQuestion('caleb-17-starts', 'Caleb Williams starts all 17 games?', 'qb'),

  multipleChoiceQuestion(
    'receiving-yards-leader',
    'Who leads the Bears in receiving yards?',
    'player_stats',
    ['Luther Burden III', 'Colston Loveland', 'Rome Odunze', 'Other']
  ),
  multipleChoiceQuestion(
    'sack-leader',
    'Who leads the Bears in sacks?',
    'player_stats',
    ['Montez Sweat', 'Austin Booker', 'Dayo Odeyingbo', 'Other']
  ),
  yesNoQuestion('kyler-gordon-games', 'Kyler Gordon plays 10+ games?', 'player_stats'),
  yesNoQuestion('swift-1000-yards', 'D\u2019Andre Swift rushes for 1,000+ yards?', 'player_stats'),
  yesNoQuestion('loveland-1000-yards', 'Colston Loveland reaches 1,000 receiving yards?', 'player_stats'),

  yesNoQuestion('top-seven-offense', 'Bears finish top 7 in total offense?', 'team_stats'),
  yesNoQuestion('top-15-defense', 'Bears finish top 15 in total defense?', 'team_stats'),
  yesNoQuestion('11-wins', 'Bears win 11+ games?', 'team_stats'),
  yesNoQuestion('nfc-north', 'Bears win the NFC North?', 'team_stats', true),
  yesNoQuestion('top-five-rushing', 'Bears finish top 5 in rushing?', 'team_stats'),

  yesNoQuestion('caleb-pro-bowl', 'Caleb Williams makes the Pro Bowl?', 'awards'),
  yesNoQuestion('thuney-pro-bowl', 'Joe Thuney makes the Pro Bowl?', 'awards'),
  yesNoQuestion('wright-pro-bowl', 'Darnell Wright makes the Pro Bowl?', 'awards'),
  yesNoQuestion('ben-johnson-coach-of-year', 'Ben Johnson wins Coach of the Year?', 'awards'),
  yesNoQuestion('jaylon-johnson-all-pro', 'Jaylon Johnson earns All-Pro honors?', 'awards'),

  yesNoQuestion('make-playoffs', 'Bears make the playoffs?', 'playoffs'),
  yesNoQuestion('win-playoff-game', 'Bears win a playoff game?', 'playoffs'),

  multipleChoiceQuestion(
    'rookie-snaps-leader',
    'Which Bears rookie plays the most snaps on offense or defense?',
    'rookies',
    ['Dillon Thieneman', 'Logan Jones', 'Zavion Thomas', 'Malik Muhammad', 'Other']
  ),
];

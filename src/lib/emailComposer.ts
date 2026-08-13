export type EmailImageWidth = 'full' | 'wide' | 'medium' | 'compact';
export type EmailButtonTone = 'primary' | 'secondary';
export type EmailSpacerSize = 's' | 'm' | 'l';

export interface EmailHeadingBlock {
  id: string;
  type: 'heading';
  text: string;
}

export interface EmailParagraphBlock {
  id: string;
  type: 'paragraph';
  text: string;
}

export interface EmailImageBlock {
  id: string;
  type: 'image';
  src: string;
  alt: string;
  width: EmailImageWidth;
  caption?: string;
  href?: string;
  framed?: boolean;
}

export interface EmailButtonBlock {
  id: string;
  type: 'button';
  label: string;
  href: string;
  tone: EmailButtonTone;
}

export interface EmailSpacerBlock {
  id: string;
  type: 'spacer';
  size: EmailSpacerSize;
}

export interface EmailSignatureBlock {
  id: string;
  type: 'signature';
  text: string;
}

export type EmailBlock =
  | EmailHeadingBlock
  | EmailParagraphBlock
  | EmailImageBlock
  | EmailButtonBlock
  | EmailSpacerBlock
  | EmailSignatureBlock;

export interface EmailComposerDraft {
  subject: string;
  previewText: string;
  headerEyebrow: string;
  headerTitle: string;
  headerMeta: string;
  footerLinkLabel: string;
  footerLinkHref: string;
  blocks: EmailBlock[];
}

export interface EmailTemplateDefinition {
  id: string;
  label: string;
  description: string;
  createDraft: () => EmailComposerDraft;
}

const EMAIL_ATTRIBUTION_QUERY =
  'utm_source=email&utm_medium=email&utm_campaign=2025_recap_apr1';

function withQuery(url: string, query: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${query}`;
}

export const EMAIL_LINKS = {
  dashboard: withQuery('https://bearsprediction.com/dashboard', EMAIL_ATTRIBUTION_QUERY),
  recap: withQuery('https://bearsprediction.com/season-recap', EMAIL_ATTRIBUTION_QUERY),
  leaderboard: withQuery('https://bearsprediction.com/leaderboard', EMAIL_ATTRIBUTION_QUERY),
  draftQuestion: withQuery(
    'https://bearsprediction.com/?season=2026&category=draft_predictions&question=f6a8dc28-c6d7-4ba2-9492-437292ec0d2f',
    EMAIL_ATTRIBUTION_QUERY
  ),
} as const;

export const EMAIL_CTA_LINKS = {
  dashboard: withQuery(
    'https://bearsprediction.com/?auth=login&redirect=%2Fdashboard',
    EMAIL_ATTRIBUTION_QUERY
  ),
  leaderboard: withQuery(
    'https://bearsprediction.com/?auth=login&redirect=%2Fleaderboard',
    EMAIL_ATTRIBUTION_QUERY
  ),
  draftQuestion: withQuery(
    'https://bearsprediction.com/?auth=login&redirect=%2F%3Fseason%3D2026%26category%3Ddraft_predictions%26question%3Df6a8dc28-c6d7-4ba2-9492-437292ec0d2f',
    EMAIL_ATTRIBUTION_QUERY
  ),
} as const;

export const EMAIL_CARD_LINKS = {
  draftQuestion: EMAIL_CTA_LINKS.draftQuestion,
} as const;

const EMAIL_ASSET_VERSION = '2026-03-30-7';

export const EMAIL_IMAGE_URLS = {
  hero: 'https://bearsprediction.com/email/recap-2025/hero.jpg',
  communityAccuracy: `https://bearsprediction.com/email/recap-2025/community-accuracy.png?v=${EMAIL_ASSET_VERSION}`,
  calebRecord: `https://bearsprediction.com/email/recap-2025/caleb-record.png?v=${EMAIL_ASSET_VERSION}`,
  playoff: `https://bearsprediction.com/email/recap-2025/playoff-split.png?v=${EMAIL_ASSET_VERSION}`,
  romeOdunze: `https://bearsprediction.com/email/recap-2025/rome-odunze.png?v=${EMAIL_ASSET_VERSION}`,
  offenseSurprise: `https://bearsprediction.com/email/recap-2025/offense-surprise.png?v=${EMAIL_ASSET_VERSION}`,
  draft: `https://bearsprediction.com/email/recap-2025/draft-pick.png?v=${EMAIL_ASSET_VERSION}`,
  draftLive: `https://bearsprediction.com/email/recap-2025/draft-question-live.png?v=${EMAIL_ASSET_VERSION}`,
} as const;

let emailBlockCounter = 0;

export function createBlockId(prefix: string) {
  emailBlockCounter += 1;
  return `${prefix}-${emailBlockCounter}`;
}

export function createDraftReminderDraft(): EmailComposerDraft {
  return {
    subject: 'The Bears are on the clock tomorrow',
    previewText:
      'The NFL Draft is tomorrow. Make your prediction or change it before Thursday, April 23 at 5:00 p.m. Central Time.',
    headerEyebrow: '',
    headerTitle: '',
    headerMeta: '',
    footerLinkLabel: '',
    footerLinkHref: '',
    blocks: [
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Hi,',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'The NFL Draft is tomorrow. The Bears are on the clock with the 25th pick, and they’ll be picking around 9:30 p.m.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'A quick reminder that the Bears draft question closes on **Thursday, April 23 at 5:00 p.m. Central Time**, so you still have time to make your prediction or change it before the deadline.',
      },
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.draftLive,
        alt: 'Live 2026 draft question card with answer options',
        href: EMAIL_CARD_LINKS.draftQuestion,
        width: 'compact',
        framed: false,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'We’ll have **20+ questions** before the season starts, along with **game-by-game predictions**, so there’s a lot more coming soon!',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'If you know another Bears fan who would have fun making predictions and comparing results, feel free to forward this email to them.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Thanks for joining the community.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Bear Down!',
      },
    ],
  };
}

export function createSeasonRecapDraft(): EmailComposerDraft {
  return {
    subject: 'How Bears fans predicted the 2025 season',
    previewText:
      'The dust has settled. See how Bears fans did across all 13 predictions and check your results.',
    headerEyebrow: '2025 Season Recap',
    headerTitle: 'How Bears Fans Predicted the Season',
    headerMeta: 'IRFAN | APR 1',
    footerLinkLabel: 'View the recap on the site',
    footerLinkHref: EMAIL_LINKS.recap,
    blocks: [
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.hero,
        alt: 'Caleb Williams smiling with Ben Johnson on the sideline',
        caption: 'Photo: Jacob Funk/Chicago Bears.',
        href: EMAIL_LINKS.recap,
        width: 'full',
        framed: true,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Before the season started, Bears Prediction Tracker asked fans to make calls on everything from Caleb\'s stats to the draft to whether this team would end the playoff drought. Hundreds of you locked in your picks.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'The dust has settled. Here\'s how you did.',
      },
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.communityAccuracy,
        alt: 'Community accuracy chart for 2025 Bears predictions',
        href: EMAIL_LINKS.recap,
        width: 'full',
        framed: false,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Want to see how you did? Jump back in below.',
      },
      {
        id: createBlockId('button'),
        type: 'button',
        label: 'My Predictions',
        href: EMAIL_CTA_LINKS.dashboard,
        tone: 'primary',
      },
      {
        id: createBlockId('button'),
        type: 'button',
        label: 'Leaderboard',
        href: EMAIL_CTA_LINKS.leaderboard,
        tone: 'secondary',
      },
      {
        id: createBlockId('heading'),
        type: 'heading',
        text: 'The Season in Context',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'There was cautious optimism heading into 2025. New head coach. Second-year quarterback with sky-high potential. Most fans weren’t sure if this was a playoff team or another rebuilding year.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'The Bears exceeded expectations. The offense clicked in the second half. The playoff drought ended. Chicago picked up its first playoff win in over a decade. Caleb delivered clutch performances down the stretch. Iceman.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Now to the predictions.',
      },
      {
        id: createBlockId('heading'),
        type: 'heading',
        text: 'The Sure Things',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Some predictions showed overwhelming consensus and fans nailed them.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Caleb Williams breaking the Bears’ single-season passing record was the most confident correct call of the year. Williams threw for 3,942 yards, surpassing Erik Kramer’s franchise mark. 90% of fans predicted it, most with high confidence.',
      },
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.calebRecord,
        alt: 'Caleb versus the Bears passing record graphic',
        width: 'full',
        framed: true,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'He still fell short of 4,000 yards. No Bears quarterback has ever hit that mark. That will be a prediction in 2026.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'He also started every game, something 58% of fans correctly predicted, though confidence was mixed. Durability for a Bears QB has been a question mark in the past.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'One question we probably should have asked was completion percentage. Ben’s stated goal for him was 70%, but Williams finished at a league-low 59%.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Speaking of BJ, Bears fans had a lot of confidence in him. 79% saw Johnson as a Coach of the Year finalist.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'While fans trusted Johnson to elevate the offense, they weren’t buying the defense. 87% correctly predicted the Bears would not finish as a top-10 defense, most with high confidence. It would have been a bottom-10 unit if not for leading the league in turnovers.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'When it came to win total, 72% predicted the Bears would win more than eight games. Few would have predicted 11 wins, though, given that most weren’t even confident the Bears would make the playoffs.',
      },
      {
        id: createBlockId('heading'),
        type: 'heading',
        text: 'The Coin Flip',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'The Bears making the playoffs was the most divisive prediction of the season. Just 54% picked correctly, with confidence spread almost evenly across the board.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'A true coin flip and the kind of question we’ll have a lot more of in 2026.',
      },
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.playoff,
        alt: 'Playoff prediction split chart',
        width: 'full',
        framed: true,
      },
      {
        id: createBlockId('heading'),
        type: 'heading',
        text: 'The Confident Misses',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Not every strong conviction landed.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: '78% of fans predicted Rome Odunze would surpass 1,000 receiving yards. 52% made that call with high confidence. A late-season injury cost him 5 games, and he ultimately fell short of the milestone.',
      },
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.romeOdunze,
        alt: 'Rome Odunze 2025 stat card',
        width: 'full',
        framed: true,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Montez Sweat reaching 10 sacks was another misread, but in the other direction. 73% of fans predicted he’d fall short. Sweat just barely got there, a solid rebound from a disappointing 2024.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'The Bears’ offense exceeded expectations too, finishing 4th in the NFL in total offense at 375.7 yards per game. Only 40% of fans expected the unit to crack the top ten, which made it one of the biggest surprises of the season.',
      },
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.offenseSurprise,
        alt: 'Offense surprise stat card',
        width: 'full',
        framed: true,
      },
      {
        id: createBlockId('heading'),
        type: 'heading',
        text: 'The Impossible Question',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'The hardest question of the year: who would the Bears select with the 10th pick? Most fans expected Penn State tight end Tyler Warren. The Bears went with Colston Loveland, who wasn’t even listed as an option.',
      },
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.draft,
        alt: 'Draft prediction graphic',
        width: 'full',
        framed: true,
      },
      {
        id: createBlockId('heading'),
        type: 'heading',
        text: 'What’s Next',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'All 13 predictions are now resolved and up on the site.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'We’re already working on 2026. More questions, more categories, and game-by-game picks. The first question is already live.',
      },
      {
        id: createBlockId('image'),
        type: 'image',
        src: EMAIL_IMAGE_URLS.draftLive,
        alt: 'Live 2026 draft question card with answer options',
        href: EMAIL_CARD_LINKS.draftQuestion,
        width: 'full',
        framed: false,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Which position will the Bears pick with the 25th pick? You can make your prediction now, and you’ll have until draft day to lock it in.',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: 'Thanks for joining the community.',
      },
      {
        id: createBlockId('signature'),
        type: 'signature',
        text: 'Irfan',
      },
    ],
  };
}

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    id: 'draft-reminder-2026-pick-25',
    label: '2026 Draft Reminder',
    description: 'Bears 25th-pick reminder with the live draft card embedded.',
    createDraft: createDraftReminderDraft,
  },
  {
    id: 'season-recap-2025',
    label: '2025 Season Recap',
    description: 'The full 2025 season recap email with recap images and buttons.',
    createDraft: createSeasonRecapDraft,
  },
];

export function createDraftFromTemplate(templateId: string) {
  return EMAIL_TEMPLATES.find((template) => template.id === templateId)?.createDraft() ?? createDraftReminderDraft();
}

export function createDefaultRecapDraft(): EmailComposerDraft {
  return createDraftReminderDraft();
}

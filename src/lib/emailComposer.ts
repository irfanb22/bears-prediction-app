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

/**
 * A prediction card rendered from live HTML rather than a screenshot, so it
 * stays readable with images blocked and crisp on any screen.
 *
 * `question` and `choices` mirror rows in the questions table and are not
 * editable in the console — a card that disagrees with the site sends people to
 * a prompt they did not expect. `text` holds the editorial aside under the
 * question, and is named `text` so the composer's existing inline editing picks
 * it up without a second edit path.
 */
export interface EmailQuestionCardBlock {
  id: string;
  type: 'question_card';
  question: string;
  choices: string[];
  href: string;
  text?: string;
}

export type EmailBlock =
  | EmailHeadingBlock
  | EmailParagraphBlock
  | EmailImageBlock
  | EmailButtonBlock
  | EmailSpacerBlock
  | EmailSignatureBlock
  | EmailQuestionCardBlock;

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

const SEASON_2026_ATTRIBUTION_QUERY =
  'utm_source=email&utm_medium=email&utm_campaign=2026_season_open';

export const EMAIL_2026_SEASON_CTA_LINKS = {
  // Let readers explore the public question set before asking them to sign in.
  // Authentication is requested only when they try to save a prediction.
  questions: withQuery('https://bearsprediction.com/?season=2026', SEASON_2026_ATTRIBUTION_QUERY),
  gamePicks: withQuery(
    'https://bearsprediction.com/?auth=login&redirect=%2Fgame-picks',
    SEASON_2026_ATTRIBUTION_QUERY
  ),
  // The recap is public, so this one skips the login redirect.
  recap: withQuery('https://bearsprediction.com/season-recap', SEASON_2026_ATTRIBUTION_QUERY),
  // My Predictions is per-user: the redirect signs the reader in first so they
  // land on their own results rather than a login wall.
  myPredictions: withQuery(
    'https://bearsprediction.com/?auth=login&redirect=%2Fdashboard',
    SEASON_2026_ATTRIBUTION_QUERY
  ),
} as const;

/**
 * Card links go straight to the question rather than through the login
 * redirect: the home page is public, and the app opens the prediction modal for
 * `?question=<id>` on its own, prompting to sign in only when a pick is saved.
 * Bouncing a logged-out reader to a login screen first hides the very question
 * the card was advertising.
 *
 * The season and category are part of the link because the app matches the
 * question against the *filtered* list — without them the target can sit behind
 * a filter and the deep link quietly does nothing.
 */
function questionCardHref(questionId: string, category: string) {
  return withQuery(
    `https://bearsprediction.com/?season=2026&category=${category}&question=${questionId}`,
    SEASON_2026_ATTRIBUTION_QUERY
  );
}

export const EMAIL_2026_QUESTION_CARDS = {
  receivingYards: {
    id: 'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f005',
    question: 'Who leads the Bears in receiving yards?',
    choices: ['Rome Odunze', 'Colston Loveland', 'Luther Burden III'],
    category: 'player_stats',
  },
  completionRate: {
    id: 'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f002',
    question: 'Caleb Williams completes at least 63% of his passes?',
    choices: ['Yes', 'No'],
    category: 'qb',
  },
  kylerGordon: {
    id: 'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f008',
    question: 'Kyler Gordon plays 8+ games?',
    choices: ['Yes', 'No'],
    category: 'player_stats',
  },
} as const;

export function createQuestionCardBlock(
  card: (typeof EMAIL_2026_QUESTION_CARDS)[keyof typeof EMAIL_2026_QUESTION_CARDS],
  comment: string
): EmailQuestionCardBlock {
  return {
    id: createBlockId('question-card'),
    type: 'question_card',
    question: card.question,
    choices: [...card.choices],
    href: questionCardHref(card.id, card.category),
    text: comment,
  };
}

function createSeason2026PicksButton(): EmailButtonBlock {
  return {
    id: createBlockId('button'),
    type: 'button',
    label: 'Make your 2026 picks',
    href: EMAIL_2026_SEASON_CTA_LINKS.questions,
    tone: 'primary',
  };
}

function isSeason2026Cta(block: EmailBlock): block is EmailButtonBlock {
  return (
    block.type === 'button' &&
    (block.href === EMAIL_2026_SEASON_CTA_LINKS.questions ||
      block.href === EMAIL_2026_SEASON_CTA_LINKS.gamePicks ||
      block.href.includes('auth=login&redirect=%2F%3Fseason%3D2026'))
  );
}

const SEASON_2026_OPEN_COPY = {
  subject: 'The 2026 Bears predictions are live',
  previewText:
    'Answer 25 season questions and pick all 17 games by Sunday, September 13 at 12:00 PM CT.',
  opener: 'The 2026 Bears season starts in 10 days!',
  intro: 'This season, we have **25 regular-season questions** and a game picker for all **17 games**.',
  rules:
    'The rules are simple: one point for each correct prediction. At the end of the season, you’ll see how you did and where you rank on the leaderboard.',
  sampleIntro: 'Here’s a preview of three questions we think will split Bears fans.',
  deadline:
    'All picks lock **at kickoff—Sunday, September 13 at 12:00 PM CT**. Until then, you can change your answers as many times as you want.',
  recap: `Also, if you haven’t visited the site in a while, the [2025 recap](${EMAIL_2026_SEASON_CTA_LINKS.recap}) is live. You can also switch to 2025 on your [My Predictions](${EMAIL_2026_SEASON_CTA_LINKS.myPredictions}) page to see how you did.`,
  reply: 'Hit reply with any questions or feedback!',
  postscript: 'P.S. Green Bay sucks!',
} as const;

/**
 * Keeps an already-saved season-opening draft in step with structural template
 * improvements without replacing any copy the admin edited in the composer.
 */
export function upgradeSeason2026OpenDraft(draft: EmailComposerDraft): EmailComposerDraft {
  const seasonQuestionCount = draft.blocks.filter(
    (block) => block.type === 'question_card' && block.href.includes('utm_campaign=2026_season_open')
  ).length;

  if (seasonQuestionCount === 0 || !draft.blocks.some(isSeason2026Cta)) {
    return draft;
  }

  const exactCopyUpgrades = new Map<string, string>([
    ['The Bears season is **less than two weeks away**.', SEASON_2026_OPEN_COPY.opener],
    [
      'This is the second year of Bears Prediction Tracker. Last year there were 13 questions. This year we’re adding more questions and a game-by-game pick for all 17 games.',
      SEASON_2026_OPEN_COPY.intro,
    ],
    [
      'Bears Prediction Tracker is back for Year 2. This season, there are **25 live regular-season questions** plus a pick for every game on the **17-game schedule**.',
      SEASON_2026_OPEN_COPY.intro,
    ],
    [
      'Here are three juicy ones that are part of 25 different questions for this season.',
      SEASON_2026_OPEN_COPY.sampleIntro,
    ],
    ['Here are three of the 25 questions:', SEASON_2026_OPEN_COPY.sampleIntro],
    [
      'Every pick locks **right at kickoff on Sunday, September 13**. Until then you can change your answers as many times as you want.',
      SEASON_2026_OPEN_COPY.deadline,
    ],
    [
      'All picks lock **Sunday, September 13 at 12:00 PM Central**. You can change any answer until then.',
      SEASON_2026_OPEN_COPY.deadline,
    ],
    [
      'If there’s a question you think I missed that’s topical for this season, hit reply and let me know. I might add one more if it’s a good one.',
      SEASON_2026_OPEN_COPY.reply,
    ],
    [
      'Know another Bears fan who’d have fun with this? Forward this email to them — and hit reply if you have any questions.',
      SEASON_2026_OPEN_COPY.reply,
    ],
    [
      `And if you haven’t looked at how last year turned out, the [season recap](${EMAIL_2026_SEASON_CTA_LINKS.recap}) and your own [My Predictions](${EMAIL_2026_SEASON_CTA_LINKS.myPredictions}) page are both still up.`,
      SEASON_2026_OPEN_COPY.recap,
    ],
    [
      `If you haven’t seen how last year turned out, check out the [season recap](${EMAIL_2026_SEASON_CTA_LINKS.recap}) or your [My Predictions](${EMAIL_2026_SEASON_CTA_LINKS.myPredictions}) page.`,
      SEASON_2026_OPEN_COPY.recap,
    ],
  ]);
  const blocks = draft.blocks.filter(
    (block) =>
      !(
        block.type === 'paragraph' &&
        (block.text ===
          'Played last season? Sign in to the same account you used before so your old results and new picks stay together.' ||
          block.text === 'Bear Down!')
      )
  ).map((block) => {
    if (block.type === 'paragraph') {
      const upgradedText = exactCopyUpgrades.get(block.text);
      return upgradedText ? { ...block, text: upgradedText } : block;
    }
    return block;
  });
  const firstQuestionIndex = blocks.findIndex((block) => block.type === 'question_card');
  const alreadyHasEarlyCta = blocks
    .slice(0, Math.max(firstQuestionIndex, 0))
    .some(isSeason2026Cta);

  if (firstQuestionIndex >= 0 && !alreadyHasEarlyCta) {
    const sampleIntroIndex = blocks.findIndex(
      (block) => block.type === 'paragraph' && block.text === SEASON_2026_OPEN_COPY.sampleIntro
    );
    blocks.splice(
      sampleIntroIndex >= 0 ? sampleIntroIndex : firstQuestionIndex,
      0,
      createSeason2026PicksButton()
    );
  }

  const firstCtaIndex = blocks.findIndex(isSeason2026Cta);
  const hasRules = blocks.some(
    (block) => block.type === 'paragraph' && block.text === SEASON_2026_OPEN_COPY.rules
  );
  if (firstCtaIndex >= 0 && !hasRules) {
    blocks.splice(firstCtaIndex + 1, 0, {
      id: createBlockId('paragraph'),
      type: 'paragraph',
      text: SEASON_2026_OPEN_COPY.rules,
    });
  }

  const ctaIndexes = blocks.flatMap((block, index) => (isSeason2026Cta(block) ? [index] : []));
  for (const ctaIndex of ctaIndexes) {
    blocks[ctaIndex] = {
      ...(blocks[ctaIndex] as EmailButtonBlock),
      label: 'Make your 2026 picks',
      href: EMAIL_2026_SEASON_CTA_LINKS.questions,
    };
  }

  const replyIndex = blocks.findIndex(
    (block) => block.type === 'paragraph' && block.text === SEASON_2026_OPEN_COPY.reply
  );
  const recapIndex = blocks.findIndex(
    (block) => block.type === 'paragraph' && block.text === SEASON_2026_OPEN_COPY.recap
  );
  if (replyIndex >= 0 && recapIndex >= 0 && replyIndex < recapIndex) {
    const [replyBlock] = blocks.splice(replyIndex, 1);
    const updatedRecapIndex = blocks.findIndex(
      (block) => block.type === 'paragraph' && block.text === SEASON_2026_OPEN_COPY.recap
    );
    blocks.splice(updatedRecapIndex + 1, 0, replyBlock);
  }

  const signatureIndex = blocks.findIndex((block) => block.type === 'signature');
  const hasPostscript = blocks.some(
    (block) => block.type === 'paragraph' && block.text === SEASON_2026_OPEN_COPY.postscript
  );
  if (signatureIndex >= 0 && !hasPostscript) {
    blocks.splice(signatureIndex + 1, 0, {
      id: createBlockId('paragraph'),
      type: 'paragraph',
      text: SEASON_2026_OPEN_COPY.postscript,
    });
  }

  return {
    ...draft,
    subject: draft.subject === 'Bears Season is Almost Here!'
      ? SEASON_2026_OPEN_COPY.subject
      : draft.subject,
    previewText:
      draft.previewText === 'Make your predictions for the upcoming season. Every pick locks at kickoff on Sunday, September 13.' ||
      draft.previewText === 'Answer 25 season questions and pick all 17 games by Sunday, September 13 at 12:00 PM Central.'
        ? SEASON_2026_OPEN_COPY.previewText
        : draft.previewText,
    blocks,
  };
}

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

export function createBlockId(prefix: string) {
  // Not a counter. A counter restarts at 1 on every page load, and blocks loaded
  // back from the database carry ids minted by a previous load in exactly that
  // shape — so seeding a template alongside saved content could produce two
  // blocks sharing an id. That means duplicate React keys, and worse, an edit to
  // one block silently rewriting the other.
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createSeason2026OpenDraft(): EmailComposerDraft {
  return {
    subject: SEASON_2026_OPEN_COPY.subject,
    previewText: SEASON_2026_OPEN_COPY.previewText,
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
        text: SEASON_2026_OPEN_COPY.opener,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: SEASON_2026_OPEN_COPY.intro,
      },
      createSeason2026PicksButton(),
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: SEASON_2026_OPEN_COPY.rules,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: SEASON_2026_OPEN_COPY.sampleIntro,
      },
      createQuestionCardBlock(
        EMAIL_2026_QUESTION_CARDS.receivingYards,
        'It feels like a three-man race.'
      ),
      createQuestionCardBlock(
        EMAIL_2026_QUESTION_CARDS.completionRate,
        'He finished last season at 59%.'
      ),
      createQuestionCardBlock(
        EMAIL_2026_QUESTION_CARDS.kylerGordon,
        'He’s opening the season on reserve/PUP.'
      ),
      createSeason2026PicksButton(),
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: SEASON_2026_OPEN_COPY.deadline,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: SEASON_2026_OPEN_COPY.recap,
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: SEASON_2026_OPEN_COPY.reply,
      },
      {
        id: createBlockId('signature'),
        type: 'signature',
        text: 'Irfan',
      },
      {
        id: createBlockId('paragraph'),
        type: 'paragraph',
        text: SEASON_2026_OPEN_COPY.postscript,
      },
    ],
  };
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
    id: 'season-2026-open',
    label: '2026 Season Open',
    description: 'Season kickoff announcement: sample questions, game picks, and the Week 1 deadline.',
    createDraft: createSeason2026OpenDraft,
  },
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
  return createSeason2026OpenDraft();
}

/**
 * Starter content for lifecycle automations.
 *
 * The composer edits the text inside blocks but cannot add or remove them, so a
 * config whose `blocks` is empty would open an editor with nothing to type into.
 * These scaffolds are what make a brand-new automation usable — and because the
 * structure isn't editable afterwards, the scaffold's shape is the final shape.
 *
 * Per-type rather than one generic block of copy: greeting someone who just
 * signed up and nudging someone who signed up and never played are different
 * jobs, and the wording is most of the value.
 */
export function createWelcomeStarterBlocks(): EmailBlock[] {
  return [
    { id: createBlockId('paragraph'), type: 'paragraph', text: 'Hey,' },
    {
      id: createBlockId('paragraph'),
      type: 'paragraph',
      text: "Thanks for joining Bears Prediction Tracker. You're in — and the season's questions are waiting for your picks.",
    },
    {
      id: createBlockId('paragraph'),
      type: 'paragraph',
      text: 'Make your predictions before each deadline, then see how you stack up against every other Bears fan on the leaderboard.',
    },
    {
      id: createBlockId('button'),
      type: 'button',
      label: 'Make your picks',
      href: EMAIL_CTA_LINKS.dashboard,
      tone: 'primary',
    },
    { id: createBlockId('paragraph'), type: 'paragraph', text: 'Bear Down!' },
  ];
}

export function createNudgeStarterBlocks(): EmailBlock[] {
  return [
    { id: createBlockId('paragraph'), type: 'paragraph', text: 'Hey,' },
    {
      id: createBlockId('paragraph'),
      type: 'paragraph',
      text: "You signed up for Bears Prediction Tracker but haven't made any picks yet — and the questions are still open.",
    },
    {
      id: createBlockId('paragraph'),
      type: 'paragraph',
      text: 'It takes a couple of minutes. Once you\'re in, you can change your answers any time before the deadline.',
    },
    {
      id: createBlockId('button'),
      type: 'button',
      label: 'Make your predictions',
      href: EMAIL_CTA_LINKS.draftQuestion,
      tone: 'primary',
    },
    { id: createBlockId('paragraph'), type: 'paragraph', text: 'Bear Down!' },
  ];
}

function createGenericStarterBlocks(): EmailBlock[] {
  return [
    { id: createBlockId('paragraph'), type: 'paragraph', text: 'Hey,' },
    { id: createBlockId('paragraph'), type: 'paragraph', text: 'Write your message here.' },
    { id: createBlockId('paragraph'), type: 'paragraph', text: 'Bear Down!' },
  ];
}

export function starterBlocksFor(emailType: string): EmailBlock[] {
  if (emailType === 'welcome') return createWelcomeStarterBlocks();
  if (emailType === 'first_prediction_nudge') return createNudgeStarterBlocks();
  return createGenericStarterBlocks();
}

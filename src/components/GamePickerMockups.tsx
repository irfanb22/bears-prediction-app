import { useEffect, useMemo, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ListChecks,
  Loader2,
  Lock,
  MapPin,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Navbar } from './Navbar';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatCentralDeadline } from '../lib/utils';

type Pick = 'win' | 'loss';

interface ScheduleGame {
  id?: string;
  week: number;
  opponent: string;
  shortName: string;
  date: string;
  time: string;
  location: string;
  home: boolean;
  spotlight?: string;
  logoCode: string;
}

const GAME_PICK_SCHEDULE: ScheduleGame[] = [
  { week: 1, opponent: 'Carolina Panthers', shortName: 'CAR', logoCode: 'car', date: 'Sep 13', time: '12:00 PM', location: 'Charlotte, NC', home: false },
  { week: 2, opponent: 'Minnesota Vikings', shortName: 'MIN', logoCode: 'min', date: 'Sep 20', time: '12:00 PM', location: 'Soldier Field', home: true },
  { week: 3, opponent: 'Philadelphia Eagles', shortName: 'PHI', logoCode: 'phi', date: 'Sep 28', time: '7:15 PM', location: 'Soldier Field', home: true, spotlight: 'MNF' },
  { week: 4, opponent: 'New York Jets', shortName: 'NYJ', logoCode: 'nyj', date: 'Oct 4', time: '12:00 PM', location: 'Soldier Field', home: true },
  { week: 5, opponent: 'Green Bay Packers', shortName: 'GB', logoCode: 'gb', date: 'Oct 11', time: '3:25 PM', location: 'Green Bay, WI', home: false, spotlight: 'Rivalry' },
  { week: 6, opponent: 'Atlanta Falcons', shortName: 'ATL', logoCode: 'atl', date: 'Oct 18', time: '12:00 PM', location: 'Atlanta, GA', home: false },
  { week: 7, opponent: 'New England Patriots', shortName: 'NE', logoCode: 'ne', date: 'Oct 22', time: '7:15 PM', location: 'Soldier Field', home: true, spotlight: 'TNF' },
  { week: 8, opponent: 'Seattle Seahawks', shortName: 'SEA', logoCode: 'sea', date: 'Nov 2', time: '7:15 PM', location: 'Seattle, WA', home: false, spotlight: 'MNF' },
  { week: 9, opponent: 'Tampa Bay Buccaneers', shortName: 'TB', logoCode: 'tb', date: 'Nov 8', time: '7:20 PM', location: 'Soldier Field', home: true, spotlight: 'SNF' },
  { week: 11, opponent: 'New Orleans Saints', shortName: 'NO', logoCode: 'no', date: 'Nov 22', time: '12:00 PM', location: 'Soldier Field', home: true },
  { week: 12, opponent: 'Detroit Lions', shortName: 'DET', logoCode: 'det', date: 'Nov 26', time: '12:00 PM', location: 'Detroit, MI', home: false, spotlight: 'Thanksgiving' },
  { week: 13, opponent: 'Jacksonville Jaguars', shortName: 'JAX', logoCode: 'jax', date: 'Dec 6', time: '12:00 PM', location: 'Soldier Field', home: true },
  { week: 14, opponent: 'Miami Dolphins', shortName: 'MIA', logoCode: 'mia', date: 'Dec 13', time: '12:00 PM', location: 'Miami, FL', home: false },
  { week: 15, opponent: 'Buffalo Bills', shortName: 'BUF', logoCode: 'buf', date: 'Dec 19', time: '7:20 PM', location: 'Buffalo, NY', home: false },
  { week: 16, opponent: 'Green Bay Packers', shortName: 'GB', logoCode: 'gb', date: 'Dec 25', time: '12:00 PM', location: 'Soldier Field', home: true, spotlight: 'Christmas' },
  { week: 17, opponent: 'Detroit Lions', shortName: 'DET', logoCode: 'det', date: 'Jan 3', time: '3:25 PM', location: 'Soldier Field', home: true },
  { week: 18, opponent: 'Minnesota Vikings', shortName: 'MIN', logoCode: 'min', date: 'TBD', time: 'TBD', location: 'Minneapolis, MN', home: false },
];

const schedule = GAME_PICK_SCHEDULE;
const GAME_PICK_DRAFT_STORAGE_KEY = 'game-picks-draft:2026';

const getTeamLogoUrl = (code: string) => `https://a.espncdn.com/i/teamlogos/nfl/500/${code}.png`;

const initialPicks: Record<number, Pick> = {
  1: 'win',
  2: 'win',
  3: 'loss',
  4: 'win',
  5: 'loss',
  6: 'win',
};

const conceptNotes = {
  board: {
    label: 'Season Board',
    eyebrow: 'Recommended foundation',
    title: 'See the whole season. Complete every pick.',
    description: 'Best for fans who want to forecast all 17 games in one sitting and see their projected record update as they go.',
  },
  focus: {
    label: 'Guided Picks',
    eyebrow: 'Best mobile flow',
    title: 'One matchup, one decision.',
    description: 'Turns the season picks into a guided 17-step sequence and saves the forecast automatically after the final choice.',
  },
  review: {
    label: 'Review Sheet',
    eyebrow: 'Final submission state',
    title: 'Check the record. Lock every pick together.',
    description: 'A dedicated confirmation step makes the season-wide deadline and the permanence of the picks unmistakable.',
  },
} as const;

type Concept = keyof typeof conceptNotes;

function TeamMark({ game, large = false }: { game: ScheduleGame; large?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-sm ${
        large ? 'h-20 w-20 text-xl' : 'h-12 w-12 text-sm'
      }`}
    >
      <img src={getTeamLogoUrl(game.logoCode)} alt={`${game.opponent} logo`} className="h-full w-full object-contain" />
    </div>
  );
}

function BoardPickControl({
  game,
  value,
  onChange,
  disabled = false,
}: {
  game: ScheduleGame;
  value?: Pick;
  onChange: (pick: Pick) => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:min-w-[260px]">
      <button
        type="button"
        onClick={() => void onChange('loss')}
        disabled={disabled}
        aria-label={`Pick ${game.opponent} to win`}
        aria-pressed={value === 'loss'}
        className={`relative flex min-h-14 items-center justify-center gap-2 rounded-xl border px-2 py-2 transition disabled:cursor-default ${
          value === 'loss'
            ? 'border-bears-orange bg-orange-50 shadow-[0_0_0_2px_rgba(200,56,3,0.12)]'
            : 'border-slate-200 bg-white hover:border-bears-orange/30 hover:bg-orange-50/50'
        }`}
      >
        <img src={getTeamLogoUrl(game.logoCode)} alt="" className="h-8 w-8 object-contain" />
        <span className={`text-xs font-black ${value === 'loss' ? 'text-bears-orange' : 'text-slate-600'}`}>{game.shortName}</span>
        {value === 'loss' && <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bears-orange text-white"><Check className="h-3 w-3" /></span>}
      </button>
      <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">or</span>
      <button
        type="button"
        onClick={() => void onChange('win')}
        disabled={disabled}
        aria-label="Pick Chicago Bears to win"
        aria-pressed={value === 'win'}
        className={`relative flex min-h-14 items-center justify-center gap-2 rounded-xl border px-2 py-2 transition disabled:cursor-default ${
          value === 'win'
            ? 'border-bears-navy bg-slate-50 shadow-[0_0_0_2px_rgba(11,22,42,0.1)]'
            : 'border-slate-200 bg-white hover:border-bears-navy/30 hover:bg-slate-50'
        }`}
      >
        <img src={getTeamLogoUrl('chi')} alt="" className="h-8 w-8 object-contain" />
        <span className={`text-xs font-black ${value === 'win' ? 'text-bears-navy' : 'text-slate-600'}`}>Bears</span>
        {value === 'win' && <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bears-navy text-white"><Check className="h-3 w-3" /></span>}
      </button>
    </div>
  );
}

function SeasonBoard({
  picks,
  setPick,
  hasSaved = false,
  games = schedule,
  readOnly = false,
  showDesignNote = true,
  onSubmit,
  submitting = false,
  saveMode = 'auto',
  isDirty = false,
  deadline,
}: {
  picks: Record<number, Pick>;
  setPick: (week: number, pick: Pick) => void | Promise<void>;
  hasSaved?: boolean;
  games?: ScheduleGame[];
  readOnly?: boolean;
  showDesignNote?: boolean;
  onSubmit?: () => void;
  submitting?: boolean;
  saveMode?: 'auto' | 'manual';
  isDirty?: boolean;
  deadline?: string;
}) {
  const completed = Object.keys(picks).length;
  const remaining = games.length - completed;
  const isComplete = completed === games.length;
  const showSavedConfirmation = saveMode === 'manual' && hasSaved && !isDirty;
  const deadlineLabel = deadline
    ? formatCentralDeadline(deadline, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', year: undefined })
    : 'Sep 13, 12:00 PM (CT)';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-bears-orange">2026 regular season</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-bears-navy">Predict every game</h3>
          </div>
          <div className="min-w-[190px]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-600">
              <span>{completed} of {games.length} picked</span>
              <span>{Math.round((completed / games.length) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-bears-orange transition-all" style={{ width: `${(completed / games.length) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {games.map((game) => (
            <div key={game.week} className="grid gap-3 px-4 py-4 transition hover:bg-orange-50/30 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
              <div className="flex items-center justify-between sm:block">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Week</p>
                <p className="text-xl font-black text-bears-navy sm:mt-0.5">{game.week}</p>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <TeamMark game={game} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-extrabold text-bears-navy">{game.home ? 'vs.' : 'at'} {game.opponent}</p>
                    {game.spotlight && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800">
                        {game.spotlight}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{game.date}</span>
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{game.time === 'TBD' ? 'TBD' : `${game.time} CT`}</span>
                  </p>
                </div>
              </div>
              <BoardPickControl game={game} value={picks[game.week]} onChange={(pick) => setPick(game.week, pick)} disabled={readOnly} />
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-2xl bg-bears-navy p-5 text-white shadow-[0_18px_38px_rgba(11,22,42,0.2)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">Your forecast</p>
          <p className="mt-2 text-3xl font-black">{Object.values(picks).filter((pick) => pick === 'win').length}–{Object.values(picks).filter((pick) => pick === 'loss').length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {saveMode === 'manual'
              ? `Complete all 17 games, then save your forecast. Deadline ${deadlineLabel}.`
              : 'Pick all 17 games and your forecast saves automatically. You can keep changing it until Week 1 kickoff.'}
          </p>
          <div className={`mt-5 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold ${
            showSavedConfirmation
              ? 'bg-emerald-500/15 text-emerald-200'
              : saveMode === 'manual' && isComplete && isDirty
                ? 'bg-amber-400/15 text-amber-200'
                : isComplete
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-white/10 text-slate-300'
          }`}>
            {readOnly ? (
              <><Lock className="h-4 w-4" /> Picks locked</>
            ) : saveMode === 'manual' ? (
              showSavedConfirmation ? (
                <><Check className="h-4 w-4" /> Forecast saved</>
              ) : isComplete ? (
                <><AlertCircle className="h-4 w-4" /> {hasSaved ? 'Unsaved changes' : 'Unsaved forecast'}</>
              ) : (
                <>{remaining} picks remaining</>
              )
            ) : isComplete ? (
              <><Check className="h-4 w-4" /> {hasSaved ? 'Saved automatically' : `All ${games.length} complete`}</>
            ) : (
              <>{remaining} picks remaining</>
            )}
          </div>
          {onSubmit && !readOnly && !showSavedConfirmation && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !isComplete}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-bears-orange px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#a92f02] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting
                ? 'Saving…'
                : !isComplete
                  ? `${remaining} picks remaining`
                  : hasSaved
                    ? 'Save changes'
                    : 'Save my forecast'}
            </button>
          )}
        </div>
        {showDesignNote && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-900">Why this works</p>
            <p className="mt-2 text-sm leading-6 text-amber-950/75">Fastest path to one complete season forecast, easy to scan, and closest to the “desk” feel of the current site.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function FocusMode({
  picks,
  setPick,
  initialIndex = 0,
  onPickMade,
  games = schedule,
  readOnly = false,
}: {
  picks: Record<number, Pick>;
  setPick: (week: number, pick: Pick) => boolean | void | Promise<boolean | void>;
  initialIndex?: number;
  onPickMade?: () => void;
  games?: ScheduleGame[];
  readOnly?: boolean;
}) {
  const [index, setIndex] = useState(initialIndex);
  const game = games[index];
  const opponentX = useMotionValue(0);
  const bearsX = useMotionValue(0);
  const opponentRotate = useTransform(opponentX, [-180, 0, 100], [-18, -7, -3]);
  const bearsRotate = useTransform(bearsX, [-100, 0, 180], [3, 7, 18]);
  const opponentStampOpacity = useTransform(opponentX, [-150, -55, 0], [1, 0.18, 0]);
  const bearsStampOpacity = useTransform(bearsX, [0, 55, 150], [0, 0.18, 1]);
  const opponentStampScale = useTransform(opponentX, [-150, -55, 0], [1.08, 0.86, 0.72]);
  const bearsStampScale = useTransform(bearsX, [0, 55, 150], [0.72, 0.86, 1.08]);
  const savedOpponentStampOpacity = useTransform(bearsX, [0, 30, 90], [1, 0.55, 0]);
  const savedBearsStampOpacity = useTransform(opponentX, [-90, -30, 0], [0, 0.55, 1]);
  const savedPick = picks[game.week];
  const completedPicks = Object.keys(picks).length;
  const remainingPicks = games.length - completedPicks;
  const currentWins = Object.values(picks).filter((pick) => pick === 'win').length;
  const currentLosses = Object.values(picks).filter((pick) => pick === 'loss').length;

  const go = (direction: number) => setIndex((current) => Math.min(Math.max(current + direction, 0), games.length - 1));

  const makeSwipePick = async (pick: Pick) => {
    if (readOnly) return;
    const saved = await setPick(game.week, pick);
    opponentX.set(0);
    bearsX.set(0);
    if (saved === false) return;
    if (onPickMade) {
      onPickMade();
      return;
    }
    if (index < games.length - 1) {
      setIndex((current) => current + 1);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
        <div className="bg-bears-navy px-5 py-4 text-white sm:px-8 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">Week {game.week}</p>
              <p className="mt-1 text-lg font-black">Game {index + 1} of {games.length}</p>
            </div>
            <div className="text-right">
              {game.spotlight && <span className="mb-1 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide">{game.spotlight}</span>}
              <p className="text-xs font-bold text-slate-300">{remainingPicks} {remainingPicks === 1 ? 'pick' : 'picks'} left</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-bears-orange transition-all duration-300" style={{ width: `${(completedPicks / games.length) * 100}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Current record</p>
            <div className="flex items-center gap-2 text-xs font-black">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-white">{currentWins} {currentWins === 1 ? 'Win' : 'Wins'}</span>
              <span className="rounded-full bg-bears-orange/20 px-2.5 py-1 text-orange-200">{currentLosses} {currentLosses === 1 ? 'Loss' : 'Losses'}</span>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fafc_58%,#eef2f7_100%)] px-3 py-5 sm:px-8 sm:py-7">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{readOnly ? 'Your locked pick' : 'Choose the winner'}</p>
            <p className="mt-1 text-sm font-bold text-bears-navy">{readOnly ? 'Game picks can no longer be changed' : 'Drag one team card outward'}</p>
          </div>

          <div className="relative mx-auto mt-4 h-[310px] max-w-[520px] sm:h-[340px]">
            <div className="pointer-events-none absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <span>← Pick {game.shortName}</span>
              <span>Pick Bears →</span>
            </div>

            <motion.div
              key={`opponent-${game.week}`}
              drag={readOnly ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.78}
              dragSnapToOrigin
              whileDrag={{ scale: 1.04, zIndex: 50 }}
              style={{ x: opponentX, rotate: opponentRotate, touchAction: 'pan-y' }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -120) void makeSwipePick('loss');
              }}
              role="img"
              aria-label={`Drag ${game.opponent} card left to pick them`}
              className="absolute left-[4%] top-8 z-20 flex h-[245px] w-[52%] max-w-[245px] cursor-grab flex-col items-center overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 text-center shadow-[0_20px_45px_rgba(15,23,42,0.16)] active:cursor-grabbing sm:h-[275px] sm:p-5"
            >
              <span className="absolute inset-x-0 top-0 h-2 bg-bears-orange" />
              <span className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Opponent</span>
              <span className="mt-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-50 p-2 sm:h-28 sm:w-28">
                <img draggable={false} src={getTeamLogoUrl(game.logoCode)} alt={`${game.opponent} logo`} className="h-full w-full select-none object-contain" />
              </span>
              {savedPick === 'loss' ? (
                <motion.span data-saved-stamp="true" data-team="opponent" style={{ opacity: savedOpponentStampOpacity }} className="pointer-events-none absolute left-1/2 top-[104px] z-20 -translate-x-1/2 -rotate-12 rounded-lg border-[3px] border-red-600 bg-white/90 px-3 py-1 text-xl font-black tracking-[0.12em] text-red-600 shadow-sm sm:top-[122px]">
                  WIN
                </motion.span>
              ) : (
                <motion.span
                  style={{ opacity: opponentStampOpacity, scale: opponentStampScale }}
                  className="pointer-events-none absolute left-1/2 top-[104px] z-20 -translate-x-1/2 -rotate-12 rounded-lg border-[3px] border-red-600 bg-white/90 px-3 py-1 text-xl font-black tracking-[0.12em] text-red-600 shadow-sm sm:top-[122px]"
                >
                  WIN
                </motion.span>
              )}
              <span className="mt-4 text-base font-black leading-tight text-bears-navy sm:text-lg">{game.opponent}</span>
              <span className="mt-auto text-[10px] font-extrabold uppercase tracking-wide text-bears-orange">Drag left</span>
            </motion.div>

            <motion.div
              key={`bears-${game.week}`}
              drag={readOnly ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.78}
              dragSnapToOrigin
              whileDrag={{ scale: 1.04, zIndex: 50 }}
              style={{ x: bearsX, rotate: bearsRotate, touchAction: 'pan-y' }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 120) void makeSwipePick('win');
              }}
              role="img"
              aria-label="Drag Chicago Bears card right to pick them"
              className="absolute right-[4%] top-8 z-30 flex h-[245px] w-[52%] max-w-[245px] cursor-grab flex-col items-center overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 text-center shadow-[0_20px_45px_rgba(15,23,42,0.18)] active:cursor-grabbing sm:h-[275px] sm:p-5"
            >
              <span className="absolute inset-x-0 top-0 h-2 bg-bears-navy" />
              <span className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Your team</span>
              <span className="mt-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-50 p-2 sm:h-28 sm:w-28">
                <img draggable={false} src={getTeamLogoUrl('chi')} alt="Chicago Bears logo" className="h-full w-full select-none object-contain" />
              </span>
              {savedPick === 'win' ? (
                <motion.span data-saved-stamp="true" data-team="bears" style={{ opacity: savedBearsStampOpacity }} className="pointer-events-none absolute left-1/2 top-[104px] z-20 -translate-x-1/2 rotate-12 rounded-lg border-[3px] border-red-600 bg-white/90 px-3 py-1 text-xl font-black tracking-[0.12em] text-red-600 shadow-sm sm:top-[122px]">
                  WIN
                </motion.span>
              ) : (
                <motion.span
                  style={{ opacity: bearsStampOpacity, scale: bearsStampScale }}
                  className="pointer-events-none absolute left-1/2 top-[104px] z-20 -translate-x-1/2 rotate-12 rounded-lg border-[3px] border-red-600 bg-white/90 px-3 py-1 text-xl font-black tracking-[0.12em] text-red-600 shadow-sm sm:top-[122px]"
                >
                  WIN
                </motion.span>
              )}
              <span className="mt-4 text-base font-black leading-tight text-bears-navy sm:text-lg">Chicago Bears</span>
              <span className="mt-auto text-[10px] font-extrabold uppercase tracking-wide text-bears-navy">Drag right</span>
            </motion.div>
          </div>

          <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-x-3 gap-y-1 border-t border-slate-200 pt-4 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{game.date}</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{game.time === 'TBD' ? 'TBD' : `${game.time} CT`}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{game.location}</span>
          </div>
          <div className="mx-auto mt-3 grid max-w-sm grid-cols-2 gap-2">
            <button type="button" onClick={() => void makeSwipePick('loss')} disabled={readOnly} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-600 transition hover:border-bears-orange/30 hover:bg-orange-50 disabled:cursor-default disabled:opacity-50">
              Pick {game.shortName}
            </button>
            <button type="button" onClick={() => void makeSwipePick('win')} disabled={readOnly} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-bears-navy transition hover:border-bears-navy/30 hover:bg-slate-50 disabled:cursor-default disabled:opacity-50">
              Pick Bears
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-8">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-white disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === games.length - 1} className="inline-flex items-center gap-2 rounded-xl bg-bears-orange px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#a92f02] disabled:opacity-30">
            Next game <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MobilePicksOverview({
  picks,
  onEdit,
  games = schedule,
  readOnly = false,
}: {
  picks: Record<number, Pick>;
  onEdit?: (index: number) => void;
  games?: ScheduleGame[];
  readOnly?: boolean;
}) {
  const wins = Object.values(picks).filter((pick) => pick === 'win').length;
  const losses = Object.values(picks).filter((pick) => pick === 'loss').length;

  return (
    <section className="mx-auto max-w-xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
      <div className="bg-bears-navy px-5 py-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">{readOnly ? 'Picks locked' : 'Forecast saved'}</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Your 2026 picks</h2>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide">{Object.keys(picks).length}/{games.length}</span>
        </div>

        <div className="mt-5 grid grid-cols-2 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5">
          <div className="p-4 text-center">
            <p className="text-3xl font-black">{wins}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Wins</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-3xl font-black text-orange-300">{losses}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Losses</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-300">
          {readOnly
            ? 'Your season forecast is read-only now that Week 1 has kicked off.'
            : 'Tap any game below to change your winner. Updates save automatically until Sep 13 at 12:00 PM CT.'}
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {games.map((game, index) => {
          const pick = picks[game.week];
          const selectedBears = pick === 'win';
          const selectedName = pick ? (selectedBears ? 'Chicago Bears' : game.opponent) : 'No pick made';
          const selectedLogo = pick ? (selectedBears ? 'chi' : game.logoCode) : null;

          return (
            <button
              key={game.week}
              type="button"
              onClick={() => onEdit?.(index)}
              disabled={readOnly || !onEdit}
              aria-label={`Edit Week ${game.week} pick: ${selectedName}`}
              className="grid w-full grid-cols-[44px_46px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition hover:bg-orange-50/40"
            >
              <span>
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Week</span>
                <span className="mt-0.5 block text-lg font-black text-bears-navy">{game.week}</span>
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                {selectedLogo ? <img src={getTeamLogoUrl(selectedLogo)} alt="" className="h-full w-full object-contain" /> : <span className="text-lg font-black text-slate-300">—</span>}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-bears-navy">{selectedName}</span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">{game.home ? 'vs.' : 'at'} {game.opponent} · {game.date}</span>
              </span>
              {!readOnly && onEdit ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-bears-orange">
                  Edit <ArrowRight className="h-3.5 w-3.5" />
                </span>
              ) : (
                <Lock className="h-3.5 w-3.5 text-slate-300" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReviewSheet({
  picks,
  setPick,
  onBack,
  onLock,
}: {
  picks: Record<number, Pick>;
  setPick: (week: number, pick: Pick) => void;
  onBack?: () => void;
  onLock?: () => void;
}) {
  const wins = Object.values(picks).filter((pick) => pick === 'win').length;
  const losses = Object.values(picks).filter((pick) => pick === 'loss').length;
  const completed = Object.keys(picks).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
      <div className="overflow-hidden rounded-[30px] bg-bears-navy text-white shadow-[0_24px_60px_rgba(11,22,42,0.2)]">
        <div className="border-b border-white/10 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">Final review</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight">Your 2026 forecast</h3>
            </div>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide">{completed}/{schedule.length} complete</span>
          </div>
          <div className="mt-8 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5">
            <div className="p-4 text-center"><p className="text-3xl font-black">{wins}</p><p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Wins</p></div>
            <div className="p-4 text-center"><p className="text-3xl font-black text-orange-300">{losses}</p><p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Losses</p></div>
            <div className="p-4 text-center"><p className="text-3xl font-black text-slate-400">{schedule.length - completed}</p><p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Open</p></div>
          </div>
          <div className="mt-7 rounded-2xl border border-orange-300/25 bg-orange-300/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">One season deadline</p>
            <p className="mt-2 text-lg font-black">Sunday, September 13 · 12:00 PM CT</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">When the Bears season kicks off, every game pick locks together for the year.</p>
          </div>
          <button type="button" onClick={onLock} disabled={completed !== schedule.length} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-bears-orange px-5 py-4 text-base font-black transition hover:bg-[#a92f02] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
            {completed === schedule.length ? (
              <>Lock all 17 picks <Check className="h-5 w-5" /></>
            ) : (
              <>{schedule.length - completed} picks still needed</>
            )}
          </button>
          <p className="mt-3 text-center text-xs font-medium text-slate-400">You will confirm once more before the picks are locked.</p>
          {onBack && (
            <button type="button" onClick={onBack} className="mt-4 w-full text-center text-xs font-bold text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-white">
              Back to your picks
            </button>
          )}
        </div>
      </div>

      <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bears-orange">Pick check</p>
            <h3 className="mt-1 text-xl font-black text-bears-navy">Review every choice</h3>
          </div>
          <Trophy className="h-8 w-8 text-amber-500" />
        </div>
        <div className="mt-5 space-y-2.5">
          {schedule.map((game) => (
            <button
              key={game.week}
              type="button"
              onClick={() => setPick(game.week, picks[game.week] === 'win' ? 'loss' : 'win')}
              className="grid w-full grid-cols-[42px_minmax(0,1fr)_38px] items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50"
            >
              <span className="text-xs font-black text-slate-400">W{game.week}</span>
              <span className="truncate text-sm font-bold text-slate-700">{game.home ? 'vs' : 'at'} {game.shortName}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${
                picks[game.week] === 'win' ? 'bg-bears-navy text-white' : picks[game.week] === 'loss' ? 'bg-orange-100 text-bears-orange' : 'bg-slate-100 text-slate-400'
              }`}>
                {picks[game.week] === 'win' ? 'W' : picks[game.week] === 'loss' ? 'L' : '—'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ForecastSavedModal({ wins, losses, onClose }: { wins: number; losses: number; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bears-navy/70 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forecast-saved-title"
        className="w-full max-w-lg overflow-hidden rounded-[30px] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.3)]"
      >
        <div className="bg-bears-navy px-6 py-7 text-center text-white sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
            <Check className="h-7 w-7" />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Forecast saved</p>
          <h2 id="forecast-saved-title" className="mt-2 text-3xl font-black tracking-tight">Bears finish {wins}–{losses}</h2>
          <p className="mt-2 text-sm font-medium text-slate-300">All 17 game picks are saved.</p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bears-orange">You can still change your picks</p>
            <p className="mt-2 text-lg font-black text-bears-navy">Until Sep 13 · 12:00 PM CT</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Come back and update any game before the Bears kick off. Each change saves automatically. At noon Central, all 17 picks lock together for the season.</p>
          </div>
          <button type="button" onClick={onClose} autoFocus className="mt-5 w-full rounded-2xl bg-bears-orange px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#a92f02]">
            Got it — view my picks
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

interface GamePickSeasonStatus {
  season: number;
  state: 'draft' | 'open' | 'locked';
  lock_at: string;
  total_games: number;
  can_access: boolean;
  can_edit: boolean;
}

interface GamePickGameRow {
  id: string;
  week: number;
  opponent: string;
  short_name: string;
  logo_code: string;
  date_label: string;
  time_label: string;
  location: string;
  home: boolean;
  spotlight: string | null;
}

const toScheduleGame = (game: GamePickGameRow): ScheduleGame => ({
  id: game.id,
  week: game.week,
  opponent: game.opponent,
  shortName: game.short_name,
  logoCode: game.logo_code,
  date: game.date_label,
  time: game.time_label,
  location: game.location,
  home: game.home,
  spotlight: game.spotlight || undefined,
});

export function GamePicker() {
  const { user } = useAuth();
  const [status, setStatus] = useState<GamePickSeasonStatus | null>(null);
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingWeek, setSavingWeek] = useState<number | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showMobileOverview, setShowMobileOverview] = useState(false);
  const [mobileEditIndex, setMobileEditIndex] = useState(0);
  const [returnToOverview, setReturnToOverview] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const { data: statusData, error: statusError } = await supabase.rpc('get_game_pick_season_status', {
          target_season: 2026,
        });
        if (statusError) throw statusError;

        const nextStatus = ((statusData || [])[0] || null) as GamePickSeasonStatus | null;
        if (!nextStatus) throw new Error('The 2026 game-pick season is not configured yet.');
        if (!active) return;
        setStatus(nextStatus);

        if (!nextStatus.can_access) {
          setLoading(false);
          return;
        }

        const [{ data: gameRows, error: gamesError }, { data: pickRows, error: picksError }] = await Promise.all([
          supabase
            .from('game_pick_games')
            .select('id, week, opponent, short_name, logo_code, date_label, time_label, location, home, spotlight')
            .eq('season', 2026)
            .order('week', { ascending: true }),
          supabase
            .from('game_picks')
            .select('game_id, pick')
            .eq('user_id', user.id),
        ]);

        if (gamesError) throw gamesError;
        if (picksError) throw picksError;

        const mappedGames = ((gameRows || []) as GamePickGameRow[]).map(toScheduleGame);
        const gameById = new Map(mappedGames.map((game) => [game.id, game]));
        const mappedPicks = ((pickRows || []) as Array<{ game_id: string; pick: 'bears' | 'opponent' }>).reduce<Record<number, Pick>>(
          (result, row) => {
            const game = gameById.get(row.game_id);
            if (game) result[game.week] = row.pick === 'bears' ? 'win' : 'loss';
            return result;
          },
          {},
        );

        if (!active) return;
        const complete = mappedGames.length > 0 && Object.keys(mappedPicks).length === nextStatus.total_games;
        const firstOpenIndex = mappedGames.findIndex((game) => !mappedPicks[game.week]);
        setGames(mappedGames);
        setPicks(mappedPicks);
        setHasSaved(complete);
        setShowMobileOverview(complete || !nextStatus.can_edit);
        setMobileEditIndex(firstOpenIndex >= 0 ? firstOpenIndex : 0);
      } catch (loadError) {
        if (!active) return;
        console.error('Error loading game picks:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Could not load your game picks.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [showMobileOverview, mobileEditIndex]);

  const setPick = async (week: number, pick: Pick) => {
    if (!status?.can_edit || !user) return false;
    const game = games.find((item) => item.week === week);
    if (!game?.id) return false;

    const previousPick = picks[week];
    const wasComplete = Object.keys(picks).length === status.total_games;
    setError(null);
    setSavingWeek(week);
    setPicks((current) => ({ ...current, [week]: pick }));

    try {
      const { data, error: saveError } = await supabase.rpc('save_game_pick', {
        target_game_id: game.id,
        target_pick: pick === 'win' ? 'bears' : 'opponent',
      });
      if (saveError) throw saveError;

      const saveResult = ((data || [])[0] || null) as { forecast_complete?: boolean } | null;
      if (saveResult?.forecast_complete) {
        setHasSaved(true);
        if (!wasComplete) setShowSaved(true);
      }
      return true;
    } catch (saveError) {
      setPicks((current) => {
        const next = { ...current };
        if (previousPick) next[week] = previousPick;
        else delete next[week];
        return next;
      });
      console.error('Error saving game pick:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Your pick could not be saved. Please try again.');
      return false;
    } finally {
      setSavingWeek((current) => (current === week ? null : current));
    }
  };

  const wins = Object.values(picks).filter((pick) => pick === 'win').length;
  const losses = Object.values(picks).filter((pick) => pick === 'loss').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f5f1]">
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-bears-orange" />
        </div>
      </div>
    );
  }

  if (!status?.can_access) {
    return (
      <div className="min-h-screen bg-[#f7f5f1]">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
            <CalendarDays className="mx-auto h-10 w-10 text-bears-orange" />
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-bears-orange">2026 season picks</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-bears-navy">Game picks are coming soon</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm font-medium leading-6 text-slate-600">You’ll make one winner pick for all 17 Bears games before Week 1 kicks off.</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && games.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f5f1]">
        <Navbar />
        <main className="mx-auto max-w-xl px-4 py-20">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <AlertCircle className="h-6 w-6" />
            <h1 className="mt-3 text-xl font-black">Game picks could not load</h1>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  const readOnly = !status.can_edit;

  return (
    <div className="min-h-screen bg-[#f7f5f1]">
      <Navbar />

      <section className={`${showMobileOverview ? 'hidden lg:block' : ''} border-b border-white/10 bg-bears-navy px-4 py-8 text-white sm:py-10`}>
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">
              {status.state === 'draft' ? 'Admin preview · 2026 season picks' : '2026 season picks'}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Pick every Bears game</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300 sm:text-base">
              {readOnly
                ? 'Your game picks are locked for the season.'
                : 'Make your picks for all 17 games. Change them anytime before Week 1 kicks off.'}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{readOnly ? 'Pick status' : 'All picks lock'}</p>
            <p className="mt-1 text-sm font-black">{readOnly ? 'Locked' : 'Sep 13 · 12:00 PM CT'}</p>
          </div>
        </div>
      </section>

      <main className="px-4 py-7 sm:py-9">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {savingWeek && (
            <div className="mb-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Week {savingWeek}…
            </div>
          )}

          <div className="lg:hidden">
            {showMobileOverview ? (
              <MobilePicksOverview
                picks={picks}
                games={games}
                readOnly={readOnly}
                onEdit={readOnly ? undefined : (index) => {
                  setMobileEditIndex(index);
                  setReturnToOverview(true);
                  setShowMobileOverview(false);
                }}
              />
            ) : (
              <FocusMode
                key={`mobile-game-${mobileEditIndex}`}
                picks={picks}
                setPick={setPick}
                games={games}
                readOnly={readOnly}
                initialIndex={mobileEditIndex}
                onPickMade={returnToOverview ? () => {
                  setReturnToOverview(false);
                  setShowMobileOverview(true);
                } : undefined}
              />
            )}
          </div>
          <div className="hidden lg:block">
            <SeasonBoard picks={picks} setPick={setPick} games={games} hasSaved={hasSaved} readOnly={readOnly} showDesignNote={false} deadline={status.lock_at} />
          </div>
        </div>
      </main>

      {showSaved && (
        <ForecastSavedModal
          wins={wins}
          losses={losses}
          onClose={() => {
            setShowSaved(false);
            setShowMobileOverview(true);
          }}
        />
      )}
    </div>
  );
}

export function InlineGamePicker({ onAuthRequired }: { onAuthRequired: () => void }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<GamePickSeasonStatus | null>(null);
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [savedPicks, setSavedPicks] = useState<Record<number, Pick>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data: statusData, error: statusError } = await supabase.rpc('get_game_pick_season_status', { target_season: 2026 });
      if (statusError) {
        if (active) {
          setError(statusError.message);
          setLoading(false);
        }
        return;
      }
      const nextStatus = ((statusData || [])[0] || null) as GamePickSeasonStatus | null;
      if (!nextStatus) {
        if (active) {
          setError('The 2026 game-pick season is not configured yet.');
          setLoading(false);
        }
        return;
      }

      const { data: gameRows, error: gamesError } = await supabase
        .from('game_pick_games')
        .select('id, week, opponent, short_name, logo_code, date_label, time_label, location, home, spotlight')
        .eq('season', 2026)
        .order('week', { ascending: true });
      if (gamesError) {
        if (active) {
          setError(gamesError.message);
          setLoading(false);
        }
        return;
      }

      const mappedGames = ((gameRows || []) as GamePickGameRow[]).map(toScheduleGame);
      let persistedDraft: Record<number, Pick> | null = null;
      try {
        const rawDraft = localStorage.getItem(GAME_PICK_DRAFT_STORAGE_KEY);
        if (rawDraft) {
          const parsedDraft = JSON.parse(rawDraft) as Record<string, unknown>;
          const validWeeks = new Set(mappedGames.map((game) => game.week));
          const validatedDraft = Object.entries(parsedDraft).reduce<Record<number, Pick>>((result, [rawWeek, value]) => {
            const week = Number(rawWeek);
            if (validWeeks.has(week) && (value === 'win' || value === 'loss')) result[week] = value;
            return result;
          }, {});
          if (Object.keys(validatedDraft).length > 0) persistedDraft = validatedDraft;
        }
      } catch {
        localStorage.removeItem(GAME_PICK_DRAFT_STORAGE_KEY);
      }

      let mappedSavedPicks: Record<number, Pick> = {};
      if (user) {
        const { data: pickRows, error: picksError } = await supabase.from('game_picks').select('game_id, pick').eq('user_id', user.id);
        if (picksError) {
          if (active) {
            setError(picksError.message);
            setLoading(false);
          }
          return;
        }
        const gameById = new Map(mappedGames.map((game) => [game.id, game]));
        mappedSavedPicks = ((pickRows || []) as Array<{ game_id: string; pick: 'bears' | 'opponent' }>).reduce<Record<number, Pick>>((result, row) => {
          const game = gameById.get(row.game_id);
          if (game) result[game.week] = row.pick === 'bears' ? 'win' : 'loss';
          return result;
        }, {});
      }
      if (!active) return;
      setStatus(nextStatus);
      setGames(mappedGames);
      setSavedPicks(mappedSavedPicks);
      setPicks(persistedDraft || mappedSavedPicks);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user]);

  const setPick = (week: number, pick: Pick) => {
    setNotice(null);
    setPicks((current) => {
      const next = { ...current, [week]: pick };
      localStorage.setItem(GAME_PICK_DRAFT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const submit = async () => {
    if (!status?.can_edit || Object.keys(picks).length !== games.length) return;
    if (!user) {
      setNotice('Your picks are ready. Sign in or create an account to save them.');
      onAuthRequired();
      return;
    }
    setSubmitting(true);
    setError(null);
    const results = await Promise.all(games.map((game) => supabase.rpc('save_game_pick', {
      target_game_id: game.id,
      target_pick: picks[game.week] === 'win' ? 'bears' : 'opponent',
    })));
    const failed = results.find((result) => result.error);
    if (failed?.error) setError(failed.error.message);
    else {
      setSavedPicks({ ...picks });
      localStorage.removeItem(GAME_PICK_DRAFT_STORAGE_KEY);
      setNotice(null);
    }
    setSubmitting(false);
  };

  const hasSavedForecast = games.length > 0 && games.every((game) => Boolean(savedPicks[game.week]));
  const isDirty = games.some((game) => picks[game.week] !== savedPicks[game.week]);

  if (loading) return <div className="mt-5 flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-bears-orange" /></div>;
  if (error && games.length === 0) return <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>;
  if (!status?.can_access) return null;

  return (
    <div className="mt-5 rounded-[28px] bg-[#f7f5f1] p-3 sm:p-5">
      {notice && <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-bears-navy">{notice}</div>}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <SeasonBoard
        picks={picks}
        setPick={setPick}
        games={games}
        readOnly={!status.can_edit}
        hasSaved={hasSavedForecast}
        isDirty={isDirty}
        saveMode="manual"
        deadline={status.lock_at}
        showDesignNote={false}
        onSubmit={submit}
        submitting={submitting}
      />
    </div>
  );
}

export function GamePickerDeployPreview() {
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [hasSaved, setHasSaved] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showMobileOverview, setShowMobileOverview] = useState(false);
  const [mobileEditIndex, setMobileEditIndex] = useState(0);
  const [returnToOverview, setReturnToOverview] = useState(false);

  const setPick = (week: number, pick: Pick) => {
    const completesSeason = picks[week] === undefined && Object.keys(picks).length === schedule.length - 1;
    setPicks((current) => ({ ...current, [week]: pick }));
    if (completesSeason) {
      setHasSaved(true);
      setShowSaved(true);
    }
  };

  const wins = Object.values(picks).filter((pick) => pick === 'win').length;
  const losses = Object.values(picks).filter((pick) => pick === 'loss').length;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [showMobileOverview, mobileEditIndex]);

  return (
    <div className="min-h-screen bg-[#f7f5f1]">
      <Navbar />

      <section className={`${showMobileOverview ? 'hidden lg:block' : ''} border-b border-white/10 bg-bears-navy px-4 py-8 text-white sm:py-10`}>
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">2026 season picks</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Pick every Bears game</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300 sm:text-base">
              Make your picks for all 17 games. Change them anytime before Week 1 kicks off.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">All picks lock</p>
            <p className="mt-1 text-sm font-black">Sep 13 · 12:00 PM CT</p>
          </div>
        </div>
      </section>

      <main className="px-4 py-7 sm:py-9">
        <div className="mx-auto max-w-6xl">
          <div className="lg:hidden">
            {showMobileOverview ? (
              <MobilePicksOverview
                picks={picks}
                onEdit={(index) => {
                  setMobileEditIndex(index);
                  setReturnToOverview(true);
                  setShowMobileOverview(false);
                }}
              />
            ) : (
              <FocusMode
                key={`mobile-game-${mobileEditIndex}`}
                picks={picks}
                setPick={setPick}
                initialIndex={mobileEditIndex}
                onPickMade={returnToOverview ? () => {
                  setReturnToOverview(false);
                  setShowMobileOverview(true);
                } : undefined}
              />
            )}
          </div>
          <div className="hidden lg:block">
            <SeasonBoard picks={picks} setPick={setPick} hasSaved={hasSaved} />
          </div>
        </div>
      </main>

      {showSaved && (
        <ForecastSavedModal
          wins={wins}
          losses={losses}
          onClose={() => {
            setShowSaved(false);
            setShowMobileOverview(true);
          }}
        />
      )}
    </div>
  );
}

export function GamePickerMockups() {
  const [concept, setConcept] = useState<Concept>('board');
  const [picks, setPicks] = useState<Record<number, Pick>>(initialPicks);
  const activeNote = conceptNotes[concept];
  const pickedCount = Object.keys(picks).length;

  const setPick = (week: number, pick: Pick) => {
    setPicks((current) => ({ ...current, [week]: pick }));
  };

  const projectedRecord = useMemo(() => {
    const wins = Object.values(picks).filter((pick) => pick === 'win').length;
    return `${wins}–${pickedCount - wins}`;
  }, [pickedCount, picks]);

  return (
    <div className="min-h-screen bg-[#f7f5f1]">
      <Navbar />

      <section className="border-b border-white/10 bg-bears-navy px-4 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-orange-200">
                <Sparkles className="h-3.5 w-3.5" /> Interactive prototype
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">2026 Game Picker Lab</h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-300 sm:text-lg">
                Three ways Bears fans could complete all 17 season picks, see their projected record, and save every choice before Week 1.
              </p>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Picked</p>
                <p className="mt-1 text-2xl font-black">{pickedCount}/{schedule.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Forecast</p>
                <p className="mt-1 text-2xl font-black">{projectedRecord}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="px-4 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-3">
              {(Object.keys(conceptNotes) as Concept[]).map((key, index) => {
                const note = conceptNotes[key];
                const active = concept === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setConcept(key)}
                    className={`rounded-2xl p-4 text-left transition ${active ? 'bg-bears-navy text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-[0.16em] ${active ? 'text-orange-300' : 'text-slate-400'}`}>Concept 0{index + 1}</span>
                    <span className="mt-1 block text-base font-black">{note.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mb-6 mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-bears-orange">{activeNote.eyebrow}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-bears-navy">{activeNote.title}</h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600 sm:text-base">{activeNote.description}</p>
            </div>
            <button type="button" onClick={() => setPicks({})} className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50 sm:self-auto">
              <RotateCcw className="h-4 w-4" /> Reset prototype
            </button>
          </section>

          {concept === 'board' && <SeasonBoard picks={picks} setPick={setPick} />}
          {concept === 'focus' && <FocusMode picks={picks} setPick={setPick} />}
          {concept === 'review' && <ReviewSheet picks={picks} setPick={setPick} />}

          <section className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: ListChecks, title: 'One complete forecast', body: 'Require all 17 game choices before the season forecast is complete.' },
              { icon: CalendarDays, title: 'One season deadline', body: 'Every game locks together when the Bears begin Week 1—not at each game’s kickoff.' },
              { icon: Check, title: 'No confidence step', body: 'Game picks are simple Win/Loss calls. Confidence remains part of the season-question experience only.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Icon className="h-5 w-5 text-bears-orange" />
                <h3 className="mt-3 font-black text-bears-navy">{title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}

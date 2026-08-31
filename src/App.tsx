import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminProtectedRoute } from './components/AdminProtectedRoute';
import { Navbar } from './components/Navbar';
import { motion } from 'framer-motion';
import { Calendar, X } from 'lucide-react';
import { PredictionInterface } from './components/PredictionInterface';
import { Dashboard } from './components/Dashboard';
import { Leaderboard } from './components/Leaderboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminEmailDashboard } from './components/AdminEmailDashboard';
import { HowItWorks } from './components/HowItWorks';
import { useAuth } from './lib/auth';
import { AuthCallback } from './components/AuthCallback';
import { RegisterModal } from './components/RegisterModal';
import { LoginModal } from './components/LoginModal';
import { DebugPanel } from './components/DebugPanel';
import { AuthDebugPanel } from './components/AuthDebugPanel';
import { SiteFooter } from './components/SiteFooter';
import { ScrollToTop } from './components/ScrollToTop';
import { SeasonRecap } from './components/SeasonRecap';
import { UnsubscribeStatusPage } from './components/UnsubscribeStatusPage';
import { GamePicker, GamePickerDeployPreview, GamePickerMockups, InlineGamePicker } from './components/GamePickerMockups';
import { supabase } from './lib/supabase';
import {
  ANALYTICS_EVENTS,
  captureEmailAttributionDetected,
  captureEvent,
  capturePageView,
  registerEmailAttributionFromUrl,
} from './lib/analytics';
import { usePredictions } from './lib/PredictionContext';

const categories = [
  { id: 'all', label: 'All' },
  { id: 'qb', label: 'QB' },
  { id: 'rookies', label: 'Rookies' },
  { id: 'player_stats', label: 'Player Stats' },
  { id: 'team_stats', label: 'Team Stats' },
  { id: 'awards', label: 'Awards' },
  { id: 'playoffs', label: 'Playoffs' },
  { id: 'draft_predictions', label: 'Draft' }
];

const ONBOARDING_QUESTION_ID = 'f6a8dc28-c6d7-4ba2-9492-437292ec0d2f';
const ONBOARDING_NAME_PLACEHOLDERS = ['SmokingJay6', 'SexyRexy8', 'Iceman18'] as const;
const DASHBOARD_ONBOARDING_TIP_KEY = 'dashboard-onboarding-tip-pending';
const IS_2026_QUESTION_REVIEW = import.meta.env.VITE_2026_QUESTION_REVIEW === 'true';
const IS_2026_LIVE_PREVIEW = import.meta.env.VITE_2026_LIVE_PREVIEW === 'true';

type OnboardingStep = 'loading' | 'name' | 'prediction' | 'complete';
type PendingGamePicksNavigation =
  | { type: 'season'; value: number }
  | { type: 'category'; value: string };

function HomePage() {
  const { user } = useAuth();
  const { questions, userPredictions, loading: predictionsContextLoading } = usePredictions();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialSearchParams = new URLSearchParams(location.search);
  const initialSeasonParam = initialSearchParams.get('season');
  const initialCategoryParam = initialSearchParams.get('category');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(
    initialSeasonParam === '2025' || initialSeasonParam === '2026'
      ? Number(initialSeasonParam)
      : 2026
  );
  const [selectedCategory, setSelectedCategory] = useState(initialCategoryParam || 'all');
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('loading');
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameNotice, setDisplayNameNotice] = useState<string | null>(null);
  const [namePlaceholder, setNamePlaceholder] = useState(ONBOARDING_NAME_PLACEHOLDERS[0]);
  const [gamePicksAvailable, setGamePicksAvailable] = useState(false);
  const [showInlineGamePicks, setShowInlineGamePicks] = useState(false);
  const [gamePicksDirty, setGamePicksDirty] = useState(false);
  const [pendingGamePicksNavigation, setPendingGamePicksNavigation] = useState<PendingGamePicksNavigation | null>(null);
  const previousCategoryRef = useRef(selectedCategory);

  const onboardingQuestion = questions.find((question) => question.id === ONBOARDING_QUESTION_ID);
  const has2026Prediction = questions.some(
    (question) => question.season === 2026 && Boolean(userPredictions[question.id])
  );
  const hasTypedDisplayName = displayNameDraft.trim().length > 0;

  useEffect(() => {
    let active = true;

    const loadGamePickStatus = async () => {
      const { data, error } = await supabase.rpc('get_game_pick_season_status', {
        target_season: 2026,
      });
      if (error || !active) return;

      const status = (data || [])[0] as { can_access?: boolean; state?: string } | undefined;
      setGamePicksAvailable(Boolean(status?.can_access));
    };

    void loadGamePickStatus();
    return () => {
      active = false;
    };
  }, [user]);

  const getOnboardingStorageKey = useCallback((suffix: 'dismissed' | 'progress') => {
    if (!user) return null;
    return `home-onboarding:${suffix}:${user.id}`;
  }, [user]);

  const setOnboardingProgress = useCallback((value: 'name_complete') => {
    const key = getOnboardingStorageKey('progress');
    if (!key) return;
    localStorage.setItem(key, value);
  }, [getOnboardingStorageKey]);

  const getOnboardingProgress = useCallback(() => {
    const key = getOnboardingStorageKey('progress');
    if (!key) return null;
    return localStorage.getItem(key);
  }, [getOnboardingStorageKey]);

  const clearOnboardingProgress = useCallback(() => {
    const key = getOnboardingStorageKey('progress');
    if (!key) return;
    localStorage.removeItem(key);
  }, [getOnboardingStorageKey]);

  const dismissOnboarding = useCallback(() => {
    const dismissedKey = getOnboardingStorageKey('dismissed');
    if (dismissedKey) {
      localStorage.setItem(dismissedKey, 'true');
    }
    clearOnboardingProgress();
    setOnboardingStep('complete');
  }, [clearOnboardingProgress, getOnboardingStorageKey]);

  useEffect(() => {
    if (previousCategoryRef.current === selectedCategory) return;

    captureEvent(ANALYTICS_EVENTS.categoryFilterChanged, {
      category: selectedCategory,
      previous_category: previousCategoryRef.current,
      surface: 'home',
    });
    previousCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  const seasonQuestions = questions.filter((question) => question.season === selectedSeason);
  const visibleCategories = categories.filter((category) => {
    if (category.id === 'all') return true;
    return seasonQuestions.some((question) => question.category === category.id);
  });

  useEffect(() => {
    if (!visibleCategories.some((category) => category.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [selectedCategory, visibleCategories]);

  useEffect(() => {
    if (!user) {
      setOnboardingStep('complete');
      setDisplayNameDraft('');
      setDisplayNameNotice(null);
      return;
    }

    if (predictionsContextLoading) {
      return;
    }

    let isMounted = true;

    const loadOnboardingState = async () => {
      setOnboardingStep('loading');

      const { data, error } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      const dismissedKey = getOnboardingStorageKey('dismissed');
      const hasDismissedOnboarding = dismissedKey ? localStorage.getItem(dismissedKey) === 'true' : false;
      if (hasDismissedOnboarding) {
        clearOnboardingProgress();
        setOnboardingStep('complete');
        return;
      }

      if (error) {
        setDisplayNameDraft('');
        setOnboardingStep('name');
        return;
      }

      const savedDisplayName = (data?.display_name || '').trim();

      if (!savedDisplayName) {
        setDisplayNameDraft('');
        setOnboardingStep('name');
        return;
      }

      if (
        onboardingQuestion &&
        onboardingQuestion.season === 2026 &&
        onboardingQuestion.category === 'draft_predictions' &&
        onboardingQuestion.status === 'live' &&
        !has2026Prediction
      ) {
        setOnboardingStep('prediction');
        return;
      }

      setOnboardingStep('complete');
    };

    void loadOnboardingState();

    return () => {
      isMounted = false;
    };
  }, [
    clearOnboardingProgress,
    getOnboardingProgress,
    getOnboardingStorageKey,
    has2026Prediction,
    onboardingQuestion,
    predictionsContextLoading,
    user,
  ]);

  useEffect(() => {
    if (!user) {
      setNamePlaceholder(ONBOARDING_NAME_PLACEHOLDERS[0]);
      return;
    }

    const seed = user.id
      .split('')
      .reduce((total, char) => total + char.charCodeAt(0), 0);
    setNamePlaceholder(ONBOARDING_NAME_PLACEHOLDERS[seed % ONBOARDING_NAME_PLACEHOLDERS.length]);
  }, [user]);

  useEffect(() => {
    if (onboardingStep !== 'prediction') return;

    if (selectedSeason !== 2026) {
      setSelectedSeason(2026);
    }

    if (selectedCategory !== 'draft_predictions') {
      setSelectedCategory('draft_predictions');
    }
  }, [onboardingStep, selectedCategory, selectedSeason]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authAction = params.get('auth');
    const redirectPath = params.get('redirect');

    if (user && authAction === 'login' && redirectPath) {
      setIsRegisterModalOpen(false);
      setIsLoginModalOpen(false);
      navigate(redirectPath, { replace: true });
      return;
    }

    if (user || authAction !== 'login') return;

    setIsRegisterModalOpen(false);
    setIsLoginModalOpen(true);
  }, [location.search, navigate, user]);

  const handleDisplayNameSave = async () => {
    if (!user) return;

    const trimmedName = displayNameDraft.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setDisplayNameNotice('Name must be between 2 and 50 characters.');
      return;
    }

    try {
      setSavingDisplayName(true);
      setDisplayNameNotice(null);

      const { data: updatedRows, error: updateError } = await supabase
        .from('users')
        .update({ display_name: trimmedName })
        .eq('id', user.id)
        .select('id');

      if (updateError) throw updateError;

      if (!updatedRows || updatedRows.length === 0) {
        const { error: upsertError } = await supabase
          .from('users')
          .upsert(
            {
              id: user.id,
              email: user.email,
              display_name: trimmedName,
            },
            { onConflict: 'id' }
          );

        if (upsertError) throw upsertError;
      }

      captureEvent(ANALYTICS_EVENTS.displayNameSaved, {
        source: 'onboarding_home',
      });
      setOnboardingProgress('name_complete');

      if (
        onboardingQuestion &&
        onboardingQuestion.season === 2026 &&
        onboardingQuestion.category === 'draft_predictions' &&
        onboardingQuestion.status === 'live' &&
        !has2026Prediction
      ) {
        setOnboardingStep('prediction');
      } else {
        setOnboardingStep('complete');
      }
    } catch (err) {
      console.error('Error updating display name:', err);
      const errorCode =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      const errorMessage = err instanceof Error ? err.message : '';
      const isDuplicateName =
        errorCode === '23505' || /duplicate key value/i.test(errorMessage);

      setDisplayNameNotice(
        isDuplicateName
          ? 'That name is already taken. Try another one.'
          : 'Could not save your name right now.'
      );
      captureEvent(ANALYTICS_EVENTS.displayNameSaveFailed, {
        error_type: isDuplicateName ? 'duplicate_name' : 'unknown',
        source: 'onboarding_home',
      });
    } finally {
      setSavingDisplayName(false);
    }
  };

  const clearAuthSearchParams = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('auth');
    nextParams.delete('redirect');
    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: '/',
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true }
    );
  };

  const applyGamePicksNavigation = (destination: PendingGamePicksNavigation) => {
    if (destination.type === 'season') setSelectedSeason(destination.value);
    else setSelectedCategory(destination.value);
    setShowInlineGamePicks(false);
  };

  const requestGamePicksNavigation = (destination: PendingGamePicksNavigation) => {
    if (showInlineGamePicks && gamePicksDirty) {
      setPendingGamePicksNavigation(destination);
      return;
    }
    applyGamePicksNavigation(destination);
  };

  const renderTopicsControls = () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
          {[2025, 2026].map((season) => (
            <button
              key={season}
              type="button"
              onClick={() => requestGamePicksNavigation({ type: 'season', value: season })}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                selectedSeason === season
                  ? 'bg-bears-navy text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {season} Season
            </button>
          ))}
        </div>
      </div>

      <div className="relative border-b border-slate-200">
        <div className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-8 px-1 pr-14 sm:pr-4">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => requestGamePicksNavigation({ type: 'category', value: category.id })}
                className={`pb-3 text-base font-bold whitespace-nowrap transition-colors ${
                  !showInlineGamePicks && selectedCategory === category.id
                    ? 'border-b-2 border-bears-navy text-bears-navy'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {category.label}
              </button>
            ))}
            {selectedSeason === 2026 && (
              gamePicksAvailable ? (
                <button
                  type="button"
                  onClick={() => setShowInlineGamePicks(true)}
                  aria-pressed={showInlineGamePicks}
                  className={`pb-3 text-base font-bold whitespace-nowrap transition-colors ${
                    showInlineGamePicks
                      ? 'border-b-2 border-bears-orange text-bears-orange'
                      : 'text-slate-500 hover:text-bears-orange'
                  }`}
                >
                  Game Picks
                </button>
              ) : (
                <span className="flex items-center gap-2 pb-3 whitespace-nowrap text-slate-400">
                  <span className="text-base font-bold">Game Picks</span>
                  <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-yellow-900">
                    Coming Soon
                  </span>
                </span>
              )
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent sm:hidden" />
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-white">
      <Navbar 
        onRegisterClick={() => setIsRegisterModalOpen(true)}
      />

      <section className="border-b border-yellow-300 bg-yellow-200/95 px-4 py-2.5">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-3">
          {IS_2026_LIVE_PREVIEW ? (
            <div>
              <p className="text-center text-sm font-bold leading-tight text-yellow-900 sm:text-base">
                2026 Live Testing Preview
              </p>
              <p className="mt-0.5 text-center text-[11px] font-medium leading-tight text-yellow-900/85 sm:text-xs">
                Preview-only live status · Saved picks write to your production account
              </p>
            </div>
          ) : IS_2026_QUESTION_REVIEW ? (
            <div>
              <p className="text-center text-sm font-bold leading-tight text-yellow-900 sm:text-base">
                2026 Question Review Preview · Draft Data Only
              </p>
              <p className="mt-0.5 text-center text-[11px] font-medium leading-tight text-yellow-900/85 sm:text-xs">
                Regular-season scoring · Tied leaders count · “Someone else” covers unlisted players · All picks lock Sep 13 at noon CT
              </p>
            </div>
          ) : (
            <div>
              <p className="text-center text-sm font-bold leading-tight text-yellow-900 sm:text-base">
                The 2026 Predictions Are Live
              </p>
              <p className="mt-0.5 text-center text-[11px] font-medium leading-tight text-yellow-900/85 sm:text-xs">
                All picks lock Sep 13 at noon CT
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4 md:py-14 bg-bears-navy text-white">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">
            Bears Prediction Tracker
          </h1>
          <div className="space-y-5">
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Make your calls on the biggest questions for the{' '}
              <span className="animated-underline first">{selectedSeason} Bears season</span>.{' '}
              Back your predictions with{' '}
              <span className="animated-underline second">confidence</span> and 
              track your{' '}
              <span className="animated-underline third">accuracy</span> as 
              the season unfolds.
            </p>
            {!user && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  captureEvent(ANALYTICS_EVENTS.signupCtaClicked, { source: 'home_hero' });
                  setIsRegisterModalOpen(true);
                }}
                className="px-8 py-4 bg-bears-orange text-white text-lg font-semibold rounded-lg hover:bg-bears-orange/90 transition-colors"
              >
                Get Started Now
              </motion.button>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 pb-10 pt-7 sm:pt-9">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-6">
            {!showInlineGamePicks && user && onboardingStep === 'prediction' && onboardingQuestion && (
              <div className="rounded-[28px] border border-bears-orange/25 bg-gradient-to-r from-orange-50 via-amber-50 to-white p-5 shadow-[0_18px_40px_rgba(122,38,4,0.08)]">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#9a3412]">
                  Step 2 of 2
                </p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-bears-navy">
                  Make your first prediction
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-700 sm:text-base">
                  Start with the live 2026 draft question below. We&apos;ll guide you through the
                  deadline, answer choices, and confidence, then send you straight to
                  <span className="font-extrabold text-bears-navy"> My Predictions</span> once your pick is saved.
                </p>
              </div>
            )}
            {renderTopicsControls()}
            {selectedSeason === 2026 && showInlineGamePicks && gamePicksAvailable && (
              <InlineGamePicker
                onDirtyChange={setGamePicksDirty}
                onAuthRequired={() => {
                  captureEvent(ANALYTICS_EVENTS.loginCtaClicked, { source: 'inline_game_pick_save' });
                  setIsLoginModalOpen(true);
                }}
              />
            )}
            {!showInlineGamePicks && (
              <PredictionInterface
                selectedCategory={selectedCategory}
                selectedSeason={selectedSeason}
                highlightQuestionId={user && onboardingStep === 'prediction' ? ONBOARDING_QUESTION_ID : null}
                onPredictionSaved={(questionId) => {
                  if (questionId !== ONBOARDING_QUESTION_ID || onboardingStep !== 'prediction') {
                    return;
                  }

                  clearOnboardingProgress();
                  localStorage.setItem(DASHBOARD_ONBOARDING_TIP_KEY, 'true');
                  setOnboardingStep('complete');
                  navigate('/dashboard');
                }}
                autoOpenQuestionId={user && onboardingStep === 'prediction' ? ONBOARDING_QUESTION_ID : null}
                onboardingGuideActive={user && onboardingStep === 'prediction'}
                onOnboardingExit={dismissOnboarding}
                onQuestionSequenceComplete={() => {
                  if (selectedSeason !== 2026 || !gamePicksAvailable) return;
                  setSelectedCategory('all');
                  setShowInlineGamePicks(true);
                  window.setTimeout(() => {
                    document.getElementById('inline-game-picks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 80);
                }}
              />
            )}
          </div>
          
        </div>
      </section>

      {!user && (
        <section className="py-16 px-4 bg-bears-navy">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center mb-6">
              <Calendar className="w-12 h-12 text-bears-orange" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
              Sign up to save your predictions and follow each season
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-bears-orange text-white text-lg font-semibold rounded-lg hover:bg-bears-orange/90 transition-colors"
              onClick={() => {
                captureEvent(ANALYTICS_EVENTS.signupCtaClicked, { source: 'home_footer' });
                setIsRegisterModalOpen(true);
              }}
            >
              Get Started Now
            </motion.button>
          </div>
        </section>
      )}

      {pendingGamePicksNavigation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bears-navy/70 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-game-picks-title"
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.3)] sm:p-8"
          >
            <h2 id="unsaved-game-picks-title" className="text-2xl font-black tracking-tight text-bears-navy">
              You have unsaved picks
            </h2>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  const destination = pendingGamePicksNavigation;
                  setPendingGamePicksNavigation(null);
                  applyGamePicksNavigation(destination);
                }}
                className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Leave without saving
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setPendingGamePicksNavigation(null)}
                className="rounded-xl bg-bears-orange px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#a92f02]"
              >
                Keep editing
              </button>
            </div>
          </section>
        </div>
      )}

      <RegisterModal 
        isOpen={isRegisterModalOpen} 
        source="home_register"
        onClose={() => setIsRegisterModalOpen(false)}
        onSwitchToLogin={() => {
          setIsRegisterModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />

      <LoginModal 
        isOpen={isLoginModalOpen}
        source="home_login"
        onClose={() => {
          setIsLoginModalOpen(false);
          if (searchParams.get('auth') === 'login') {
            clearAuthSearchParams();
          }
        }}
        onSwitchToRegister={() => {
          setIsLoginModalOpen(false);
          setIsRegisterModalOpen(true);
        }}
      />

      <DebugPanel />
      <AuthDebugPanel />

      {user && onboardingStep === 'name' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="px-6 py-8 sm:px-10 sm:py-10">
                <div className="flex items-start justify-end">
                  <button
                    type="button"
                    onClick={dismissOnboarding}
                    className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Close onboarding"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
                  What should we call you?
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                  Pick the name Bears fans will know you by. You can always change it later.
                </p>
                <label className="mt-8 block text-sm font-bold text-slate-700" htmlFor="onboarding-display-name">
                  Name
                </label>
                <input
                  id="onboarding-display-name"
                  type="text"
                  value={displayNameDraft}
                  onChange={(event) => setDisplayNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleDisplayNameSave();
                    }
                  }}
                  placeholder={namePlaceholder}
                  className="mt-3 w-full rounded-2xl border border-slate-300 px-5 py-4 text-xl font-semibold text-slate-900 outline-none transition focus:border-bears-orange focus:ring-2 focus:ring-bears-orange/20"
                  autoFocus
                />
                {displayNameNotice && (
                  <p className="mt-3 text-sm font-semibold text-red-700">{displayNameNotice}</p>
                )}
                <button
                  type="button"
                  onClick={() => void handleDisplayNameSave()}
                  disabled={savingDisplayName}
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-lg font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    hasTypedDisplayName
                      ? 'bg-[#d53f16] hover:bg-[#bf3812]'
                      : 'bg-[#ee9b7f] hover:bg-[#e78b6a]'
                  }`}
                >
                  {savingDisplayName ? 'Saving...' : 'Next'}
                </button>
              </div>

              <div className="hidden bg-[#f7efe7] lg:flex lg:flex-col lg:justify-center lg:px-10">
                <div className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    Leaderboard Preview
                  </p>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="text-sm font-bold text-slate-500">1</span>
                      <span className="text-sm font-semibold text-slate-900">DitkaMode</span>
                      <span className="text-sm font-bold text-bears-navy">9</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-bears-orange/30 bg-orange-50 px-4 py-3">
                      <span className="text-sm font-bold text-[#9a3412]">2</span>
                      <span className="text-sm font-extrabold text-slate-950">
                        {displayNameDraft.trim() || 'Your name here'}
                      </span>
                      <span className="text-sm font-bold text-bears-navy">8</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="text-sm font-bold text-slate-500">3</span>
                      <span className="text-sm font-semibold text-slate-900">MonstersOfMidway</span>
                      <span className="text-sm font-bold text-bears-navy">8</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRouteName(pathname: string) {
  if (pathname === '/') return 'home';
  if (pathname === '/season-recap') return 'season_recap';
  if (pathname === '/auth/callback') return 'auth_callback';
  if (pathname === '/how-it-works') return 'how_it_works';
  if (pathname === '/email/unsubscribed') return 'email_unsubscribed';
  if (pathname === '/dashboard') return 'dashboard';
  if (pathname === '/leaderboard') return 'leaderboard';
  if (pathname === '/game-picks') return 'game_picks';
  if (pathname === '/admin') return 'admin';
  if (pathname === '/admin/email') return 'admin_email';
  return 'unknown';
}

function AnalyticsRouteTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const lastAttributionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const attribution = registerEmailAttributionFromUrl();
    const attributionKey = attribution ? JSON.stringify(attribution) : null;

    if (attribution && attributionKey !== lastAttributionKeyRef.current) {
      captureEmailAttributionDetected({
        ...attribution,
        landing_path: `${location.pathname}${location.search}`,
        is_authenticated: Boolean(user),
      });
      lastAttributionKeyRef.current = attributionKey;
    }

    capturePageView(getRouteName(location.pathname), {
      is_authenticated: Boolean(user),
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      ...attribution,
    });
  }, [location.pathname, location.search, user]);

  return null;
}

export function AppComponent() {
  return (
    <>
      <ScrollToTop />
      <AnalyticsRouteTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/season-recap" element={<SeasonRecap />} />
        <Route path="/email/unsubscribed" element={<UnsubscribeStatusPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/game-picker-mockups" element={<GamePickerMockups />} />
        <Route path="/game-picks-preview" element={<GamePickerDeployPreview />} />
        <Route
          path="/game-picks"
          element={
            <ProtectedRoute>
              <GamePicker />
            </ProtectedRoute>
          }
        />
        <Route
          path="/predictions"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/email"
          element={
            <AdminProtectedRoute>
              <AdminEmailDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SiteFooter />
    </>
  );
}

export default AppComponent;

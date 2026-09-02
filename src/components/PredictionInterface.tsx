import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertCircle, LogIn, Clock, Star, ChevronLeft, ChevronRight, ChevronDown, CalendarClock, CheckCircle, CircleDot, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { usePredictions } from '../lib/PredictionContext';
import { formatDistanceToNow, isPast } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoginModal } from './LoginModal';
import { RegisterModal } from './RegisterModal';
import type { Question } from '../lib/PredictionContext';
import { PredictionEditorModal } from './PredictionEditorModal';
import { ANALYTICS_EVENTS, captureEvent } from '../lib/analytics';
import { formatCentralDeadline } from '../lib/utils';

interface PredictionInterfaceProps {
  selectedCategory?: string;
  selectedSeason?: number;
  highlightQuestionId?: string | null;
  onPredictionSaved?: (questionId: string) => void;
  autoOpenQuestionId?: string | null;
  onboardingGuideActive?: boolean;
  onOnboardingExit?: () => void;
  onQuestionSequenceComplete?: () => void;
}

const CARD_STYLE: {
  cardClassName: string;
  featuredClassName: string;
  mediaClassName: string;
  imageClassName: string;
  iconClassName: string;
  fallbackIconClassName: string;
  dividerClassName: string;
  panelClassName: string;
  actionButtonClassName: string;
} = {
  cardClassName: 'rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)] sm:p-5',
  featuredClassName: 'border-bears-orange/60 shadow-[0_18px_42px_rgba(122,38,4,0.18),0_0_0_1px_rgba(200,56,3,0.12)_inset]',
  mediaClassName: 'h-16 w-16 rounded-2xl border border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]',
  imageClassName: 'h-full w-full object-cover',
  iconClassName: 'h-9 w-9 text-bears-navy sm:h-10 sm:w-10',
  fallbackIconClassName: 'h-7 w-7 text-bears-navy sm:h-8 sm:w-8',
  dividerClassName: 'border-t border-slate-200/90',
  panelClassName: 'rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_10px_22px_rgba(15,23,42,0.08)]',
  actionButtonClassName: 'rounded-xl shadow-[0_10px_20px_rgba(15,23,42,0.18)]',
};

export function PredictionInterface({
  selectedCategory = 'all',
  selectedSeason = 2025,
  highlightQuestionId = null,
  onPredictionSaved,
  autoOpenQuestionId = null,
  onboardingGuideActive = false,
  onOnboardingExit,
  onQuestionSequenceComplete,
}: PredictionInterfaceProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    questions,
    aggregatedPredictions, 
    userPredictions, 
    loading: predictionsLoading,
    questionAssets,
    error: contextError,
    makePrediction: makeContextPrediction
  } = usePredictions();
  
  const [selectedPrediction, setSelectedPrediction] = useState<string | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<'low' | 'medium' | 'high' | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [successMessages, setSuccessMessages] = useState<Record<string, boolean>>({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedChoiceRows, setExpandedChoiceRows] = useState<Record<string, boolean>>({});
  const [confidenceSentiment, setConfidenceSentiment] = useState<
    Record<string, { score: number; label: 'Low' | 'Medium' | 'High' }>
  >({});
  const [confidenceSentimentLoading, setConfidenceSentimentLoading] = useState(false);
  const viewedQuestionIdsRef = useRef<Set<string>>(new Set());
  const previousPageRef = useRef(currentPage);
  const handledQuestionParamRef = useRef<string | null>(null);
  const autoOpenedQuestionRef = useRef<string | null>(null);

  const questionsById = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question])),
    [questions]
  );

  const predictionAuthRedirectPath = useMemo(() => {
    if (!selectedPrediction) return undefined;

    const question = questionsById[selectedPrediction];
    if (!question) return undefined;

    // The question query parameter is removed after opening the editor so the
    // browser URL stays tidy. Rebuild the deep link here so password and OAuth
    // sign-ins return readers to the exact question that prompted authentication.
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('auth');
    searchParams.delete('redirect');
    searchParams.set('season', String(question.season));
    searchParams.set('category', question.category);
    searchParams.set('question', question.id);

    return `${location.pathname}?${searchParams.toString()}`;
  }, [location.pathname, location.search, questionsById, selectedPrediction]);

  const deriveConfidenceLabel = (score: number): 'Low' | 'Medium' | 'High' => {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  const parseConfidenceLabel = useCallback(
    (value: unknown, score: number): 'Low' | 'Medium' | 'High' => {
      if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        if (normalized === 'high') return 'High';
        if (normalized === 'medium') return 'Medium';
        if (normalized === 'low') return 'Low';
      }
      return deriveConfidenceLabel(score);
    },
    []
  );

  const openPredictionModal = useCallback((questionId: string) => {
    const existingPrediction = userPredictions[questionId];
    const question = questionsById[questionId];
    captureEvent(ANALYTICS_EVENTS.predictionStarted, {
      question_id: questionId,
      category: question?.category,
      question_type: question?.question_type,
      source_surface: 'prediction_interface_button',
      has_existing_prediction: Boolean(existingPrediction),
    });

    setSelectedPrediction(questionId);
    setSelectedValue(existingPrediction?.prediction ?? null);
    setSelectedConfidence(existingPrediction?.confidence ?? null);
    setShowAuthPrompt(false);
    setError(null);
  }, [questionsById, userPredictions]);

  const fetchConfidenceSentiment = useCallback(async () => {
    const seasonQuestions = questions.filter((question) => question.season === selectedSeason);

    if (seasonQuestions.length === 0) {
      setConfidenceSentiment({});
      setConfidenceSentimentLoading(false);
      return;
    }

    setConfidenceSentimentLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_question_confidence_sentiment', {
        target_season: selectedSeason,
      });
      if (rpcError) throw rpcError;

      const byQuestion = ((data as Array<Record<string, unknown>>) || []).reduce<
        Record<string, { score: number; label: 'Low' | 'Medium' | 'High' }>
      >((acc, row) => {
        const questionId = typeof row.question_id === 'string' ? row.question_id : null;
        if (!questionId) return acc;

        const rawScore = Number(row.meter_percent);
        if (!Number.isFinite(rawScore)) return acc;

        const score = Math.min(Math.max(rawScore, 0), 100);
        acc[questionId] = {
          score,
          label: parseConfidenceLabel(row.sentiment_label ?? row.confidence_label, score),
        };
        return acc;
      }, {});

      setConfidenceSentiment(byQuestion);
    } catch (rpcErr) {
      console.error('Error fetching confidence sentiment:', rpcErr);
      setConfidenceSentiment({});
    }

    setConfidenceSentimentLoading(false);
  }, [parseConfidenceLabel, questions, selectedSeason]);

  const seasonQuestions = questions.filter((question) => question.season === selectedSeason);
  const answerableSeasonQuestions = seasonQuestions.filter(
    (question) => question.status === 'live' && !isPast(new Date(question.deadline))
  );
  const filteredQuestions = selectedCategory === 'all'
    ? seasonQuestions
    : seasonQuestions.filter((question) => question.category === selectedCategory);
  const cardsPerPage = 3;
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / cardsPerPage));
  const pagedQuestions = filteredQuestions.slice(
    (currentPage - 1) * cardsPerPage,
    currentPage * cardsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedSeason]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (previousPageRef.current === currentPage) return;

    captureEvent(ANALYTICS_EVENTS.paginationChanged, {
      surface: 'prediction_interface',
      page_number: currentPage,
      previous_page: previousPageRef.current,
      category: selectedCategory,
    });
    previousPageRef.current = currentPage;
  }, [currentPage, selectedCategory]);

  useEffect(() => {
    void fetchConfidenceSentiment();
  }, [fetchConfidenceSentiment, aggregatedPredictions]);

  useEffect(() => {
    pagedQuestions.forEach((question, index) => {
      if (viewedQuestionIdsRef.current.has(question.id)) return;

      viewedQuestionIdsRef.current.add(question.id);
      captureEvent(ANALYTICS_EVENTS.predictionCardViewed, {
        question_id: question.id,
        category: question.category,
        question_type: question.question_type,
        position: index + 1 + (currentPage - 1) * cardsPerPage,
      });
    });
  }, [cardsPerPage, currentPage, pagedQuestions]);

  useEffect(() => {
    if (!selectedPrediction || showAuthPrompt) return;

    const question = questionsById[selectedPrediction];
    if (!question) return;

    captureEvent(ANALYTICS_EVENTS.predictionEditorOpened, {
      question_id: question.id,
      category: question.category,
      source_surface: 'prediction_interface',
      locked_state: isPast(new Date(question.deadline)),
    });
  }, [questionsById, selectedPrediction, showAuthPrompt]);

  useEffect(() => {
    if (!selectedPrediction || !showAuthPrompt) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPrediction(null);
        setShowAuthPrompt(false);
        setSelectedValue(null);
        setSelectedConfidence(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedPrediction, showAuthPrompt]);

  useEffect(() => {
    if (!autoOpenQuestionId || !onboardingGuideActive) {
      autoOpenedQuestionRef.current = null;
      return;
    }

    if (autoOpenedQuestionRef.current === autoOpenQuestionId) {
      return;
    }

    const targetQuestion = filteredQuestions.find((question) => question.id === autoOpenQuestionId);
    if (!targetQuestion) {
      return;
    }

    autoOpenedQuestionRef.current = autoOpenQuestionId;
    openPredictionModal(autoOpenQuestionId);
  }, [autoOpenQuestionId, filteredQuestions, onboardingGuideActive, openPredictionModal]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const questionId = searchParams.get('question');

    if (!questionId) {
      handledQuestionParamRef.current = null;
      return;
    }

    if (handledQuestionParamRef.current === questionId) {
      return;
    }

    const targetIndex = filteredQuestions.findIndex((question) => question.id === questionId);
    if (targetIndex === -1) {
      return;
    }

    const targetPage = Math.floor(targetIndex / cardsPerPage) + 1;
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }

    const existingPrediction = userPredictions[questionId];
    setSelectedPrediction(questionId);
    setSelectedValue(existingPrediction?.prediction ?? null);
    setSelectedConfidence(existingPrediction?.confidence ?? null);
    setShowAuthPrompt(false);
    setError(null);
    handledQuestionParamRef.current = questionId;

    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete('question');
    navigate(
      {
        pathname: location.pathname,
        search: nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : '',
      },
      { replace: true }
    );
  }, [cardsPerPage, currentPage, filteredQuestions, location.pathname, location.search, navigate, userPredictions]);

  if (predictionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-bears-orange" />
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{contextError}</span>
      </div>
    );
  }

  if (!filteredQuestions || filteredQuestions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No questions available for this category.</p>
      </div>
    );
  }

  const calculatePercentages = (questionId: string, question: Question): Record<string, number> => {
    const data = aggregatedPredictions[questionId];
    if (!data || data.total === 0) {
      if (question.question_type === 'yes_no') {
        return { yes: 0, no: 0 };
      }
      return question.choices?.reduce((acc, choice) => ({
        ...acc,
        [choice.text]: 0
      }), {}) || {};
    }

    if (question.question_type === 'yes_no') {
      return {
        yes: Math.round((Number(data.yes || 0) / data.total) * 100),
        no: Math.round((Number(data.no || 0) / data.total) * 100)
      };
    }

    return question.choices?.reduce((acc, choice) => ({
      ...acc,
      [choice.text]: Math.round((Number(data[choice.text] || 0) / data.total) * 100)
    }), {}) || {};
  };

  const handlePrediction = async (questionId: string, prediction: string, confidence: 'low' | 'medium' | 'high') => {
    const question = questionsById[questionId];
    const wasEdit = Boolean(userPredictions[questionId]);
    if (!user) {
      captureEvent(ANALYTICS_EVENTS.predictionAuthGateHit, {
        question_id: questionId,
        category: question?.category,
      });
      setShowAuthPrompt(true);
      return;
    }

    setLoading(prev => ({ ...prev, [questionId]: true }));
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      if (!session) {
        throw new Error('No active session');
      }

      await makeContextPrediction(questionId, prediction, confidence);

      captureEvent(ANALYTICS_EVENTS.predictionSubmitted, {
        question_id: questionId,
        category: question?.category,
        question_type: question?.question_type,
        prediction_value: prediction,
        confidence,
        is_edit: wasEdit,
      });

      setSuccessMessages(prev => ({ ...prev, [questionId]: true }));
      setSelectedValue(null);
      setSelectedConfidence(null);
      onPredictionSaved?.(questionId);

      if (onboardingGuideActive) {
        setSelectedPrediction(null);
        return;
      }

      const currentIndex = answerableSeasonQuestions.findIndex((item) => item.id === questionId);
      const orderedCandidates = currentIndex >= 0
        ? [
            ...answerableSeasonQuestions.slice(currentIndex + 1),
            ...answerableSeasonQuestions.slice(0, currentIndex),
          ]
        : answerableSeasonQuestions;
      const nextQuestion = orderedCandidates.find(
        (item) => item.id !== questionId && !userPredictions[item.id]
      );

      if (nextQuestion) {
        setSelectedPrediction(nextQuestion.id);
        setShowAuthPrompt(false);
        setError(null);
      } else {
        setSelectedPrediction(null);
        onQuestionSequenceComplete?.();
      }

    } catch (err) {
      console.error('Error saving prediction:', err);
      captureEvent(ANALYTICS_EVENTS.predictionSubmitFailed, {
        question_id: questionId,
        category: question?.category,
        error_type: err instanceof Error ? err.message : 'unknown',
      });
      if (err instanceof Error) {
        if (err.message === 'No active session') {
          setShowAuthPrompt(true);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to save prediction');
      }
    } finally {
      setLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleClose = () => {
    setSelectedPrediction(null);
    setShowAuthPrompt(false);
    setSelectedValue(null);
    setSelectedConfidence(null);
  };

  const openPredictionWithValue = (questionId: string, value: string) => {
    const question = questionsById[questionId];
    captureEvent(ANALYTICS_EVENTS.predictionStarted, {
      question_id: questionId,
      category: question?.category,
      question_type: question?.question_type,
      source_surface: 'prediction_interface_quick_pick',
      prediction_value: value,
    });
    setSelectedPrediction(questionId);
    setSelectedValue(value);
    setSelectedConfidence(null);
    setShowAuthPrompt(false);
    setError(null);
  };

  const renderPredictionStats = (question: Question) => {
    const percentages = calculatePercentages(question.id, question);
    const isLoading = aggregatedPredictions[question.id]?.loading;

    if (question.question_type === 'yes_no') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-bears-navy">Yes</span>
              <span className="text-sm text-gray-600">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `${percentages.yes}%`
                )}
              </span>
            </div>
            <div className="h-2 bg-bears-navy/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentages.yes}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-bears-navy"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-bears-orange">No</span>
              <span className="text-sm text-gray-600">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `${percentages.no}%`
                )}
              </span>
            </div>
            <div className="h-2 bg-bears-orange/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentages.no}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-bears-orange"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {question.choices?.map((choice) => {
          const percentage = percentages[choice.text] || 0;
          return (
            <div key={choice.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-bears-navy">{choice.text}</span>
                <span className="text-sm text-gray-600">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    `${percentage}%`
                  )}
                </span>
              </div>
              <div className="h-2 bg-bears-navy/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-bears-navy"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPagerControls = (extraClassName?: string) => (
    <div className={`mb-4 flex items-center justify-end gap-3 ${extraClassName ?? ''}`}>
      <button
        type="button"
        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
        disabled={currentPage === 1}
        className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous card page"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold text-slate-600">
        {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
        disabled={currentPage === totalPages}
        className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next card page"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {filteredQuestions.length > cardsPerPage && renderPagerControls()}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {pagedQuestions.map((question) => {
          const hasPredicted = userPredictions[question.id];
          const isHighlightedQuestion = highlightQuestionId === question.id;
          const totalVotes = aggregatedPredictions[question.id]?.total || 0;
          const asset = questionAssets[question.id];
          const isExpired = isPast(new Date(question.deadline));
          const canAnswer = question.status === 'live' && !isExpired;
          const percentages = calculatePercentages(question.id, question);
          const displayStatus = question.status === 'completed'
            ? 'final'
            : question.status === 'pending'
            ? 'coming-soon'
            : isExpired
            ? 'locked'
            : 'live';
          const statusConfig = {
            live: {
              className: 'bg-emerald-50 text-emerald-700',
              icon: CircleDot,
              text: 'LIVE',
            },
            'coming-soon': {
              className: 'bg-amber-50 text-amber-700',
              icon: CalendarClock,
              text: 'COMING SOON',
            },
            locked: {
              className: 'bg-slate-100 text-slate-700',
              icon: Lock,
              text: 'LOCKED',
            },
            final: {
              className: 'bg-blue-50 text-blue-700',
              icon: CheckCircle,
              text: 'FINAL',
            },
          }[displayStatus];
          const StatusIcon = statusConfig.icon;
          const deadlineLabel = formatCentralDeadline(question.deadline, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            year: undefined,
          });
          const topChoices = question.question_type === 'multiple_choice'
            ? (question.choices || [])
                .map((choice) => ({
                  text: choice.text,
                  percentage: percentages[choice.text] || 0
                }))
                .sort((a, b) => b.percentage - a.percentage)
                
            : [];
          const isExpanded = Boolean(expandedChoiceRows[question.id]);
          const visibleChoices = question.question_type === 'multiple_choice'
            ? topChoices.slice(0, isExpanded ? topChoices.length : 3)
            : [];
          const hiddenChoiceCount = question.question_type === 'multiple_choice'
            ? Math.max(topChoices.length - 3, 0)
            : 0;
          const confidence = confidenceSentiment[question.id];
          const meterPosition = confidence ? Math.min(Math.max(confidence.score, 2), 98) : 50;
          const confidencePercent = confidence ? Math.round(confidence.score) : null;
          const confidenceLabel = confidence
            ? confidence.label
            : confidenceSentimentLoading
            ? 'Loading'
            : totalVotes === 0
            ? 'No picks yet'
            : 'Unavailable';
          const showFeaturedTreatment = question.featured && question.season !== 2026;

          return (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              data-onboarding-question={isHighlightedQuestion ? 'true' : undefined}
              className={`${CARD_STYLE.cardClassName} ${
                showFeaturedTreatment
                  ? CARD_STYLE.featuredClassName
                  : ''
              } ${isHighlightedQuestion ? 'ring-2 ring-bears-orange ring-offset-2 ring-offset-white' : ''}`}
            >
              {isHighlightedQuestion && (
                <div className="mb-4 rounded-2xl border border-bears-orange/30 bg-gradient-to-r from-orange-50 via-amber-50 to-white p-3 shadow-[0_8px_20px_rgba(122,38,4,0.08)]">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#9a3412]">
                    Step 2
                  </p>
                  <h3 className="mt-1 text-sm font-extrabold text-bears-navy sm:text-base">
                    Make your first Bears prediction
                  </h3>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-700 sm:text-sm">
                    The real prediction modal will guide you through this one.
                  </p>
                </div>
              )}

              {showFeaturedTreatment && (
                <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-bears-orange/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#7a2604]">
                  <Star className="h-3.5 w-3.5" />
                  Featured
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 overflow-hidden ${asset?.mediaClassName ?? CARD_STYLE.mediaClassName}`}>
                  {asset?.image ? (
                    <img
                      src={asset.image}
                      alt={question.text}
                      className={asset.imageClassName ?? CARD_STYLE.imageClassName}
                      loading="eager"
                      decoding="sync"
                    />
                  ) : asset?.icon ? (
                    <div className="flex h-full w-full items-center justify-center bg-bears-navy/5">
                      <asset.icon className={CARD_STYLE.iconClassName} />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-bears-navy/5">
                      <Star className={CARD_STYLE.fallbackIconClassName} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-snug text-bears-navy sm:text-[17px]">
                    {question.text}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusConfig.className}`}>
                      <StatusIcon className="h-3 w-3" aria-hidden="true" />
                      {statusConfig.text}
                    </span>
                    {displayStatus === 'locked' && (
                      <span className="text-[11px] font-medium text-slate-500">Results pending</span>
                    )}
                    {canAnswer && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(question.deadline), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    Deadline {deadlineLabel}
                  </p>
                </div>
              </div>

              <div className={`mt-4 pt-4 ${CARD_STYLE.dividerClassName}`}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Fan Volume ({totalVotes.toLocaleString()} picks)
                </p>

                {question.question_type === 'yes_no' ? (
                  <div className="mt-2 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => canAnswer && openPredictionWithValue(question.id, 'yes')}
                          disabled={!canAnswer}
                          className={`rounded-full border px-2.5 py-1 font-bold transition ${
                            !canAnswer
                              ? 'cursor-not-allowed border-slate-200 text-slate-400'
                              : 'border-bears-navy/30 text-bears-navy hover:bg-bears-navy/5'
                          }`}
                        >
                          Yes
                        </button>
                        <span className="font-bold text-slate-700">{percentages.yes}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentages.yes}%` }}
                          transition={{ duration: 0.45 }}
                          className="h-full bg-bears-navy"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => canAnswer && openPredictionWithValue(question.id, 'no')}
                          disabled={!canAnswer}
                          className={`rounded-full border px-2.5 py-1 font-bold transition ${
                            !canAnswer
                              ? 'cursor-not-allowed border-slate-200 text-slate-400'
                              : 'border-bears-orange/35 text-[#7a2604] hover:bg-bears-orange/5'
                          }`}
                        >
                          No
                        </button>
                        <span className="font-bold text-slate-700">{percentages.no}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentages.no}%` }}
                          transition={{ duration: 0.45 }}
                          className="h-full bg-bears-orange"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-3">
                    {visibleChoices.map((choice) => (
                      <div key={choice.text} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => canAnswer && openPredictionWithValue(question.id, choice.text)}
                            disabled={!canAnswer}
                            className={`rounded-full border px-2.5 py-1 font-bold transition ${
                              !canAnswer
                                ? 'cursor-not-allowed border-slate-200 text-slate-400'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {choice.text}
                          </button>
                          <span className="font-bold text-slate-700">{choice.percentage}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${choice.percentage}%` }}
                            transition={{ duration: 0.45 }}
                            className="h-full bg-bears-navy"
                          />
                        </div>
                      </div>
                    ))}
                    {hiddenChoiceCount > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedChoiceRows((prev) => ({
                              ...prev,
                              [question.id]: !prev[question.id],
                            }))
                          }
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-bears-orange/12 px-3 py-1.5 text-[11px] font-bold text-[#9a3412] transition hover:bg-bears-orange/20"
                        >
                          {isExpanded ? 'Show fewer' : 'Show all'}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    )}
                    {topChoices.length === 0 && renderPredictionStats(question)}
                  </div>
                )}
              </div>

              <div className={`mt-4 ${CARD_STYLE.panelClassName}`}>
                <div className="flex items-center justify-between text-xs">
                  <div className="group relative">
                    <p
                      className="cursor-help font-bold uppercase tracking-wide text-slate-600"
                      tabIndex={0}
                      aria-label="Fan Confidence Index info"
                    >
                      Fan Confidence Index
                    </p>
                    <span className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold normal-case tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      Aggregate measure of how confident fans are in this prediction.
                    </span>
                  </div>
                  <p className="font-extrabold text-slate-800">{confidenceLabel}</p>
                </div>
                <div
                  className="group relative mt-2 h-2 overflow-visible rounded-full bg-gradient-to-r from-slate-400 via-amber-400 to-emerald-500"
                  title={confidencePercent !== null ? `Fan conviction: ${confidencePercent}%` : 'Fan conviction unavailable'}
                >
                  {confidencePercent !== null && (
                    <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      {confidencePercent}%
                    </span>
                  )}
                  <motion.div
                    initial={{ left: 0 }}
                    animate={{ left: `${meterPosition}%` }}
                    transition={{ duration: 0.4 }}
                    className={`absolute top-0 h-2 ${confidence ? '' : 'opacity-40'}`}
                  >
                    <span className="absolute -top-1.5 h-5 w-0.5 bg-slate-900" />
                  </motion.div>
                </div>
                {!confidence && (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {confidenceSentimentLoading
                      ? 'Loading conviction data'
                      : totalVotes === 0
                      ? 'No conviction data yet'
                      : 'Conviction unavailable'}
                  </p>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openPredictionModal(question.id)}
                  className={`flex-1 px-3 py-2 text-xs font-bold transition ${CARD_STYLE.actionButtonClassName} ${
                    !canAnswer
                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      : hasPredicted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-bears-navy text-white hover:bg-bears-navy/90'
                  }`}
                >
                  {question.status === 'pending'
                    ? 'View Details'
                    : !canAnswer
                    ? 'View Results'
                    : hasPredicted
                    ? 'Edit Prediction'
                    : 'Make Prediction'}
                </button>
              </div>

              <AnimatePresence>
                {successMessages[question.id] && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2 text-center text-xs font-semibold text-emerald-700"
                  >
                    Prediction saved successfully.
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {filteredQuestions.length > cardsPerPage && renderPagerControls('mt-4 md:hidden')}

      <AnimatePresence>
        {selectedPrediction && showAuthPrompt && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 z-40 bg-slate-900/35"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={handleClose}
            >
              <div
                className="mx-auto w-full max-w-[500px] rounded-3xl bg-white p-5 text-center shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <LogIn className="mx-auto mb-4 h-12 w-12 text-bears-orange" />
                <h2 className="mb-4 text-2xl font-bold text-bears-navy">
                  Sign In to Make Predictions
                </h2>
                <p className="mb-6 text-gray-600">
                  Join the Bears prediction community to save your predictions and compete with other fans!
                </p>
                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      handleClose();
                      captureEvent(ANALYTICS_EVENTS.loginCtaClicked, {
                        source: 'prediction_auth_gate',
                      });
                      setShowLoginModal(true);
                    }}
                    className="w-full rounded-lg bg-bears-navy py-3 text-white transition-colors hover:bg-bears-navy/90"
                  >
                    Sign In
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      handleClose();
                      captureEvent(ANALYTICS_EVENTS.signupCtaClicked, {
                        source: 'prediction_auth_gate',
                      });
                      setShowRegisterModal(true);
                    }}
                    className="w-full rounded-lg bg-bears-orange py-3 text-white transition-colors hover:bg-bears-orange/90"
                  >
                    Create Account
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PredictionEditorModal
        isOpen={!!selectedPrediction && !showAuthPrompt}
        question={selectedPrediction ? questions.find((q) => q.id === selectedPrediction) ?? null : null}
        initialValue={selectedValue}
        initialConfidence={selectedConfidence}
        userPrediction={selectedPrediction ? userPredictions[selectedPrediction] : null}
        error={error}
        loading={selectedPrediction ? Boolean(loading[selectedPrediction]) : false}
        onClose={handleClose}
        onSave={async (predictionValue, confidenceValue) => {
          if (!selectedPrediction) return;
          await handlePrediction(selectedPrediction, predictionValue, confidenceValue);
        }}
        submitLabel="Save"
        progressCurrent={selectedPrediction
          ? Math.max(answerableSeasonQuestions.findIndex((question) => question.id === selectedPrediction) + 1, 1)
          : undefined}
        progressTotal={answerableSeasonQuestions.length || undefined}
        onboardingGuideActive={
          onboardingGuideActive &&
          selectedPrediction === autoOpenQuestionId &&
          !showAuthPrompt
        }
        onOnboardingExit={() => {
          handleClose();
          onOnboardingExit?.();
        }}
      />

      <LoginModal 
        isOpen={showLoginModal}
        source="prediction_gate_login"
        redirectPath={predictionAuthRedirectPath}
        onClose={() => setShowLoginModal(false)}
        onSwitchToRegister={() => {
          setShowLoginModal(false);
          setShowRegisterModal(true);
        }}
      />

      <RegisterModal
        isOpen={showRegisterModal}
        source="prediction_gate_register"
        redirectPath={predictionAuthRedirectPath}
        onClose={() => setShowRegisterModal(false)}
        onSwitchToLogin={() => {
          setShowRegisterModal(false);
          setShowLoginModal(true);
        }}
      />
    </>
  );
}

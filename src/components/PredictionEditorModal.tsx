import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Loader2, X } from 'lucide-react';
import { isPast } from 'date-fns';
import { formatCentralDeadline } from '../lib/utils';
import { questionChoiceAssets } from '../lib/PredictionContext';

type ConfidenceLevel = 'low' | 'medium' | 'high';
type OnboardingStepId = 'choices' | 'confidence' | 'deadline';

interface EditorChoice {
  id: string;
  text: string;
}

interface EditorQuestion {
  id: string;
  text: string;
  deadline: string;
  status?: 'live' | 'pending' | 'completed';
  question_type: 'yes_no' | 'multiple_choice';
  choices?: EditorChoice[];
  correct_answer?: string | null;
  review_detail?: string;
}

interface PredictionEditorModalProps {
  isOpen: boolean;
  question: EditorQuestion | null;
  initialValue: string | null;
  initialConfidence: ConfidenceLevel | null;
  userPrediction?: { prediction: string; confidence: ConfidenceLevel } | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSave: (prediction: string, confidence: ConfidenceLevel) => Promise<void>;
  submitLabel?: string;
  onboardingGuideActive?: boolean;
  onOnboardingExit?: () => void;
}

const ONBOARDING_STEPS: Array<{
  id: OnboardingStepId;
  title: string;
  body: string;
}> = [
  {
    id: 'choices',
    title: 'Make your prediction',
    body: 'This is the question. Pick the answer you believe in to move forward.',
  },
  {
    id: 'confidence',
    title: 'Confidence',
    body: 'Confidence helps show community sentiment around the question.',
  },
  {
    id: 'deadline',
    title: 'Deadline',
    body: 'You can edit your pick until this time. After that, the prediction is locked in.',
  },
];

function sectionClassName(isActive: boolean, isDimmed: boolean) {
  if (isActive) {
    return 'opacity-100 bg-orange-50/70 shadow-[0_0_0_3px_rgba(249,115,22,0.55),0_18px_38px_rgba(249,115,22,0.14)]';
  }

  if (isDimmed) {
    return 'opacity-20';
  }

  return 'opacity-100';
}

function getCalloutWrapperClass(activeStep: OnboardingStepId | null) {
  if (activeStep === 'choices') {
    return 'absolute inset-x-4 bottom-[6.5rem] z-20 sm:inset-x-auto sm:left-[calc(50%+18rem)] sm:top-[10.5rem] sm:bottom-auto sm:w-72';
  }

  if (activeStep === 'confidence') {
    return 'absolute inset-x-4 -bottom-2 z-20 sm:inset-x-auto sm:left-[calc(50%+18rem)] sm:top-[19.5rem] sm:bottom-auto sm:w-72';
  }

  return 'absolute inset-x-4 bottom-[8.5rem] z-20 sm:inset-x-auto sm:left-[calc(50%+18rem)] sm:top-[28.5rem] sm:bottom-auto sm:w-72';
}

export function PredictionEditorModal({
  isOpen,
  question,
  initialValue,
  initialConfidence,
  userPrediction,
  error,
  loading,
  onClose,
  onSave,
  submitLabel = 'Submit Prediction',
  onboardingGuideActive = false,
  onOnboardingExit,
}: PredictionEditorModalProps) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<ConfidenceLevel | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStepId>('choices');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedValue(initialValue);
    setSelectedConfidence(initialConfidence);
  }, [initialConfidence, initialValue, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setOnboardingStep('choices');
  }, [isOpen, onboardingGuideActive, question?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const hasDeadlinePassed = question?.deadline ? isPast(new Date(question.deadline)) : false;
  const isLocked = !!question && (question.status === 'pending' || question.status === 'completed' || hasDeadlinePassed);
  const activeStep = onboardingGuideActive ? onboardingStep : null;
  const isChoicesStep = activeStep === 'choices';
  const isConfidenceStep = activeStep === 'confidence';
  const isDeadlineStep = activeStep === 'deadline';

  const activeCallout = useMemo(
    () => ONBOARDING_STEPS.find((step) => step.id === activeStep) ?? null,
    [activeStep]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question || !selectedValue || !selectedConfidence || isLocked) return;
    await onSave(selectedValue, selectedConfidence);
  };

  const handleValueSelect = (value: string) => {
    setSelectedValue(value);
    if (onboardingGuideActive && onboardingStep === 'choices') {
      setOnboardingStep('confidence');
    }
  };

  const handleConfidenceSelect = (level: ConfidenceLevel) => {
    setSelectedConfidence(level);
    if (onboardingGuideActive && onboardingStep === 'confidence') {
      setOnboardingStep('deadline');
    }
  };

  const handleOnboardingBack = () => {
    if (!onboardingGuideActive) return;

    if (onboardingStep === 'deadline') {
      setOnboardingStep('confidence');
      return;
    }

    if (onboardingStep === 'confidence') {
      setOnboardingStep('choices');
    }
  };

  const renderOptions = () => {
    if (!question) return null;

    if (question.question_type === 'yes_no') {
      return (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isLocked}
            onClick={() => handleValueSelect('yes')}
            className={`flex items-center justify-center rounded-xl border px-3 py-2 text-[13px] font-bold transition-colors ${
              selectedValue === 'yes'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : isLocked
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => handleValueSelect('no')}
            className={`flex items-center justify-center rounded-xl border px-3 py-2 text-[13px] font-bold transition-colors ${
              selectedValue === 'no'
                ? 'border-red-600 bg-red-50 text-red-700'
                : isLocked
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                : 'border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50/60'
            }`}
          >
            No
          </button>
        </div>
      );
    }

    return (
      <div className="max-h-[44vh] space-y-2.5 overflow-y-auto pr-1">
        {(!question.choices || question.choices.length === 0) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600">
            Answer options will be added soon.
          </div>
        )}
        {question.choices?.map((choice) => {
          const choiceImage = questionChoiceAssets[question.id]?.[choice.text];

          return (
            <button
              key={choice.id}
              type="button"
              disabled={isLocked}
              onClick={() => handleValueSelect(choice.text)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                selectedValue === choice.text
                  ? 'border-bears-navy bg-bears-navy/5 text-bears-navy'
                  : isLocked
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-bears-navy/30 hover:bg-bears-navy/5'
              }`}
            >
              <span className="flex items-center gap-3">
                {choiceImage && (
                  <img
                    src={choiceImage}
                    alt=""
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                )}
                <span className="text-[13px] font-bold">{choice.text}</span>
              </span>
              {choiceImage && (
                <span
                  aria-hidden="true"
                  className={`h-5 w-5 rounded-full border-2 ${
                    selectedValue === choice.text ? 'border-bears-navy bg-bears-navy' : 'border-slate-300'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && question && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/45"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
            onClick={onClose}
          >
            <div
              className="relative mx-auto flex w-full max-w-[860px] flex-col items-center gap-4 sm:gap-0"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative w-full max-w-[500px]">
                <form
                  onSubmit={handleSubmit}
                  className="relative overflow-hidden rounded-[28px] bg-white shadow-2xl"
                >
                  <div className="p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className={`min-w-0 flex-1 rounded-2xl p-1 transition ${sectionClassName(isChoicesStep, onboardingGuideActive && !isChoicesStep)}`}>
                      <h2 className="text-lg font-bold leading-snug text-bears-navy sm:text-xl">
                        {question.text}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={onboardingGuideActive ? onOnboardingExit : onClose}
                      className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      aria-label={onboardingGuideActive ? 'Close onboarding' : 'Close modal'}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {isLocked && (
                    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      {question.status === 'pending'
                        ? 'This prediction is coming soon. Check back later for answer options.'
                        : 'Prediction is closed. You can view details below.'}
                    </div>
                  )}

                  <div className={`mb-4 rounded-2xl p-1 transition ${sectionClassName(isChoicesStep, onboardingGuideActive && !isChoicesStep)}`}>
                    {renderOptions()}
                  </div>

                  {question.review_detail && (
                    <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-slate-700">
                      <p className="font-bold uppercase tracking-wide text-sky-800">Review detail</p>
                      <p className="mt-1 font-medium">{question.review_detail}</p>
                    </div>
                  )}

                  {(userPrediction || question.correct_answer?.trim()) && (
                    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm">
                      {userPrediction && (
                        <p className="font-semibold text-slate-800">
                          Your pick: <span className="text-bears-navy">{userPrediction.prediction}</span>{' '}
                          <span className="text-xs font-medium capitalize text-slate-500">({userPrediction.confidence})</span>
                        </p>
                      )}
                      {question.correct_answer?.trim() && (
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                          Correct Answer: <span className="font-extrabold">{question.correct_answer}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {!isLocked && (
                    <div className={`mb-4 rounded-2xl p-1 transition ${sectionClassName(isConfidenceStep, onboardingGuideActive && !isConfidenceStep)}`}>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        How confident are you?
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['low', 'medium', 'high'] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                          disabled={onboardingGuideActive && !isConfidenceStep}
                          onClick={() => handleConfidenceSelect(level)}
                            className={`rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                              selectedConfidence === level
                                ? 'bg-bears-navy text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-bears-navy/10'
                            } ${onboardingGuideActive && !isConfidenceStep ? 'pointer-events-none' : ''}`}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`rounded-2xl border px-3 py-2.5 transition ${sectionClassName(isDeadlineStep, onboardingGuideActive && !isDeadlineStep)} border-slate-200 bg-slate-50`}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Deadline
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {formatCentralDeadline(question.deadline)}
                    </p>
                  </div>

                  {error && (
                    <div className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">
                      {error}
                    </div>
                  )}

                  {!isLocked && (
                    <button
                      type="submit"
                      disabled={!selectedValue || !selectedConfidence || loading || (onboardingGuideActive && !isDeadlineStep)}
                      className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors ${
                        onboardingGuideActive && !isDeadlineStep
                          ? 'cursor-not-allowed bg-bears-orange/45'
                          : 'bg-bears-orange hover:bg-bears-orange/90'
                      } disabled:opacity-100`}
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : submitLabel}
                    </button>
                  )}

                  {isLocked && (
                    <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      Locked after deadline
                    </p>
                  )}
                  </div>
                </form>

                {activeCallout && (
                  <div className={getCalloutWrapperClass(activeStep)}>
                    <div className="relative rounded-2xl border border-bears-orange/35 bg-white p-4 shadow-none sm:shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                      {activeStep === 'deadline' ? (
                        <>
                          <span className="-bottom-[9px] right-8 absolute h-4 w-4 rotate-45 border-r border-b border-bears-orange/35 bg-white sm:hidden" />
                          <span className="hidden sm:block sm:right-10 sm:bottom-auto sm:left-[-14px] sm:top-1/2 sm:absolute sm:h-0 sm:w-0 sm:-translate-y-1/2 sm:border-l-0 sm:border-r-[14px] sm:border-t-[14px] sm:border-b-[14px] sm:border-r-bears-orange/35 sm:border-t-transparent sm:border-b-transparent" />
                          <span className="hidden sm:block sm:right-auto sm:bottom-auto sm:left-[-11px] sm:top-1/2 sm:absolute sm:h-0 sm:w-0 sm:-translate-y-1/2 sm:border-l-0 sm:border-r-[12px] sm:border-t-[12px] sm:border-b-[12px] sm:border-r-white sm:border-t-transparent sm:border-b-transparent" />
                        </>
                      ) : (
                        <>
                          <span className="-top-[9px] right-20 absolute h-4 w-4 rotate-45 border-l border-t border-bears-orange/35 bg-white sm:hidden" />
                          <span className="hidden sm:block sm:right-auto sm:left-[-14px] sm:top-1/2 sm:absolute sm:h-0 sm:w-0 sm:-translate-y-1/2 sm:border-r-[14px] sm:border-t-[14px] sm:border-b-[14px] sm:border-r-bears-orange/35 sm:border-t-transparent sm:border-b-transparent sm:border-l-0" />
                          <span className="hidden sm:block sm:right-auto sm:left-[-11px] sm:top-1/2 sm:absolute sm:h-0 sm:w-0 sm:-translate-y-1/2 sm:border-r-[12px] sm:border-t-[12px] sm:border-b-[12px] sm:border-r-white sm:border-t-transparent sm:border-b-transparent sm:border-l-0" />
                        </>
                      )}
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#c2410c]">
                        {activeCallout.title}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                        {activeCallout.body}
                      </p>
                      {activeStep === 'deadline' && (
                        <p className="mt-3 text-xs font-semibold text-slate-500">
                          Submit your prediction to save.
                        </p>
                      )}
                      {activeStep !== 'choices' && (
                        <button
                          type="button"
                          onClick={handleOnboardingBack}
                          className="mt-4 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-700"
                        >
                          Back
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

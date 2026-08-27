import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useAuth } from './auth';

// Import player images and icons
import calebImage from '../assets/WillCa03_2024.jpg';
import sweatImage from '../assets/SweaMo00_2024.jpg';
import odunzeImage from '../assets/OdunRo00_2024.jpg';
import thuneyImage from '../assets/joe.jpg';
import benJohnsonImage from '../assets/ben_johnson.jpg';
import calebWilliamsTurfImage from '../assets/2026-portraits/caleb-williams-turf.webp';
import benJohnsonTurfImage from '../assets/2026-portraits/ben-johnson-turf.webp';
import colstonLovelandTurfImage from '../assets/2026-portraits/colston-loveland-turf.webp';
import kylerGordonTurfImage from '../assets/2026-portraits/kyler-gordon-turf.webp';
import dAndreSwiftTurfImage from '../assets/2026-portraits/dandre-swift-turf.webp';
import joeThuneyTurfImage from '../assets/2026-portraits/joe-thuney-turf.webp';
import darnellWrightTurfImage from '../assets/2026-portraits/darnell-wright-turf.webp';
import jaylonJohnsonTurfImage from '../assets/2026-portraits/jaylon-johnson-turf.webp';
import lutherBurdenTurfImage from '../assets/2026-choice-portraits/luther-burden-turf.webp';
import romeOdunzeTurfImage from '../assets/2026-choice-portraits/rome-odunze-turf.webp';
import dAndreSwiftChoiceTurfImage from '../assets/2026-choice-portraits/dandre-swift-turf.webp';
import kyleMonangaiTurfImage from '../assets/2026-choice-portraits/kyle-monangai-turf.webp';
import montezSweatTurfImage from '../assets/2026-choice-portraits/montez-sweat-turf.webp';
import austinBookerTurfImage from '../assets/2026-choice-portraits/austin-booker-turf.webp';
import dayoOdeyingboTurfImage from '../assets/2026-choice-portraits/dayo-odeyingbo-turf.webp';
import braxtonJonesTurfImage from '../assets/2026-choice-portraits/braxton-jones-turf.webp';
import ozzyTrapiloTurfImage from '../assets/2026-choice-portraits/ozzy-trapilo-turf.webp';
import theoBenedetTurfImage from '../assets/2026-choice-portraits/theo-benedet-turf.webp';
import kiranAmegadjieTurfImage from '../assets/2026-choice-portraits/kiran-amegadjie-turf.webp';
import jedrickWillsTurfImage from '../assets/2026-choice-portraits/jedrick-wills-turf.webp';
import dillonThienemanTurfImage from '../assets/2026-choice-portraits/dillon-thieneman-turf.webp';
import loganJonesTurfImage from '../assets/2026-choice-portraits/logan-jones-turf.webp';
import zavionThomasTurfImage from '../assets/2026-choice-portraits/zavion-thomas-turf.webp';
import malikMuhammadTurfImage from '../assets/2026-choice-portraits/malik-muhammad-turf.webp';
import someoneElseBearsImage from '../assets/2026-choice-portraits/someone-else-bears.webp';
import bearsLogo from '../assets/bears logo.png';
import draftLogo from '../assets/NFL_Draft_logo.jpg';
import briskerImage from '../assets/brisker.png';
import { FolderRoot as Football } from 'lucide-react';
import { season2026QuestionReview } from '../data/season2026QuestionReview';

export interface Question {
  id: string;
  text: string;
  category: string;
  season: number;
  status: 'live' | 'pending' | 'completed';
  deadline: string;
  featured: boolean;
  question_type: 'yes_no' | 'multiple_choice';
  choices?: Choice[];
  review_detail?: string;
}

export interface Choice {
  id: string;
  text: string;
  prediction_count: number;
}

export interface Prediction {
  id: string;
  user_id: string;
  question_id: string;
  prediction: string;
  confidence: 'low' | 'medium' | 'high';
  created_at: string;
  questions?: {
    text: string;
    category: string;
    season?: number;
  };
}

interface PredictionStats {
  totalPredictions: number;
  upcomingPredictions: number;
}

interface AggregatedPredictions {
  [questionId: string]: {
    [choice: string]: number;
    total: number;
    loading: boolean;
  };
}

interface UserPredictions {
  [questionId: string]: {
    id: string;
    prediction: string;
    confidence: 'low' | 'medium' | 'high';
  };
}

export interface QuestionAsset {
  image?: string;
  icon?: React.ElementType;
  mediaClassName?: string;
  imageClassName?: string;
}

interface PredictionContextType {
  predictions: Prediction[];
  questions: Question[];
  stats: PredictionStats;
  loading: boolean;
  error: string | null;
  recentlyAdded: Set<string>;
  questionAssets: Record<string, QuestionAsset>;
  aggregatedPredictions: AggregatedPredictions;
  userPredictions: UserPredictions;
  fetchPredictions: () => Promise<void>;
  makePrediction: (questionId: string, prediction: string, confidence: 'low' | 'medium' | 'high') => Promise<void>;
  clearError: () => void;
}

const PredictionContext = createContext<PredictionContextType | undefined>(undefined);
const isSeason2026QuestionReview = import.meta.env.VITE_2026_QUESTION_REVIEW === 'true';
const isSeason2026LivePreview = import.meta.env.VITE_2026_LIVE_PREVIEW === 'true';
const reviewNavyBorderBearsAsset: QuestionAsset = {
  image: bearsLogo,
  mediaClassName: 'h-16 w-16 rounded-2xl border-2 border-bears-navy bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]',
  imageClassName: 'h-full w-full object-contain p-1.5',
};

// Map of question IDs to their corresponding images or icons
export const questionAssets: Record<string, QuestionAsset> = {
  '550e8400-e29b-41d4-a716-446655440000': { image: calebImage },
  '6ba7b810-9dad-11d1-80b4-00c04fd430c8': { image: sweatImage },
  '6ba7b811-9dad-11d1-80b4-00c04fd430c8': { image: bearsLogo }, // Bears wins
  '6ba7b812-9dad-11d1-80b4-00c04fd430c8': { image: thuneyImage },
  '6ba7b813-9dad-11d1-80b4-00c04fd430c8': { image: odunzeImage },
  '6ba7b814-9dad-11d1-80b4-00c04fd430c8': { image: bearsLogo }, // Bears playoffs
  '85da49f8-bcac-4a7c-a30d-81fa73d06202': { image: benJohnsonImage }, // Ben Johnson Coach of the Year
  '7ba7b814-9dad-11d1-80b4-00c04fd430c8': { image: draftLogo }, // Draft question
  'f6a8dc28-c6d7-4ba2-9492-437292ec0d2f': { image: draftLogo }, // 2026 first draft question
  'da0b27ee-0b65-401a-a473-092631a19efb': { image: bearsLogo }, // Bears top-10 offense
  'ace92d81-b9d4-48ed-b2ab-ef3390ed0840': { image: bearsLogo }, // Bears top-10 defense
  '2ca00c0b-147f-4fd0-bc95-6d989ed11ac4': { image: briskerImage }, // Brisker question
  '1966ba03-faed-4aaa-94e4-c03c5552ba6b': { image: calebImage }, // Caleb Williams question
  '817c1398-53c5-49eb-aa93-6bc88bbe562b': { image: calebImage }, // Caleb Williams question

  // 2026 review-only single-person questions. Multiple-choice cards intentionally
  // remain neutral so a portrait does not suggest a preferred answer.
  'preview-2026-caleb-4000-yards': { image: calebWilliamsTurfImage },
  'preview-2026-caleb-completion-rate': { image: calebWilliamsTurfImage },
  'preview-2026-caleb-30-touchdowns': { image: calebWilliamsTurfImage },
  'preview-2026-caleb-17-starts': { image: calebWilliamsTurfImage },
  'preview-2026-caleb-pro-bowl-or-all-pro': { image: calebWilliamsTurfImage },
  'preview-2026-ben-johnson-coach-of-year': { image: benJohnsonTurfImage },
  'preview-2026-loveland-1000-yards': { image: colstonLovelandTurfImage },
  'preview-2026-loveland-pro-bowl-or-all-pro': { image: colstonLovelandTurfImage },
  'preview-2026-kyler-gordon-games': { image: kylerGordonTurfImage },
  'preview-2026-swift-1000-yards': { image: dAndreSwiftTurfImage },
  'preview-2026-thuney-pro-bowl-or-all-pro': { image: joeThuneyTurfImage },
  'preview-2026-wright-pro-bowl-or-all-pro': { image: darnellWrightTurfImage },
  'preview-2026-jaylon-johnson-pro-bowl-or-all-pro': { image: jaylonJohnsonTurfImage },
  'preview-2026-receiving-yards-leader': reviewNavyBorderBearsAsset,
  'preview-2026-touchdown-leader': reviewNavyBorderBearsAsset,
  'preview-2026-sack-leader': reviewNavyBorderBearsAsset,
  'preview-2026-left-tackle-starts-leader': reviewNavyBorderBearsAsset,
  'preview-2026-rookie-snaps-leader': reviewNavyBorderBearsAsset,

  // Production IDs for the same 2026 regular-season questions. These stay in
  // sync with the review cards so pending questions look finished before picks open.
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f001': { image: calebWilliamsTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f002': { image: calebWilliamsTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f003': { image: calebWilliamsTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f004': { image: calebWilliamsTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f005': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f007': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f008': { image: kylerGordonTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f010': { image: dAndreSwiftTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f011': { image: colstonLovelandTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f012': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f013': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f014': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f015': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f016': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f017': { image: calebWilliamsTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f018': { image: joeThuneyTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f019': { image: darnellWrightTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f020': { image: benJohnsonTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f021': { image: jaylonJohnsonTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f022': { image: colstonLovelandTurfImage },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f023': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f024': reviewNavyBorderBearsAsset,
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f025': reviewNavyBorderBearsAsset,

  // 2026 review-only team outcomes use the Bears mark, with the approved navy border.
  'preview-2026-top-seven-offense': { image: bearsLogo, mediaClassName: 'h-16 w-16 rounded-2xl border-2 border-bears-navy bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]', imageClassName: 'h-full w-full object-contain p-1.5' },
  'preview-2026-top-15-defense': { image: bearsLogo, mediaClassName: 'h-16 w-16 rounded-2xl border-2 border-bears-navy bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]', imageClassName: 'h-full w-full object-contain p-1.5' },
  'preview-2026-11-wins': { image: bearsLogo, mediaClassName: 'h-16 w-16 rounded-2xl border-2 border-bears-navy bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]', imageClassName: 'h-full w-full object-contain p-1.5' },
  'preview-2026-nfc-north': { image: bearsLogo, mediaClassName: 'h-16 w-16 rounded-2xl border-2 border-bears-navy bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]', imageClassName: 'h-full w-full object-contain p-1.5' },
  'preview-2026-top-five-rushing': { image: bearsLogo, mediaClassName: 'h-16 w-16 rounded-2xl border-2 border-bears-navy bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]', imageClassName: 'h-full w-full object-contain p-1.5' },
  'preview-2026-make-playoffs': { image: bearsLogo, mediaClassName: 'h-16 w-16 rounded-2xl border-2 border-bears-navy bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]', imageClassName: 'h-full w-full object-contain p-1.5' },
  'preview-2026-win-playoff-game': { image: bearsLogo, mediaClassName: 'h-16 w-16 rounded-2xl border-2 border-bears-navy bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]', imageClassName: 'h-full w-full object-contain p-1.5' },
};

// Review-only choice portraits are shown after opening a multiple-choice question.
// They are equal in size and presentation so the card itself never favors an answer.
export const questionChoiceAssets: Record<string, Record<string, string>> = {
  'preview-2026-receiving-yards-leader': {
    'Luther Burden III': lutherBurdenTurfImage,
    'Rome Odunze': romeOdunzeTurfImage,
    'Colston Loveland': colstonLovelandTurfImage,
  },
  'preview-2026-touchdown-leader': {
    'D’Andre Swift': dAndreSwiftChoiceTurfImage,
    'Colston Loveland': colstonLovelandTurfImage,
    'Rome Odunze': romeOdunzeTurfImage,
    'Luther Burden III': lutherBurdenTurfImage,
    'Kyle Monangai': kyleMonangaiTurfImage,
    'Someone else': someoneElseBearsImage,
  },
  'preview-2026-sack-leader': {
    'Montez Sweat': montezSweatTurfImage,
    'Austin Booker': austinBookerTurfImage,
    'Dayo Odeyingbo': dayoOdeyingboTurfImage,
    'Someone else': someoneElseBearsImage,
  },
  'preview-2026-left-tackle-starts-leader': {
    'Braxton Jones': braxtonJonesTurfImage,
    'Ozzy Trapilo': ozzyTrapiloTurfImage,
    'Theo Benedet': theoBenedetTurfImage,
    'Kiran Amegadjie': kiranAmegadjieTurfImage,
    'Jedrick Wills Jr.': jedrickWillsTurfImage,
  },
  'preview-2026-rookie-snaps-leader': {
    'Dillon Thieneman': dillonThienemanTurfImage,
    'Logan Jones': loganJonesTurfImage,
    'Zavion Thomas': zavionThomasTurfImage,
    'Malik Muhammad': malikMuhammadTurfImage,
    'Someone else': someoneElseBearsImage,
  },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f005': {
    'Luther Burden III': lutherBurdenTurfImage,
    'Rome Odunze': romeOdunzeTurfImage,
    'Colston Loveland': colstonLovelandTurfImage,
  },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f006': {
    'D’Andre Swift': dAndreSwiftChoiceTurfImage,
    'Colston Loveland': colstonLovelandTurfImage,
    'Rome Odunze': romeOdunzeTurfImage,
    'Luther Burden III': lutherBurdenTurfImage,
    'Kyle Monangai': kyleMonangaiTurfImage,
    'Someone else': someoneElseBearsImage,
  },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f007': {
    'Montez Sweat': montezSweatTurfImage,
    'Austin Booker': austinBookerTurfImage,
    'Dayo Odeyingbo': dayoOdeyingboTurfImage,
    'Someone else': someoneElseBearsImage,
  },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f009': {
    'Braxton Jones': braxtonJonesTurfImage,
    'Ozzy Trapilo': ozzyTrapiloTurfImage,
    'Theo Benedet': theoBenedetTurfImage,
    'Kiran Amegadjie': kiranAmegadjieTurfImage,
    'Jedrick Wills Jr.': jedrickWillsTurfImage,
  },
  'bc0f2a3e-1df6-4f11-83c2-71f9f9c8f025': {
    'Dillon Thieneman': dillonThienemanTurfImage,
    'Logan Jones': loganJonesTurfImage,
    'Zavion Thomas': zavionThomasTurfImage,
    'Malik Muhammad': malikMuhammadTurfImage,
    'Someone else': someoneElseBearsImage,
  },
};

// The 2026 portrait set is only about 74 KB after optimization. Start fetching
// it with the app bundle so switching to the season or opening a choice modal
// does not wait on a second round of image requests.
if (typeof window !== 'undefined') {
  const imageUrls = new Set([
    bearsLogo,
    calebWilliamsTurfImage,
    benJohnsonTurfImage,
    colstonLovelandTurfImage,
    kylerGordonTurfImage,
    dAndreSwiftTurfImage,
    joeThuneyTurfImage,
    darnellWrightTurfImage,
    jaylonJohnsonTurfImage,
    lutherBurdenTurfImage,
    romeOdunzeTurfImage,
    dAndreSwiftChoiceTurfImage,
    kyleMonangaiTurfImage,
    montezSweatTurfImage,
    austinBookerTurfImage,
    dayoOdeyingboTurfImage,
    braxtonJonesTurfImage,
    ozzyTrapiloTurfImage,
    theoBenedetTurfImage,
    kiranAmegadjieTurfImage,
    jedrickWillsTurfImage,
    dillonThienemanTurfImage,
    loganJonesTurfImage,
    zavionThomasTurfImage,
    malikMuhammadTurfImage,
    someoneElseBearsImage,
  ]);

  imageUrls.forEach((src) => {
    const image = new Image();
    image.src = src;
  });
}

interface PublicPredictionAggregateRow {
  question_id: string;
  prediction: string;
  vote_count: number;
}

const calculateAggregates = (data: PublicPredictionAggregateRow[] | null, questions: Question[]): AggregatedPredictions => {
  const aggregates: AggregatedPredictions = {};

  // Initialize aggregates for all questions
  questions.forEach(question => {
    if (question.question_type === 'yes_no') {
      aggregates[question.id] = { yes: 0, no: 0, total: 0, loading: false };
    } else if (question.choices) {
      const choiceCounts = question.choices.reduce((acc, choice) => ({
        ...acc,
        [choice.text]: 0
      }), {});
      aggregates[question.id] = { ...choiceCounts, total: 0, loading: false };
    }
  });

  // Process prediction data
  if (data && Array.isArray(data)) {
    data.forEach((predictionRow) => {
      const { question_id, prediction: vote, vote_count } = predictionRow;
      const question = questions.find(q => q.id === question_id);
      
      if (question && aggregates[question_id]) {
        if (question.question_type === 'yes_no') {
          const normalizedVote = vote.toLowerCase();
          if (aggregates[question_id][normalizedVote] !== undefined) {
            aggregates[question_id][normalizedVote] += vote_count;
            aggregates[question_id].total += vote_count;
          }
        } else if (question.choices) {
          const matchingChoice = question.choices.find(
            (choice) => choice.text.trim().toLowerCase() === vote.trim().toLowerCase()
          );
          if (matchingChoice && aggregates[question_id][matchingChoice.text] !== undefined) {
            aggregates[question_id][matchingChoice.text] += vote_count;
            aggregates[question_id].total += vote_count;
          }
        }
      }
    });
  }

  return aggregates;
};

export function PredictionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<PredictionStats>({
    totalPredictions: 0,
    upcomingPredictions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [aggregatedPredictions, setAggregatedPredictions] = useState<AggregatedPredictions>({});
  const [userPredictions, setUserPredictions] = useState<UserPredictions>({});

  const fetchQuestions = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('questions')
        .select(`
          *,
          choices (
            id,
            text,
            prediction_count
          )
        `)
        .order('featured', { ascending: false })
        .order('deadline', { ascending: true });

      if (fetchError) throw fetchError;
      const fetchedQuestions = data || [];
      const currentQuestions = isSeason2026QuestionReview
        ? [
            ...fetchedQuestions.filter((question) => question.season !== 2026),
            ...[...season2026QuestionReview].sort(
              (firstQuestion, secondQuestion) => Number(secondQuestion.featured) - Number(firstQuestion.featured)
            ),
          ]
        : isSeason2026LivePreview
          ? fetchedQuestions.map((question) => (
              question.season === 2026 ? { ...question, status: 'live' as const } : question
            ))
          : fetchedQuestions;

      setQuestions(currentQuestions);
      return currentQuestions;
    } catch (err) {
      console.error('Error fetching questions:', err);
      throw err;
    }
  }, []);

  const fetchAggregatedPredictions = useCallback(async (currentQuestions: Question[]) => {
    try {
      // Set loading state for all questions
      setAggregatedPredictions(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(questionId => {
          updated[questionId] = { ...updated[questionId], loading: true };
        });
        return updated;
      });

      const seasons = [...new Set(currentQuestions.map((question) => question.season))];
      const targetSeason = seasons.length === 1 ? seasons[0] : null;
      const { data, error } = await supabase.rpc('get_public_question_prediction_summary', {
        target_season: targetSeason,
      });
      if (error) throw error;

      const aggregates = calculateAggregates((data as PublicPredictionAggregateRow[] | null) || [], currentQuestions);
      setAggregatedPredictions(aggregates);
    } catch (err) {
      console.error('Error fetching aggregated predictions:', err);
      throw err;
    }
  }, []);

  const fetchUserPredictions = useCallback(async () => {
    if (!user) {
      setUserPredictions({});
      setPredictions([]);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('predictions')
        .select(`
          *,
          questions (
            text,
            category
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Get only the latest prediction for each question
      const latestPredictions = data?.reduce((acc: Prediction[], curr) => {
        const existingIndex = acc.findIndex(p => p.question_id === curr.question_id);
        if (existingIndex === -1) {
          acc.push(curr);
        }
        return acc;
      }, []) || [];

      // Create user predictions map
      const userPredictionsMap: UserPredictions = {};
      latestPredictions.forEach((prediction) => {
        userPredictionsMap[prediction.question_id] = {
          id: prediction.id,
          prediction: prediction.prediction,
          confidence: prediction.confidence,
        };
      });

      setPredictions(latestPredictions);
      setUserPredictions(userPredictionsMap);
      setStats(calculateStats(latestPredictions));
    } catch (err) {
      console.error('Error fetching user predictions:', err);
      throw err;
    }
  }, [user]);

  const calculateStats = useCallback((predictions: Prediction[]) => ({
    totalPredictions: predictions.length,
    upcomingPredictions: predictions.length,
  }), []);

  const fetchPredictions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Always fetch questions first
      const currentQuestions = await fetchQuestions();

      // Fetch aggregated predictions and user predictions in parallel
      await Promise.all([
        fetchAggregatedPredictions(currentQuestions),
        fetchUserPredictions()
      ]);
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [fetchQuestions, fetchAggregatedPredictions, fetchUserPredictions]);

  const setupRealtimeSubscription = useCallback(() => {
    const channel = supabase
      .channel('predictions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions'
        },
        async () => {
          // Always refresh aggregated counts
          const currentQuestions = await fetchQuestions();
          await fetchAggregatedPredictions(currentQuestions);
          
          // Only refresh user predictions if authenticated
          if (user) {
            await fetchUserPredictions();
          }
        }
      )
      .subscribe();

    setRealtimeChannel(channel);

    return () => {
      channel.unsubscribe();
    };
  }, [fetchQuestions, fetchAggregatedPredictions, fetchUserPredictions, user]);

  const makePrediction = useCallback(async (questionId: string, prediction: string, confidence: 'low' | 'medium' | 'high') => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Check if the question's deadline has passed
      const question = questions.find(q => q.id === questionId);
      if (!question) throw new Error('Question not found');
      if (question.status !== 'live') {
        throw new Error('This prediction is not open yet');
      }

      const deadline = new Date(question.deadline);
      if (deadline < new Date()) {
        throw new Error('The deadline for this prediction has passed');
      }

      const { data, error } = await supabase
        .from('predictions')
        .upsert({
          user_id: user.id,
          question_id: questionId,
          prediction,
          confidence,
          prediction_type_id: 'd290f1ee-6c54-4b01-90e6-d701748f0852'
        }, {
          onConflict: 'user_id,question_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;

      // Add to recently added set
      setRecentlyAdded(prev => new Set(prev).add(data.id));
      
      // Remove from recently added after animation
      setTimeout(() => {
        setRecentlyAdded(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.id);
          return newSet;
        });
      }, 5000);

      // Update user predictions immediately
      setUserPredictions(prev => ({
        ...prev,
        [questionId]: {
          id: data.id,
          prediction,
          confidence,
        }
      }));

      // Fetch updated predictions and aggregates
      await fetchPredictions();
    } catch (err) {
      console.error('Error making prediction:', err);
      throw err;
    }
  }, [user, questions, fetchPredictions]);

  useEffect(() => {
    fetchPredictions();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [user, fetchPredictions, setupRealtimeSubscription]);

  const clearError = () => setError(null);

  return (
    <PredictionContext.Provider
      value={{
        predictions,
        questions,
        stats,
        loading,
        error,
        recentlyAdded,
        questionAssets,
        aggregatedPredictions,
        userPredictions,
        fetchPredictions,
        makePrediction,
        clearError,
      }}
    >
      {children}
    </PredictionContext.Provider>
  );
}

export function usePredictions() {
  const context = useContext(PredictionContext);
  if (context === undefined) {
    throw new Error('usePredictions must be used within a PredictionProvider');
  }
  return context;
}

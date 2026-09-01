import posthog from 'posthog-js';
import type { User } from '@supabase/supabase-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let analyticsInitialized = false;

export const ANALYTICS_EVENTS = {
  pageViewed: 'page_viewed',
  emailAttributionDetected: 'email_attribution_detected',
  navClicked: 'nav_clicked',
  categoryFilterChanged: 'category_filter_changed',
  paginationChanged: 'pagination_changed',
  signupCtaClicked: 'signup_cta_clicked',
  loginCtaClicked: 'login_cta_clicked',
  authModalOpened: 'auth_modal_opened',
  authSwitchClicked: 'auth_switch_clicked',
  signupSubmitted: 'signup_submitted',
  signupSucceeded: 'signup_succeeded',
  signupFailed: 'signup_failed',
  loginSubmitted: 'login_submitted',
  loginSucceeded: 'login_succeeded',
  loginFailed: 'login_failed',
  oauthSignInStarted: 'oauth_sign_in_started',
  oauthSignInFailed: 'oauth_sign_in_failed',
  passwordResetRequested: 'password_reset_requested',
  logoutClicked: 'logout_clicked',
  predictionCardViewed: 'prediction_card_viewed',
  predictionStarted: 'prediction_started',
  predictionAuthGateHit: 'prediction_auth_gate_hit',
  predictionSubmitted: 'prediction_submitted',
  predictionSubmitFailed: 'prediction_submit_failed',
  predictionEditorOpened: 'prediction_editor_opened',
  dashboardViewed: 'dashboard_viewed',
  dashboardFilterChanged: 'dashboard_filter_changed',
  dashboardPredictionOpened: 'dashboard_prediction_opened',
  displayNameEditStarted: 'display_name_edit_started',
  displayNameSaved: 'display_name_saved',
  displayNameSaveFailed: 'display_name_save_failed',
  leaderboardViewed: 'leaderboard_viewed',
  seasonRecapViewed: 'season_recap_viewed',
  seasonRecapCtaClicked: 'season_recap_cta_clicked',
} as const;

type EventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
type EventProperties = Record<string, string | number | boolean | null | undefined>;

type EmailAttribution = {
  email_source?: string;
  email_medium?: string;
  email_campaign?: string;
  email_content?: string;
  email_term?: string;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function analyticsEnabled() {
  return analyticsInitialized && isBrowser();
}

function currentPath() {
  if (!isBrowser()) return undefined;
  return `${window.location.pathname}${window.location.search}`;
}

function readEmailAttributionFromUrl(): EmailAttribution | null {
  if (!isBrowser()) return null;

  const params = new URLSearchParams(window.location.search);
  const attribution: EmailAttribution = {
    email_source: params.get('utm_source') ?? params.get('source') ?? undefined,
    email_medium: params.get('utm_medium') ?? undefined,
    email_campaign: params.get('utm_campaign') ?? undefined,
    email_content: params.get('utm_content') ?? undefined,
    email_term: params.get('utm_term') ?? undefined,
  };

  if (!Object.values(attribution).some(Boolean)) {
    return null;
  }

  return attribution;
}

export function initAnalytics() {
  if (!isBrowser() || analyticsInitialized || !POSTHOG_KEY) {
    return false;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: false,
    person_profiles: 'identified_only',
    disable_session_recording: false,
    maskAllInputs: true,
    autocapture: true,
    loaded: () => {
      posthog.register({
        app_name: 'bears-prediction-tracker',
        is_authenticated: false,
      });
    },
  });

  analyticsInitialized = true;
  return true;
}

export function captureEvent(event: EventName, properties: EventProperties = {}) {
  if (!analyticsEnabled()) return;

  posthog.capture(event, {
    current_path: currentPath(),
    ...properties,
  });
}

export function capturePageView(routeName: string, properties: EventProperties = {}) {
  captureEvent(ANALYTICS_EVENTS.pageViewed, {
    path: currentPath(),
    route_name: routeName,
    ...properties,
  });
}

export function registerEmailAttributionFromUrl() {
  if (!analyticsEnabled()) return null;

  const attribution = readEmailAttributionFromUrl();
  if (!attribution) return null;

  posthog.register(attribution);
  return attribution;
}

export function captureEmailAttributionDetected(properties: EventProperties = {}) {
  captureEvent(ANALYTICS_EVENTS.emailAttributionDetected, properties);
}

export function identifyAnalyticsUser(user: User, properties: EventProperties = {}) {
  if (!analyticsEnabled()) return;

  posthog.identify(user.id, {
    email: user.email,
    created_at: user.created_at,
    ...properties,
  });

  posthog.register({
    is_authenticated: true,
    user_id: user.id,
  });
}

export function resetAnalyticsUser() {
  if (!analyticsEnabled()) return;

  posthog.reset();
  posthog.register({
    app_name: 'bears-prediction-tracker',
    is_authenticated: false,
  });
}

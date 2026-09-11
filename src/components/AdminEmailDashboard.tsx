import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  ChevronRight,
  Edit2,
  Eye,
  Loader2,
  RefreshCcw,
  Save,
  Send,
} from 'lucide-react';
import { Navbar } from './Navbar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  EMAIL_TEMPLATES,
  type EmailBlock,
  type EmailComposerDraft,
  createDraftFromTemplate,
  createDefaultRecapDraft,
  upgradeSeason2026OpenDraft,
} from '../lib/emailComposer';

import {
  type ActiveCampaign,
  type AudienceCounts,
  type CampaignStats,
  type EmailSendLog,
  type Notice,
  type ScheduledCampaign,
  type SendMarketingEmailResponse,
  type SegmentCounts,
  type SegmentName,
  DRAFT_STORAGE_KEY,
  SEGMENT_OPTIONS,
} from './admin-email/types';
import { ConfirmSendModal } from './admin-email/ConfirmSendModal';
import { EditableEmailShell } from './admin-email/EmailPreviewShell';
import { NoticeBanner } from './admin-email/NoticeBanner';
import { AutomationsTab } from './admin-email/AutomationsTab';
import { Tabs, type DashboardView } from './admin-email/Tabs';
import { StatCard } from './admin-email/StatCard';
import { RecentSends } from './admin-email/RecentSends';
import { CampaignSetup, type DeliveryMode } from './admin-email/CampaignSetup';
import { ScheduledCampaigns } from './admin-email/ScheduledCampaigns';
import { CancelScheduledModal } from './admin-email/CancelScheduledModal';
import {
  centralDateTimeToIso,
  defaultScheduledDateTime,
  formatCentralDateTime,
  toCentralDateTimeInput,
} from '../lib/campaignScheduling';

// The deployed route predates the SES migration. Keep the compatibility name
// centralized until the replacement function and site can be rolled out together.
const CAMPAIGN_EMAIL_FUNCTION = 'send-brevo-email';

export function AdminEmailDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<AudienceCounts | null>(null);
  // Audience selection is deliberately not persisted with the draft. A segment
  // restored from localStorage is the kind of thing an admin does not re-read
  // before hitting send, and picking the wrong audience is unrecoverable once
  // the mail is out. Every session starts on Everybody and must opt in.
  const [segment, setSegment] = useState<SegmentName>('all_subscribed_users');
  const [segmentCounts, setSegmentCounts] = useState<SegmentCounts>({});
  const [sendLogs, setSendLogs] = useState<EmailSendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email ?? '');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(EMAIL_TEMPLATES[0]?.id ?? 'draft-reminder-2026-pick-25');
  const [draft, setDraft] = useState<EmailComposerDraft>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<EmailComposerDraft>;
        // A draft saved under an older shape would otherwise throw inside the
        // preview shell, which renders before anything can catch it.
        if (parsed && Array.isArray(parsed.blocks)) {
          return upgradeSeason2026OpenDraft({
            ...createDefaultRecapDraft(),
            ...parsed,
          } as EmailComposerDraft);
        }
      }
    } catch (error) {
      console.warn('Ignoring unreadable saved draft:', error);
    }
    return createDefaultRecapDraft();
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<DashboardView>(() =>
    new URLSearchParams(location.search).get('view') === 'automations' ? 'automations' : 'broadcasts'
  );

  function switchView(next: DashboardView) {
    setView(next);
    // Keeps the tab deep-linkable without making the URL the source of truth.
    navigate(next === 'automations' ? '?view=automations' : '.', {
      replace: true,
      preventScrollReset: true,
    });
  }

  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [savedFlash, setSavedFlash] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingProduction, setSendingProduction] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<ActiveCampaign | null>(null);
  const [scheduledCampaigns, setScheduledCampaigns] = useState<ScheduledCampaign[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('now');
  const [scheduledLocal, setScheduledLocal] = useState(defaultScheduledDateTime);
  const [campaignToCancel, setCampaignToCancel] = useState<ScheduledCampaign | null>(null);
  const [cancellingCampaignId, setCancellingCampaignId] = useState<string | null>(null);

  /**
   * While a campaign is in flight, drive a batch and read progress on each tick.
   *
   * The database scheduler is the durable engine. This foreground poller makes
   * an immediate send feel responsive while the cron backstop guarantees it
   * continues if the admin closes the page.
   */
  useEffect(() => {
    if (!activeCampaign) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || !activeCampaign) return;

      try {
        await supabase.functions.invoke('dispatch-campaign', {
          body: { campaignId: activeCampaign.id },
        });
      } catch (error) {
        // Losing one batch isn't fatal on its own: the rows stay claimable, so the
        // next foreground or scheduled tick can retry claimable rows.
        console.error('Dispatch tick failed:', error);
      }

      if (cancelled) return;

      const { data, error } = await supabase.rpc('get_campaign_progress', {
        p_campaign_id: activeCampaign.id,
      });

      if (cancelled || error) return;

      const row = (Array.isArray(data) ? data[0] : data) ?? {};
      const pending = Number(row.pending ?? 0);
      const sent = Number(row.sent ?? 0);
      const failed = Number(row.failed ?? 0);

      setActiveCampaign((current) =>
        current ? { ...current, pending, sent, failed } : current,
      );

      if (pending === 0) {
        setActiveCampaign(null);
        setNotice({
          tone: failed > 0 ? 'error' : 'success',
          message:
            failed > 0
              ? `Campaign finished: ${sent} sent, ${failed} failed.`
              : `Campaign finished: ${sent} recipients.`,
        });
        void loadPageData(true);
      }
    }

    void tick();
    const interval = setInterval(() => void tick(), 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeCampaign?.id]);

  useEffect(() => {
    if (user?.email) {
      setTestEmail((current) => current || user.email || '');
    }
  }, [user?.email]);

  useEffect(() => {
    void loadPageData();
  }, []);

  /**
   * Expands a campaign and, the first time, loads which links people clicked.
   *
   * Counts distinct recipients per URL rather than raw clicks — one person
   * clicking the same button three times is one interested reader, not three.
   */

  // Falls back to the all-subscribers count so the confirm modal never shows 0
  // while the per-segment counts are still loading.
  const productionCount =
    segmentCounts[segment] ?? counts?.production_segment_count ?? 0;
  const minimumScheduledLocal = toCentralDateTimeInput(new Date(Date.now() + 2 * 60_000));
  let scheduledForLabel: string | null = null;
  let scheduleIsValid = deliveryMode === 'now';
  if (deliveryMode === 'schedule') {
    try {
      const scheduledAt = centralDateTimeToIso(scheduledLocal);
      scheduleIsValid = new Date(scheduledAt).getTime() > Date.now() + 60_000;
      scheduledForLabel = scheduleIsValid
        ? formatCentralDateTime(scheduledAt)
        : 'Choose a future delivery time';
    } catch {
      scheduledForLabel = 'Choose a valid Central Time delivery date';
    }
  }
  const selectedTemplate =
    EMAIL_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? EMAIL_TEMPLATES[0];

  /** Engagement keyed by campaign id, so a send row can find its own numbers. */
  const statsByCampaign = useMemo(
    () => Object.fromEntries(campaignStats.map((stat) => [stat.campaign_id, stat])),
    [campaignStats]
  );

  async function loadPageData(showRefreshState = false) {
    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [
        { data: countRows, error: countError },
        { data: segmentRows, error: segmentError },
        { data: logs, error: logsError },
        { data: stats, error: statsError },
        { data: scheduledRows, error: scheduledError },
      ] = await Promise.all([
        supabase.rpc('get_admin_email_audience_counts'),
        supabase.rpc('get_campaign_segment_counts'),
        supabase
          .from('email_send_logs')
          // payload_snapshot is what lets a past send re-open in the composer,
          // so there's no need to archive rendered HTML separately.
          // The kind filter hides the lifecycle anchor rows: each automation owns
          // one purely so SES engagement has something to attribute to, and they
          // would otherwise read as campaigns nobody sent.
          .select(
            'id, created_at, mode, segment, test_email, subject, recipient_count, status, error_message, payload_snapshot'
          )
          .eq('kind', 'campaign')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase.rpc('get_email_campaign_stats'),
        supabase.rpc('get_scheduled_campaigns'),
      ]);

      if (countError) throw countError;
      if (logsError) throw logsError;
      // A missing segment count must not block sending: the picker falls back to
      // Everybody's count, and the send function resolves membership itself.
      if (segmentError) {
        console.error('Failed to load campaign segment counts:', segmentError.message);
      }
      setSegmentCounts(
        Object.fromEntries(
          ((segmentRows ?? []) as { segment: SegmentName; recipient_count: number }[]).map(
            (row) => [row.segment, Number(row.recipient_count ?? 0)]
          )
        ) as SegmentCounts
      );
      // Engagement is supplementary — a failure here shouldn't blank out the
      // audience counts and send log the admin actually needs to send mail.
      if (statsError) {
        console.error('Failed to load campaign engagement stats:', statsError.message);
      }
      setCampaignStats((stats ?? []) as CampaignStats[]);
      let normalizedScheduled: ScheduledCampaign[] = [];
      if (scheduledError) {
        console.error('Failed to load scheduled campaigns:', scheduledError.message);
      } else {
        normalizedScheduled = ((scheduledRows ?? []) as ScheduledCampaign[]).map((campaign) => ({
          ...campaign,
          recipient_count: Number(campaign.recipient_count ?? 0),
        }));
        setScheduledCampaigns(normalizedScheduled);
      }

      const row = Array.isArray(countRows) ? countRows[0] : countRows;
      setCounts({
        subscribed_total: Number(row?.subscribed_total ?? 0),
        subscribed_with_predictions: Number(row?.subscribed_with_predictions ?? 0),
        unsubscribed_total: Number(row?.unsubscribed_total ?? 0),
        production_segment_count: Number(row?.production_segment_count ?? 0),
      });
      const scheduledIds = new Set(normalizedScheduled.map((campaign) => campaign.campaign_id));
      setSendLogs(
        ((logs ?? []) as EmailSendLog[]).filter((log) => !scheduledIds.has(log.id))
      );
    } catch (error) {
      console.error('Failed to load admin email data:', error);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to load email admin data.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function resetDraft() {
    setDraft(createDraftFromTemplate(selectedTemplateId));
    setNotice({
      tone: 'success',
      message: `Email draft reset to the "${selectedTemplate?.label ?? 'selected'}" template.`,
    });
  }

  function loadTemplate(templateId: string) {
    const template = EMAIL_TEMPLATES.find((entry) => entry.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    setDraft(template.createDraft());
    if (template.recommendedSegment) {
      setSegment(template.recommendedSegment);
    }
    setNotice({
      tone: 'success',
      message: `Loaded the "${template.label}" template into the composer${
        template.recommendedSegment ? ' with its recommended audience' : ''
      }.`,
    });
  }

  function updateBlockText(blockId: string, text: string) {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === blockId ? ({ ...block, text } as EmailBlock) : block
      ),
    }));
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  async function handleTestSend() {
    const normalizedEmail = testEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setNotice({ tone: 'error', message: 'Enter a test email before sending.' });
      return;
    }

    setSendingTest(true);
    setNotice(null);

    try {
      const { data, error } = await supabase.functions.invoke<SendMarketingEmailResponse>(CAMPAIGN_EMAIL_FUNCTION, {
        body: {
          mode: 'test',
          testEmail: normalizedEmail,
          subject: draft.subject,
          previewText: draft.previewText,
          headerEyebrow: draft.headerEyebrow,
          headerTitle: draft.headerTitle,
          headerMeta: draft.headerMeta,
          footerLinkLabel: draft.footerLinkLabel,
          footerLinkHref: draft.footerLinkHref,
          blocks: draft.blocks,
        },
      });

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.error || 'Test email failed.');
      }

      setNotice({
        tone: 'success',
        message: `Test email sent to ${normalizedEmail}.`,
      });
      await loadPageData(true);
    } catch (error) {
      console.error('Failed to send test email:', error);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send test email.',
      });
    } finally {
      setSendingTest(false);
    }
  }

  async function handleProductionSend() {
    let scheduledAt: string | null = null;
    if (deliveryMode === 'schedule') {
      try {
        scheduledAt = centralDateTimeToIso(scheduledLocal);
        if (new Date(scheduledAt).getTime() <= Date.now() + 60_000) {
          throw new Error('Choose a delivery time at least one minute in the future.');
        }
      } catch (error) {
        setShowConfirmModal(false);
        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Choose a valid delivery time.',
        });
        return;
      }
    }

    setSendingProduction(true);
    setNotice(null);
    setShowConfirmModal(false);

    try {
      const { data, error } = await supabase.functions.invoke<SendMarketingEmailResponse>(CAMPAIGN_EMAIL_FUNCTION, {
        body: {
          mode: 'send',
          segment,
          scheduledAt,
          subject: draft.subject,
          previewText: draft.previewText,
          headerEyebrow: draft.headerEyebrow,
          headerTitle: draft.headerTitle,
          headerMeta: draft.headerMeta,
          footerLinkLabel: draft.footerLinkLabel,
          footerLinkHref: draft.footerLinkHref,
          blocks: draft.blocks,
        },
      });

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.error || 'Production send failed.');
      }

      if (data.scheduled && data.scheduledAt) {
        setComposerOpen(false);
        setNotice({
          tone: 'success',
          message: `Scheduled ${data.recipientCount ?? productionCount} recipients for ${formatCentralDateTime(data.scheduledAt)}.`,
        });
      // The send endpoint queues rather than sends: the edge runtime's CPU
      // budget can't encode a whole list in one request. Hand off to the
      // progress poller, which also drives each batch.
      } else if (data.queued && data.campaignId) {
        setActiveCampaign({
          id: data.campaignId,
          total: data.recipientCount ?? productionCount,
          sent: 0,
          failed: 0,
          pending: data.recipientCount ?? productionCount,
        });
        setNotice({
          tone: 'success',
          message: `Queued ${data.recipientCount ?? productionCount} recipients. Sending now…`,
        });
      } else {
        setNotice({
          tone: 'success',
          message: `Production email sent to ${data.recipientCount ?? productionCount} subscribed users.`,
        });
      }
      await loadPageData(true);
    } catch (error) {
      console.error('Failed to send production email:', error);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send production email.',
      });
    } finally {
      setSendingProduction(false);
    }
  }

  async function handleCancelScheduledCampaign() {
    if (!campaignToCancel) return;
    setCancellingCampaignId(campaignToCancel.campaign_id);
    setNotice(null);

    try {
      const { error } = await supabase.rpc('cancel_scheduled_campaign', {
        p_campaign_id: campaignToCancel.campaign_id,
      });
      if (error) throw error;
      setNotice({ tone: 'success', message: `Cancelled “${campaignToCancel.subject}”.` });
      setCampaignToCancel(null);
      await loadPageData(true);
    } catch (error) {
      console.error('Failed to cancel scheduled campaign:', error);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to cancel scheduled campaign.',
      });
    } finally {
      setCancellingCampaignId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Navbar />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-bears-orange" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Admin Email</p>
            <h1 className="mt-2 text-3xl font-bold text-bears-navy">Email Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Compose and send marketing emails to your users.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadPageData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        <NoticeBanner notice={notice} />

        <Tabs view={view} onChange={switchView} />

        {/* A send in flight shows on both tabs. The foreground poller lives in
            this shell while the database scheduler remains the durable backstop. */}
        {/* In-flight campaign progress */}
        {activeCampaign && (
          <section className="mt-6">
            <div className="rounded-3xl border border-bears-orange/30 bg-orange-50 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Sending</p>
                  <h2 className="mt-2 text-xl font-bold text-bears-navy">Campaign in progress</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Sending in resumable batches. You can safely close this page—the backend
                    scheduler will finish the campaign.
                  </p>
                </div>
                <Loader2 className="h-6 w-6 flex-shrink-0 animate-spin text-bears-orange" />
              </div>

              <div className="mt-5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-bears-orange transition-all duration-500"
                    style={{
                      width: `${
                        activeCampaign.total
                          ? Math.round(
                              ((activeCampaign.sent + activeCampaign.failed) / activeCampaign.total) * 100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
                  <span>{activeCampaign.sent} sent</span>
                  <span>{activeCampaign.pending} remaining</span>
                  {activeCampaign.failed > 0 && (
                    <span className="text-red-600">{activeCampaign.failed} failed</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {view === 'broadcasts' && (
          <>
          {/* Audience. production_segment_count is the same expression as
              subscribed_total in the RPC, so showing both was showing one number
              twice; the prediction count rides along as a sub-line instead. */}
          <section className="mt-8 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Total Users"
              value={(counts?.subscribed_total ?? 0) + (counts?.unsubscribed_total ?? 0)}
            />
            <StatCard
              label="Subscribed"
              value={counts?.subscribed_total ?? 0}
              sub={`${counts?.subscribed_with_predictions ?? 0} have made picks`}
              accent
            />
            <StatCard label="Unsubscribed" value={counts?.unsubscribed_total ?? 0} />
          </section>

          <ScheduledCampaigns
            campaigns={scheduledCampaigns}
            cancellingId={cancellingCampaignId}
            onCancel={setCampaignToCancel}
          />

          {/* The composer starts collapsed so the page opens on results and
              history rather than a form. Collapse is presentational only — the
              draft lives in this component, so closing it cannot discard work. */}
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-8 flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-5 text-left shadow-sm transition hover:border-slate-300"
            >
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-bears-navy">
                  {draft.subject || 'Untitled draft'}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {SEGMENT_OPTIONS.find((option) => option.value === segment)?.label} ·{' '}
                  {deliveryMode === 'schedule' ? scheduledForLabel : 'Send now'}
                </span>
              </span>
            </button>
          ) : (
            <>
            {/* Unified edit / preview panel */}
            <section className="mt-8">
              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Panel header */}
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setComposerOpen(false)}
                    aria-expanded
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ChevronRight className="h-4 w-4 flex-shrink-0 rotate-90 text-slate-400 transition-transform" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">
                        {viewMode === 'edit' ? 'Editing' : 'Preview'}
                      </span>
                      <span className="mt-1 block truncate text-xl font-bold text-bears-navy">
                        {viewMode === 'edit' ? 'Click any text to edit it directly' : 'Email layout preview'}
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setViewMode('edit')}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          viewMode === 'edit'
                            ? 'bg-white text-bears-navy shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('preview')}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          viewMode === 'preview'
                            ? 'bg-white text-bears-navy shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={saveDraft}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        savedFlash
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savedFlash ? 'Saved' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={resetDraft}
                      className="rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <CampaignSetup
                  segment={segment}
                  segmentCounts={segmentCounts}
                  onSegmentChange={setSegment}
                  templateId={selectedTemplateId}
                  onTemplateChange={setSelectedTemplateId}
                  onLoadTemplate={() => loadTemplate(selectedTemplateId)}
                  deliveryMode={deliveryMode}
                  onDeliveryModeChange={setDeliveryMode}
                  scheduledLocal={scheduledLocal}
                  minimumScheduledLocal={minimumScheduledLocal}
                  onScheduledLocalChange={setScheduledLocal}
                />

                {/* Subject + preview text — visible in edit mode */}
                {viewMode === 'edit' && (
                  <div className="grid gap-4 border-b border-slate-100 px-6 py-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={draft.subject}
                        onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-bears-orange focus:ring-2 focus:ring-bears-orange/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Preview text
                      </label>
                      <input
                        type="text"
                        value={draft.previewText}
                        onChange={(event) => setDraft((current) => ({ ...current, previewText: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-bears-orange focus:ring-2 focus:ring-bears-orange/20"
                      />
                    </div>
                  </div>
                )}

                {/* Email body */}
                <div className="p-6">
                  <EditableEmailShell
                    draft={draft}
                    isEditing={viewMode === 'edit'}
                    onBlockChange={updateBlockText}
                  />
                </div>

                {/* Send controls live with the draft they act on, rather than in
                    three cards below it. Test first; the production send still
                    goes through the confirm step. */}
                <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-bears-navy">
                      {productionCount} {productionCount === 1 ? 'recipient' : 'recipients'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {deliveryMode === 'schedule' ? scheduledForLabel : 'Ready to send now'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleTestSend()}
                      disabled={sendingTest}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-bears-orange px-3 py-2 text-xs font-bold text-bears-orange transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sendingTest && <Loader2 className="h-3 w-3 animate-spin" />}
                      {sendingTest ? 'Sending…' : 'Send test'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      disabled={productionCount === 0 || activeCampaign !== null || !scheduleIsValid}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-bears-navy px-4 py-2 text-xs font-bold text-white transition hover:bg-bears-navy/95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      {deliveryMode === 'schedule' ? (
                        <CalendarClock className="h-3.5 w-3.5" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {activeCampaign
                        ? 'Sending in progress…'
                        : deliveryMode === 'schedule'
                          ? 'Review schedule'
                          : 'Review & send'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
            </>
          )}

          {/* Recent sends. Engagement now lives inside each row rather than in a
              separate section, so a campaign and its results read as one thing. */}
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-bold text-bears-navy">Recent Sends</h2>
            <RecentSends
              logs={sendLogs}
              statsByCampaign={statsByCampaign}
              onDuplicate={(next) => {
                setDraft(next);
                setComposerOpen(true);
                setViewMode('edit');
                setNotice({ tone: 'success', message: 'Loaded that send into the composer.' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </section>
          </>
        )}

        {view === 'automations' && <AutomationsTab />}
      </div>

      <ConfirmSendModal
        open={showConfirmModal}
        recipientCount={productionCount}
        subject={draft.subject}
        audienceLabel={
          SEGMENT_OPTIONS.find((option) => option.value === segment)?.label ?? segment
        }
        isNarrowedAudience={segment !== 'all_subscribed_users'}
        sending={sendingProduction}
        scheduledFor={scheduledForLabel}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={() => void handleProductionSend()}
      />
      <CancelScheduledModal
        campaign={campaignToCancel}
        cancelling={cancellingCampaignId !== null}
        onClose={() => setCampaignToCancel(null)}
        onConfirm={() => void handleCancelScheduledCampaign()}
      />
    </div>
  );
}

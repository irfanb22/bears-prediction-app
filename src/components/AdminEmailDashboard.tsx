import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Edit2,
  Eye,
  Loader2,
  Mail,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Users,
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
} from '../lib/emailComposer';

import {
  type ActiveCampaign,
  type AudienceCounts,
  type CampaignStats,
  type EmailSendLog,
  type LinkClicks,
  type Notice,
  type SendBrevoEmailResponse,
  DRAFT_STORAGE_KEY,
  FIXED_SEGMENT,
} from './admin-email/types';
import { ConfirmSendModal } from './admin-email/ConfirmSendModal';
import { EditableEmailShell } from './admin-email/EmailPreviewShell';
import { NoticeBanner } from './admin-email/NoticeBanner';
import { AutomationsTab } from './admin-email/AutomationsTab';
import { Tabs, type DashboardView } from './admin-email/Tabs';


function EngagementStat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: 'warn' | 'bad';
}) {
  const valueColor =
    tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-bears-navy';

  return (
    <div className="rounded-xl border border-slate-200 px-3 py-3 text-center">
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {suffix ? <p className="mt-0.5 text-[11px] text-slate-400">{suffix}</p> : null}
    </div>
  );
}

export function AdminEmailDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<AudienceCounts | null>(null);
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
          return { ...createDefaultRecapDraft(), ...parsed } as EmailComposerDraft;
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
  // Link breakdowns are fetched only when a campaign is expanded — the raw event
  // rows are far bulkier than the rollup and most campaigns are never opened.
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [linkClicks, setLinkClicks] = useState<Record<string, LinkClicks[]>>({});
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<ActiveCampaign | null>(null);

  /**
   * While a campaign is in flight, drive a batch and read progress on each tick.
   *
   * The UI is the primary engine here rather than a passive observer — a tick
   * every few seconds drains far faster than the once-a-minute cron, which
   * exists only so closing this tab can't strand a half-sent campaign.
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
        // Losing one batch isn't fatal: the rows stay claimable and either the
        // next tick or the cron picks them up.
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
  async function toggleCampaign(campaignId: string) {
    if (expandedCampaign === campaignId) {
      setExpandedCampaign(null);
      return;
    }

    setExpandedCampaign(campaignId);
    if (linkClicks[campaignId]) return;

    setLoadingLinks(true);
    try {
      const { data, error } = await supabase
        .from('email_marketing_events')
        .select('detail, recipient')
        .eq('campaign_id', campaignId)
        .eq('event_type', 'click');

      if (error) throw error;

      const byUrl = new Map<string, Set<string>>();
      for (const row of data ?? []) {
        const url = (row as { detail: string | null }).detail;
        if (!url) continue;
        const who = (row as { recipient: string | null }).recipient ?? 'unknown';
        if (!byUrl.has(url)) byUrl.set(url, new Set());
        byUrl.get(url)!.add(who);
      }

      const breakdown = [...byUrl.entries()]
        .map(([url, people]) => ({ url, clickers: people.size }))
        .sort((a, b) => b.clickers - a.clickers);

      setLinkClicks((current) => ({ ...current, [campaignId]: breakdown }));
    } catch (error) {
      console.error('Failed to load link clicks:', error);
      setLinkClicks((current) => ({ ...current, [campaignId]: [] }));
    } finally {
      setLoadingLinks(false);
    }
  }

  const productionCount = counts?.production_segment_count ?? 0;
  const selectedTemplate =
    EMAIL_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? EMAIL_TEMPLATES[0];

  const statCards = useMemo(() => {
    if (!counts) return [];

    return [
      { label: 'Subscribed Users', value: counts.subscribed_total, icon: Users },
      { label: 'Subscribed With Predictions', value: counts.subscribed_with_predictions, icon: ShieldCheck },
      { label: 'Unsubscribed', value: counts.unsubscribed_total, icon: Mail },
      { label: 'Send Segment Count', value: counts.production_segment_count, icon: Send },
    ];
  }, [counts]);

  async function loadPageData(showRefreshState = false) {
    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [
        { data: countRows, error: countError },
        { data: logs, error: logsError },
        { data: stats, error: statsError },
      ] = await Promise.all([
        supabase.rpc('get_admin_email_audience_counts'),
        supabase
          .from('email_send_logs')
          .select('id, created_at, mode, segment, test_email, subject, recipient_count, status, error_message')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.rpc('get_email_campaign_stats'),
      ]);

      if (countError) throw countError;
      if (logsError) throw logsError;
      // Engagement is supplementary — a failure here shouldn't blank out the
      // audience counts and send log the admin actually needs to send mail.
      if (statsError) {
        console.error('Failed to load campaign engagement stats:', statsError.message);
      }
      setCampaignStats((stats ?? []) as CampaignStats[]);

      const row = Array.isArray(countRows) ? countRows[0] : countRows;
      setCounts({
        subscribed_total: Number(row?.subscribed_total ?? 0),
        subscribed_with_predictions: Number(row?.subscribed_with_predictions ?? 0),
        unsubscribed_total: Number(row?.unsubscribed_total ?? 0),
        production_segment_count: Number(row?.production_segment_count ?? 0),
      });
      setSendLogs((logs ?? []) as EmailSendLog[]);
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
    setNotice({
      tone: 'success',
      message: `Loaded the "${template.label}" template into the composer.`,
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
      const { data, error } = await supabase.functions.invoke<SendBrevoEmailResponse>('send-brevo-email', {
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
    setSendingProduction(true);
    setNotice(null);
    setShowConfirmModal(false);

    try {
      const { data, error } = await supabase.functions.invoke<SendBrevoEmailResponse>('send-brevo-email', {
        body: {
          mode: 'send',
          segment: FIXED_SEGMENT,
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

      // The send endpoint queues rather than sends: the edge runtime's CPU
      // budget can't encode a whole list in one request. Hand off to the
      // progress poller, which also drives each batch.
      if (data.queued && data.campaignId) {
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
            <button
              type="button"
              onClick={saveDraft}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                savedFlash
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <Save className="h-4 w-4" />
              {savedFlash ? 'Saved!' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={resetDraft}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Reset Draft
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

        {/* A send in flight shows on both tabs. The interval driving it
            lives in this component, so leaving Broadcasts must not unmount
            it — nothing else would pick the campaign back up. */}
        {/* In-flight campaign progress */}
        {activeCampaign && (
          <section className="mt-6">
            <div className="rounded-3xl border border-bears-orange/30 bg-orange-50 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Sending</p>
                  <h2 className="mt-2 text-xl font-bold text-bears-navy">Campaign in progress</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Sending in batches to stay inside the runtime limits. Safe to leave this page —
                    a scheduled job finishes anything still queued.
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
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-500">{card.label}</span>
                    <span className="rounded-full bg-slate-100 p-2 text-slate-600">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-4 text-3xl font-black tracking-tight text-bears-navy">{card.value}</div>
                </div>
              );
            })}
          </section>

          {/* Unified edit / preview panel */}
          <section className="mt-8">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">
                    {viewMode === 'edit' ? 'Editing' : 'Preview'}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-bears-navy">
                    {viewMode === 'edit' ? 'Click any text to edit it directly' : 'Email layout preview'}
                  </h2>
                </div>
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
              </div>

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
            </div>
          </section>

          {/* Send sections — 3 columns */}
          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Templates */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Templates</p>
                  <h2 className="mt-2 text-xl font-bold text-bears-navy">Start from a reusable draft</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Pick a template and load it into the composer.
                  </p>
                </div>
                <Mail className="h-6 w-6 flex-shrink-0 text-bears-orange" />
              </div>

              <div className="mt-6 space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Template</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-bears-orange focus:ring-2 focus:ring-bears-orange/20"
                  >
                    {EMAIL_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTemplate && (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <div className="font-semibold text-slate-900">{selectedTemplate.label}</div>
                    <div className="mt-1">{selectedTemplate.description}</div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => loadTemplate(selectedTemplateId)}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-bears-navy px-4 py-3 text-sm font-bold text-white transition hover:bg-bears-navy/95"
                >
                  Load Template
                </button>
              </div>
            </div>

            {/* Send Test */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Send Test</p>
                  <h2 className="mt-2 text-xl font-bold text-bears-navy">Send the current draft to yourself</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Sends the exact subject, preview text, and layout from the current draft.
                  </p>
                </div>
                <Mail className="h-6 w-6 flex-shrink-0 text-bears-orange" />
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="test-email" className="mb-2 block text-sm font-semibold text-slate-700">
                    Test email
                  </label>
                  <input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-bears-orange focus:ring-2 focus:ring-bears-orange/20"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div className="font-semibold text-slate-900">Current subject</div>
                  <div className="mt-1">{draft.subject}</div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleTestSend()}
                  disabled={sendingTest}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-bears-orange px-4 py-3 text-sm font-bold text-white transition hover:bg-bears-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Test Email
                </button>
              </div>
            </div>

            {/* Production Send */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Production Send</p>
                  <h2 className="mt-2 text-xl font-bold text-bears-navy">Send this draft to all subscribed users</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Production uses the exact draft state from this composer — send yourself a test first.
                  </p>
                </div>
                <ShieldCheck className="h-6 w-6 flex-shrink-0 text-bears-orange" />
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <div className="font-semibold">Ready segment</div>
                <div className="mt-1">{productionCount} subscribed users</div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={sendingProduction || activeCampaign !== null || productionCount === 0}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-bears-navy px-4 py-3 text-sm font-bold text-white transition hover:bg-bears-navy/95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingProduction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send To Production Segment
              </button>
            </div>
          </section>

          {/* Campaign Engagement */}
          <section className="mt-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Engagement</p>
                  <h2 className="mt-2 text-xl font-bold text-bears-navy">Campaign performance</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Delivery and engagement reported by AWS SES. Every number counts each person once,
                    so repeat opens don&apos;t inflate reach.
                  </p>
                </div>
                <BarChart3 className="h-6 w-6 flex-shrink-0 text-bears-orange" />
              </div>

              <div className="mt-6 space-y-3">
                {campaignStats.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No production campaigns sent yet. Test sends aren&apos;t tracked here.
                  </div>
                ) : (
                  campaignStats.map((campaign) => {
                    // Rates are against delivered, not recipients: a message that
                    // bounced was never eligible to be opened, and including it
                    // would understate how the campaign actually performed.
                    const openRate = campaign.delivered
                      ? Math.round((campaign.opened / campaign.delivered) * 100)
                      : 0;
                    const clickRate = campaign.delivered
                      ? Math.round((campaign.clicked / campaign.delivered) * 100)
                      : 0;
                    const hasEvents =
                      campaign.delivered + campaign.opened + campaign.clicked +
                        campaign.bounced + campaign.complained > 0;
                    const isExpanded = expandedCampaign === campaign.campaign_id;
                    const links = linkClicks[campaign.campaign_id];

                    return (
                      <div
                        key={campaign.campaign_id}
                        className="rounded-2xl border border-slate-200 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {campaign.subject}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                              <span>{new Date(campaign.sent_at).toLocaleDateString()}</span>
                              <span>{campaign.recipient_count} recipients</span>
                            </div>
                          </div>
                          {hasEvents && (
                            <button
                              type="button"
                              onClick={() => void toggleCampaign(campaign.campaign_id)}
                              className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600 transition hover:border-bears-orange hover:text-bears-orange"
                            >
                              {isExpanded ? 'Hide links' : 'Top links'}
                            </button>
                          )}
                        </div>

                        {hasEvents ? (
                          <>
                            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                              <EngagementStat label="Delivered" value={campaign.delivered} />
                              <EngagementStat label="Opened" value={campaign.opened} suffix={`${openRate}%`} />
                              <EngagementStat label="Clicked" value={campaign.clicked} suffix={`${clickRate}%`} />
                              <EngagementStat label="Bounced" value={campaign.bounced} tone={campaign.bounced > 0 ? 'warn' : undefined} />
                              <EngagementStat label="Complaints" value={campaign.complained} tone={campaign.complained > 0 ? 'bad' : undefined} />
                            </div>

                            {/* Opens are the least trustworthy number here, and the
                                reason is worth stating rather than leaving the admin
                                to wonder why it looks low or improbably high. */}
                            <p className="mt-3 text-xs text-slate-400">
                              Open tracking is approximate — image blocking suppresses it, privacy
                              proxies inflate it. Clicks are the reliable signal.
                            </p>
                          </>
                        ) : (
                          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                            No engagement events recorded. Campaigns sent before SES tracking was
                            wired up won&apos;t have any.
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            {loadingLinks && !links ? (
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading link clicks…
                              </div>
                            ) : links && links.length > 0 ? (
                              <ul className="space-y-2">
                                {links.map((link) => (
                                  <li key={link.url} className="flex items-start justify-between gap-3 text-xs">
                                    <span className="min-w-0 flex-1 truncate text-slate-600" title={link.url}>
                                      {link.url}
                                    </span>
                                    <span className="shrink-0 font-bold text-bears-navy">
                                      {link.clickers}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500">No links were clicked.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Recent Sends */}
          <section className="mt-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Recent Sends</p>
                  <h2 className="mt-2 text-xl font-bold text-bears-navy">Latest email activity</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Every test and production send is logged so you can confirm what went out and when.
                  </p>
                </div>
                <Mail className="h-6 w-6 flex-shrink-0 text-bears-orange" />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {sendLogs.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No email sends logged yet.
                  </div>
                ) : (
                  sendLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {log.mode === 'test'
                              ? `Test → ${log.test_email ?? 'unknown'}`
                              : 'Production send'}
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-600">{log.subject}</div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                            log.status === 'succeeded'
                              ? 'bg-emerald-100 text-emerald-700'
                              : log.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                        <span>{log.recipient_count} recipients</span>
                      </div>

                      {log.error_message && (
                        <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
          </>
        )}

        {view === 'automations' && <AutomationsTab />}
      </div>

      <ConfirmSendModal
        open={showConfirmModal}
        recipientCount={productionCount}
        subject={draft.subject}
        sending={sendingProduction}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={() => void handleProductionSend()}
      />
    </div>
  );
}

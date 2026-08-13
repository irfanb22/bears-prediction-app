import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
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
import { AnimatePresence, motion } from 'framer-motion';
import { Navbar } from './Navbar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  EMAIL_TEMPLATES,
  type EmailBlock,
  type EmailButtonBlock,
  type EmailComposerDraft,
  type EmailImageWidth,
  type EmailSpacerSize,
  createDraftFromTemplate,
  createDefaultRecapDraft,
} from '../lib/emailComposer';

interface AudienceCounts {
  subscribed_total: number;
  subscribed_with_predictions: number;
  unsubscribed_total: number;
  production_segment_count: number;
}

interface EmailSendLog {
  id: string;
  created_at: string;
  mode: 'test' | 'send';
  segment: string | null;
  test_email: string | null;
  subject: string;
  recipient_count: number;
  status: 'started' | 'succeeded' | 'failed';
  error_message: string | null;
}

interface SendBrevoEmailResponse {
  ok?: boolean;
  error?: string;
  recipientCount?: number;
  /** Production sends are queued and drained in batches; tests send inline. */
  queued?: boolean;
  campaignId?: string;
}

interface ActiveCampaign {
  id: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

/**
 * Per-campaign engagement, from `get_email_campaign_stats()`.
 *
 * Every count is DISTINCT by recipient. SES fires an open event each time the
 * tracking pixel loads — Gmail's image proxy alone produces a second one — so
 * raw event counts overstate reach badly on small sends.
 *
 * Production sends only; test sends are excluded so they can't skew a campaign's
 * numbers.
 */
interface CampaignStats {
  campaign_id: string;
  subject: string;
  sent_at: string;
  recipient_count: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
}

interface LinkClicks {
  url: string;
  clickers: number;
}

const FIXED_SEGMENT = 'all_subscribed_users';
const DRAFT_STORAGE_KEY = 'admin_email_draft_v1';

type Notice = { tone: 'success' | 'error'; message: string } | null;

function getImageBlockWidthClass(width: EmailImageWidth) {
  if (width === 'compact') return 'max-w-[72%]';
  if (width === 'medium') return 'max-w-[92%]';
  if (width === 'wide') return 'max-w-full';
  return 'max-w-full';
}

function getSpacerHeight(size: EmailSpacerSize) {
  if (size === 's') return '24px';
  if (size === 'l') return '56px';
  return '40px';
}

function renderInlineStrongText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${part}-${index}`} className="font-extrabold text-bears-navy">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function EmailPreviewBlock({ block }: { block: EmailBlock }) {
  if (block.type === 'heading') {
    return <h2 className="text-[30px] font-black leading-tight tracking-tight text-bears-navy">{block.text}</h2>;
  }

  if (block.type === 'paragraph') {
    return (
      <p className="text-[18px] leading-[1.68] text-slate-700 whitespace-pre-wrap">
        {renderInlineStrongText(block.text)}
      </p>
    );
  }

  if (block.type === 'image') {
    return (
      <div className={`mx-auto ${getImageBlockWidthClass(block.width)}`}>
        <a href={block.href || '#'} className="block" onClick={(event) => event.preventDefault()}>
          <img
            src={block.src}
            alt={block.alt}
            className={`block w-full h-auto ${block.framed === false ? '' : 'rounded-[24px] border border-slate-200'}`}
          />
        </a>
        {block.caption && <p className="pt-2 text-sm leading-6 text-slate-500">{block.caption}</p>}
      </div>
    );
  }

  if (block.type === 'button') {
    const toneClass =
      block.tone === 'primary'
        ? 'bg-bears-orange text-white'
        : 'border border-slate-300 bg-white text-slate-800';
    return (
      <div className="text-center">
        <a
          href={block.href}
          onClick={(event) => event.preventDefault()}
          className={`inline-flex rounded-full px-6 py-3 text-base font-bold ${toneClass}`}
        >
          {block.label}
        </a>
      </div>
    );
  }

  if (block.type === 'signature') {
    return (
      <p
        className="text-[46px] leading-none text-bears-navy"
        style={{ fontFamily: '"Brush Script MT", "Snell Roundhand", cursive' }}
      >
        {block.text}
      </p>
    );
  }

  return <div style={{ height: getSpacerHeight(block.size) }} />;
}

function EmailPreviewButtonRow({ buttons }: { buttons: EmailButtonBlock[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-3">
      {buttons.map((button) => {
        const toneClass =
          button.tone === 'primary'
            ? 'bg-bears-orange text-white'
            : 'border border-slate-300 bg-white text-slate-800';

        return (
          <a
            key={button.id}
            href={button.href}
            onClick={(event) => event.preventDefault()}
            className={`inline-flex rounded-full px-6 py-3 text-[16px] font-bold ${toneClass}`}
          >
            {button.label}
          </a>
        );
      })}
    </div>
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
      rows={1}
      style={{ overflow: 'hidden' }}
    />
  );
}

function EditableEmailShell({
  draft,
  isEditing,
  onBlockChange,
}: {
  draft: EmailComposerDraft;
  isEditing: boolean;
  onBlockChange: (blockId: string, text: string) => void;
}) {
  const previewBlocks: Array<{ key: string; content: JSX.Element }> = [];

  for (let index = 0; index < draft.blocks.length; index += 1) {
    const block = draft.blocks[index];

    if (block.type === 'button') {
      const buttons: EmailButtonBlock[] = [block];

      while (index + 1 < draft.blocks.length && draft.blocks[index + 1].type === 'button') {
        buttons.push(draft.blocks[index + 1] as EmailButtonBlock);
        index += 1;
      }

      previewBlocks.push({
        key: buttons.map((button) => button.id).join('-'),
        content: <EmailPreviewButtonRow buttons={buttons} />,
      });
      continue;
    }

    if (isEditing && block.type === 'heading') {
      previewBlocks.push({
        key: block.id,
        content: (
          <AutoResizeTextarea
            value={block.text}
            onChange={(text) => onBlockChange(block.id, text)}
            className="w-full resize-none bg-transparent text-[30px] font-black leading-tight tracking-tight text-bears-navy outline-none rounded-lg px-1 -mx-1 transition focus:ring-2 focus:ring-bears-orange/30 focus:bg-bears-orange/[0.03]"
          />
        ),
      });
      continue;
    }

    if (isEditing && block.type === 'paragraph') {
      previewBlocks.push({
        key: block.id,
        content: (
          <AutoResizeTextarea
            value={block.text}
            onChange={(text) => onBlockChange(block.id, text)}
            className="w-full resize-none bg-transparent text-[18px] leading-[1.68] text-slate-700 outline-none rounded-lg px-1 -mx-1 transition focus:ring-2 focus:ring-bears-orange/30 focus:bg-bears-orange/[0.03]"
          />
        ),
      });
      continue;
    }

    previewBlocks.push({
      key: block.id,
      content: <EmailPreviewBlock block={block} />,
    });
  }

  return (
    <div className="rounded-[32px] border border-slate-200 bg-slate-100 p-4 shadow-sm">
      <div className="mx-auto max-w-[720px] overflow-hidden rounded-[24px] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="bg-bears-navy px-5 py-5 text-center">
          <div className="text-[20px] font-extrabold tracking-[0.01em] text-white">Bears Prediction Tracker</div>
        </div>

        <div className="px-5 py-8">
          {draft.headerEyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-bears-orange">{draft.headerEyebrow}</p>
          ) : null}
          {draft.headerTitle ? (
            <h1 className="mt-3 text-[36px] font-black leading-[1.05] tracking-tight text-bears-navy">
              {draft.headerTitle}
            </h1>
          ) : null}
          {draft.headerMeta ? (
            <p className="mt-4 text-[13px] font-bold uppercase tracking-[0.18em] text-slate-500">{draft.headerMeta}</p>
          ) : null}

          <div className={`${draft.headerEyebrow || draft.headerTitle || draft.headerMeta ? 'mt-8' : 'mt-2'} space-y-9`}>
            {previewBlocks.map((block) => (
              <div key={block.key}>{block.content}</div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-10 text-center text-[15px] leading-7 text-slate-500">
          {draft.footerLinkLabel && draft.footerLinkHref ? (
            <>
              <a href={draft.footerLinkHref} onClick={(event) => event.preventDefault()} className="underline">
                {draft.footerLinkLabel}
              </a>
              <span className="px-2 text-slate-300">|</span>
            </>
          ) : null}
          <span className="underline">Unsubscribe</span>
        </div>
      </div>
    </div>
  );
}

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
      if (saved) return JSON.parse(saved) as EmailComposerDraft;
    } catch {}
    return createDefaultRecapDraft();
  });
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
            <h1 className="mt-2 text-3xl font-bold text-bears-navy">Email Composer</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Start from a template, edit the draft directly in the preview, then send when it looks right.
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

        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`mt-6 flex items-start gap-3 rounded-2xl border px-4 py-4 shadow-sm ${
                notice.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {notice.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{notice.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

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
      </div>

      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            >
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Confirm Send</p>
              <h3 className="mt-2 text-2xl font-bold text-bears-navy">Send this draft to {productionCount} users?</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This will send the exact composer draft to all subscribed users.
              </p>

              <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Subject</div>
                <div className="mt-1">{draft.subject}</div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleProductionSend()}
                  disabled={sendingProduction}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-bears-orange px-4 py-3 text-sm font-bold text-white transition hover:bg-bears-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingProduction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Confirm Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

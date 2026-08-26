import { useState } from 'react';
import { ChevronRight, Copy } from 'lucide-react';
import type { EmailComposerDraft } from '../../lib/emailComposer';
import { CampaignStatsPanel, fetchLinkClicks } from './CampaignStatsPanel';
import { EditableEmailShell } from './EmailPreviewShell';
import { StatusBadge } from './StatusBadge';
import type { CampaignStats, EmailSendLog, LinkClicks } from './types';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * A past send's stored payload, if it still round-trips into the composer.
 *
 * Every send writes its full draft to `payload_snapshot`, so re-opening an old
 * campaign needs no separate archive of rendered HTML — but snapshots predating
 * the block composer won't have `blocks`, so the shape is checked before use.
 */
function draftFromSnapshot(snapshot: unknown): EmailComposerDraft | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidate = snapshot as Partial<EmailComposerDraft>;
  if (!Array.isArray(candidate.blocks) || candidate.blocks.length === 0) return null;
  return {
    subject: candidate.subject ?? '',
    previewText: candidate.previewText ?? '',
    headerEyebrow: candidate.headerEyebrow ?? '',
    headerTitle: candidate.headerTitle ?? '',
    headerMeta: candidate.headerMeta ?? '',
    footerLinkLabel: candidate.footerLinkLabel ?? '',
    footerLinkHref: candidate.footerLinkHref ?? '',
    blocks: candidate.blocks,
  };
}

export function RecentSends({
  logs,
  statsByCampaign,
  onDuplicate,
}: {
  logs: EmailSendLog[];
  statsByCampaign: Record<string, CampaignStats>;
  onDuplicate: (draft: EmailComposerDraft) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkClicks, setLinkClicks] = useState<Record<string, LinkClicks[]>>({});
  const [loadingLinks, setLoadingLinks] = useState<string | null>(null);

  async function toggle(log: EmailSendLog) {
    if (expandedId === log.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(log.id);

    // Fetched once per send and kept for the session. This is an admin screen
    // opened briefly, so staleness costs less than refetching on every toggle.
    if (linkClicks[log.id] || loadingLinks === log.id) return;

    setLoadingLinks(log.id);
    try {
      const breakdown = await fetchLinkClicks(log.id);
      setLinkClicks((current) => ({ ...current, [log.id]: breakdown }));
    } catch (error) {
      console.error('Failed to load link clicks:', error);
      setLinkClicks((current) => ({ ...current, [log.id]: [] }));
    } finally {
      setLoadingLinks((current) => (current === log.id ? null : current));
    }
  }

  if (logs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
        No emails sent yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const expanded = expandedId === log.id;
        const stats = statsByCampaign[log.id];
        const snapshotDraft = draftFromSnapshot(log.payload_snapshot);
        const isTest = log.mode === 'test';

        return (
          <div key={log.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => void toggle(log)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <ChevronRight
                  className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${
                    expanded ? 'rotate-90' : ''
                  }`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-bears-navy">{log.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {isTest ? (
                      <>Test → {log.test_email}</>
                    ) : (
                      <>
                        {/* SES acceptance, not delivery confirmation — those are
                            different facts and the tiles below report both. */}
                        {stats?.sent_count ?? 0} of {log.recipient_count} sent
                        {stats && stats.failed_count > 0 && (
                          <span className="text-red-600"> · {stats.failed_count} failed</span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-3">
                <StatusBadge status={log.status} />
                <span className="hidden text-xs text-slate-400 sm:inline">
                  {formatWhen(log.created_at)}
                </span>
              </div>
            </button>

            {expanded && (
              <div className="border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                  <span className="min-w-0 truncate text-xs text-slate-500">
                    {log.error_message ? (
                      <span className="text-red-600">{log.error_message}</span>
                    ) : (
                      log.segment ?? ''
                    )}
                  </span>
                  {snapshotDraft ? (
                    <button
                      type="button"
                      onClick={() => onDuplicate(snapshotDraft)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-bears-orange px-3 py-1.5 text-xs font-bold text-white transition hover:bg-bears-orange/90"
                    >
                      <Copy className="h-3 w-3" />
                      Duplicate into composer
                    </button>
                  ) : (
                    <span className="text-xs italic text-slate-400">No saved copy of this send</span>
                  )}
                </div>

                <div className="px-4 py-4">
                  {isTest ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      Test sends aren't tracked — they'd distort a campaign's numbers.
                    </p>
                  ) : stats ? (
                    <CampaignStatsPanel
                      stats={stats}
                      links={linkClicks[log.id]}
                      loadingLinks={loadingLinks === log.id}
                    />
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      No engagement recorded for this send.
                    </p>
                  )}

                  {snapshotDraft && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium text-slate-500">What was sent</p>
                      <EditableEmailShell
                        draft={snapshotDraft}
                        isEditing={false}
                        onBlockChange={() => {}}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

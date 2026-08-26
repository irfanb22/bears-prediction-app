import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import type { EmailComposerDraft } from '../../lib/emailComposer';
import { starterBlocksFor } from '../../lib/emailComposer';
import {
  AUDIENCE_LABELS,
  configToDraft,
  previewLifecycleRecipients,
  setLifecycleEnabled,
  updateLifecycleConfig,
  type LifecycleConfig,
} from '../../lib/lifecycleEmails';
import { EditableEmailShell } from './EmailPreviewShell';

export function AutomationCard({
  config,
  expanded,
  onToggleExpand,
  onChanged,
}: {
  config: LifecycleConfig;
  expanded: boolean;
  onToggleExpand: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<EmailComposerDraft>(() => configToDraft(config));
  const [delayHours, setDelayHours] = useState(config.delay_hours);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Reseed when the card opens. An automation with no blocks yet gets the
  // scaffold and opens pre-dirty, because the scaffold only exists in this
  // component until it's saved — but opening a card must never write on its own.
  useEffect(() => {
    if (!expanded) return;
    const base = configToDraft(config);
    const needsScaffold = base.blocks.length === 0;
    setDraft(needsScaffold ? { ...base, blocks: starterBlocksFor(config.email_type) } : base);
    setDelayHours(config.delay_hours);
    setDirty(needsScaffold);
    setStatus(null);
  }, [expanded, config]);

  async function save(): Promise<boolean> {
    setSaving(true);
    setStatus(null);
    try {
      await updateLifecycleConfig({
        emailType: config.email_type,
        subject: draft.subject,
        previewText: draft.previewText || null,
        delayHours,
        headerEyebrow: draft.headerEyebrow,
        headerTitle: draft.headerTitle,
        headerMeta: draft.headerMeta,
        footerLinkLabel: draft.footerLinkLabel,
        footerLinkHref: draft.footerLinkHref,
        blocks: draft.blocks,
      });
      setDirty(false);
      setStatus({ tone: 'ok', text: 'Saved' });
      await onChanged();
      return true;
    } catch (error) {
      setStatus({ tone: 'bad', text: error instanceof Error ? error.message : 'Could not save' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    const turningOn = !config.enabled;

    // Unsaved edits have to land first: the sender reads the database, not this
    // screen, so flipping the switch on stale content would ship stale content.
    if (turningOn && expanded && dirty) {
      if (!(await save())) return;
    }

    try {
      await setLifecycleEnabled(config.email_type, turningOn);
      setStatus(null);
      await onChanged();
    } catch (error) {
      setStatus({
        tone: 'bad',
        text: error instanceof Error ? error.message : 'Could not change that',
      });
      if (!expanded) onToggleExpand();
    }
  }

  async function runPreview() {
    setPreviewing(true);
    setStatus(null);
    try {
      const { wouldSend } = await previewLifecycleRecipients(config.email_type);
      setStatus({
        tone: 'ok',
        text:
          wouldSend === 0
            ? 'Nobody is eligible right now.'
            : `${wouldSend} ${wouldSend === 1 ? 'person' : 'people'} would receive this on the next run.`,
      });
    } catch (error) {
      setStatus({ tone: 'bad', text: error instanceof Error ? error.message : 'Preview failed' });
    } finally {
      setPreviewing(false);
    }
  }

  function updateBlockText(blockId: string, text: string) {
    setDirty(true);
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === blockId && 'text' in block ? { ...block, text } : block
      ),
    }));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold text-bears-navy">{config.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Sends {config.delay_hours}h after signup · {config.sent_count} sent so far ·{' '}
            {expanded ? 'click to collapse' : 'click to edit'}
          </p>
        </button>

        <div className="flex flex-shrink-0 items-center gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              config.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {config.enabled ? 'Ready' : 'Off'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            aria-label={
              config.enabled
                ? 'Ready — will send once scheduling is enabled'
                : 'Off — not sending'
            }
            onClick={() => void toggleEnabled()}
            className={`relative h-[22px] w-10 flex-shrink-0 rounded-full transition-colors ${
              config.enabled ? 'bg-bears-orange' : 'bg-slate-300'
            }`}
          >
            <span
              className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all"
              style={{ left: config.enabled ? 21 : 3 }}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Send
              <input
                type="number"
                min={1}
                max={720}
                value={delayHours}
                onChange={(event) => {
                  setDelayHours(Number(event.target.value));
                  setDirty(true);
                }}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-bears-orange"
              />
              hours after signup
            </label>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
              <Users className="h-3 w-3" />
              {AUDIENCE_LABELS[config.audience]}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={draft.subject}
              onChange={(event) => {
                setDraft((c) => ({ ...c, subject: event.target.value }));
                setDirty(true);
              }}
              placeholder="Subject"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-bears-orange"
            />
            <input
              value={draft.previewText}
              onChange={(event) => {
                setDraft((c) => ({ ...c, previewText: event.target.value }));
                setDirty(true);
              }}
              placeholder="Preview text (inbox snippet, optional)"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-bears-orange"
            />
          </div>

          <div className="mt-4">
            <EditableEmailShell draft={draft} isEditing onBlockChange={updateBlockText} />
          </div>

          <p className="mt-3 text-xs text-slate-400">
            You can edit the subject, preview text, timing, and any text in the email. Buttons,
            images, and who receives this are set in code.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span
              className={`text-xs ${
                status ? (status.tone === 'ok' ? 'text-emerald-600' : 'text-red-600') : 'text-slate-500'
              }`}
            >
              {status ? status.text : `${config.sent_count} sent so far`}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runPreview()}
                disabled={previewing || !config.enabled}
                title={
                  config.enabled
                    ? undefined
                    : 'Switch this on first — eligibility only counts while an automation is on'
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {previewing && <Loader2 className="h-3 w-3 animate-spin" />}
                Preview recipients
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-bears-orange px-4 py-2 text-xs font-bold text-white transition hover:bg-bears-orange/90 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

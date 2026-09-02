/**
 * The email preview surface: block renderers plus the branded shell that wraps
 * them. Extracted verbatim from AdminEmailDashboard — no behaviour changes.
 *
 * `EditableEmailShell` doubles as the composer. When `isEditing` is true it
 * swaps heading and paragraph blocks for auto-growing textareas so copy is
 * edited in place, inside the layout it will actually ship in. Every other block
 * type renders read-only, which is why adding or removing blocks needs a
 * starter scaffold rather than an insert control.
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import {
  type EmailBlock,
  type EmailButtonBlock,
  type EmailComposerDraft,
  type EmailImageWidth,
  type EmailQuestionCardBlock,
  type EmailSpacerSize,
} from '../../lib/emailComposer';

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

/** Mirrors `isSafeLinkHref` in the send renderer. */
function isSafeLinkHref(href: string) {
  return /^https?:\/\//i.test(href.trim());
}

function renderInlineStrongText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${part}-${index}`} className="font-extrabold text-bears-navy">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      if (!isSafeLinkHref(href)) return <span key={`${part}-${index}`}>{label}</span>;
      return (
        <a
          key={`${part}-${index}`}
          href={href.trim()}
          onClick={(event) => event.preventDefault()}
          className="font-bold text-bears-orange underline"
        >
          {label}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}


function EmailQuestionCard({
  block,
  commentField,
}: {
  block: EmailQuestionCardBlock;
  commentField?: JSX.Element;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50/70 px-[18px] py-4">
      <p className="text-[19px] font-extrabold leading-[1.38] text-bears-navy">
        {block.question}
      </p>

      {commentField ??
        (block.text ? <p className="mt-1.5 text-[15px] leading-[1.45] text-slate-500">{block.text}</p> : null)}

      {block.choices.length > 0 ? (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
            Answer choices
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-[1.45] text-slate-600">
            {block.choices.join(' \u00b7 ')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function EmailPreviewBlock({ block }: { block: EmailBlock }) {
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

  if (block.type === 'question_card') {
    return <EmailQuestionCard block={block} />;
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

export function EditableEmailShell({
  draft,
  isEditing,
  onBlockChange,
}: {
  draft: EmailComposerDraft;
  isEditing: boolean;
  onBlockChange: (blockId: string, text: string) => void;
}) {
  const previewBlocks: Array<{
    key: string;
    content: JSX.Element;
    type: EmailBlock['type'] | 'button_row';
  }> = [];

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
        type: 'button_row',
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
        type: block.type,
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
        type: block.type,
      });
      continue;
    }

    if (isEditing && block.type === 'question_card') {
      previewBlocks.push({
        key: block.id,
        content: (
          <EmailQuestionCard
            block={block}
            commentField={
              <AutoResizeTextarea
                value={block.text ?? ''}
                onChange={(text) => onBlockChange(block.id, text)}
                className="mt-1.5 w-full resize-none bg-transparent text-[15px] leading-[1.45] text-slate-500 outline-none rounded-lg px-1 -mx-1 transition focus:ring-2 focus:ring-bears-orange/30 focus:bg-bears-orange/[0.03]"
              />
            }
          />
        ),
        type: block.type,
      });
      continue;
    }

    previewBlocks.push({
      key: block.id,
      content: <EmailPreviewBlock block={block} />,
      type: block.type,
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

          <div className={draft.headerEyebrow || draft.headerTitle || draft.headerMeta ? 'mt-8' : 'mt-2'}>
            {previewBlocks.map((block, index) => {
              const previousBlock = previewBlocks[index - 1];
              const compactQuestionGap =
                block.type === 'question_card' && previousBlock?.type === 'question_card';

              return (
                <div
                  key={block.key}
                  className={index === 0 ? undefined : compactQuestionGap ? 'mt-4' : 'mt-9'}
                >
                  {block.content}
                </div>
              );
            })}
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

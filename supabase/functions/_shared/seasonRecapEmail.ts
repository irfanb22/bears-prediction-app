export interface SeasonRecapImageUrls {
  hero?: string;
  communityAccuracy?: string;
  calebRecord?: string;
  playoff?: string;
  romeOdunze?: string;
  offenseSurprise?: string;
  draft?: string;
}

export interface SeasonRecapLinks {
  dashboard: string;
  recap: string;
  leaderboard: string;
  draftQuestion: string;
}

export type EmailImageWidth = "full" | "wide" | "medium";
export type EmailButtonTone = "primary" | "secondary";
export type EmailSpacerSize = "s" | "m" | "l";

export interface EmailHeadingBlock {
  id: string;
  type: "heading";
  text: string;
}

export interface EmailParagraphBlock {
  id: string;
  type: "paragraph";
  text: string;
}

export interface EmailImageBlock {
  id: string;
  type: "image";
  src: string;
  alt: string;
  width: EmailImageWidth;
  caption?: string;
  href?: string;
  framed?: boolean;
}

export interface EmailButtonBlock {
  id: string;
  type: "button";
  label: string;
  href: string;
  tone: EmailButtonTone;
}

export interface EmailSpacerBlock {
  id: string;
  type: "spacer";
  size: EmailSpacerSize;
}

export interface EmailSignatureBlock {
  id: string;
  type: "signature";
  text: string;
}

/** Mirrors `EmailQuestionCardBlock` in src/lib/emailComposer.ts. */
export interface EmailQuestionCardBlock {
  id: string;
  type: "question_card";
  question: string;
  choices: string[];
  href: string;
  text?: string;
}

export type EmailBlock =
  | EmailHeadingBlock
  | EmailParagraphBlock
  | EmailImageBlock
  | EmailButtonBlock
  | EmailSpacerBlock
  | EmailSignatureBlock
  | EmailQuestionCardBlock;

interface SeasonRecapTemplateOptions {
  previewText: string;
  imageUrls?: SeasonRecapImageUrls;
  links: SeasonRecapLinks;
  unsubscribeUrl?: string;
  headerEyebrow?: string;
  headerTitle?: string;
  headerMeta?: string;
  footerLinkLabel?: string;
  footerLinkHref?: string;
  blocks?: EmailBlock[];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Only absolute http(s) links are emitted. Paragraph text is editable in the
 * admin console, so a `javascript:` or `data:` href could otherwise reach a
 * subscriber's inbox as a live link; an unsafe one degrades to plain text.
 */
function isSafeLinkHref(href: string) {
  return /^https?:\/\//i.test(href.trim());
}

function renderInlineStrongText(value: string) {
  return value
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return `<strong style="font-weight:800; color:#0b162a;">${escapeHtml(part.slice(2, -2))}</strong>`;
      }

      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link) {
        const [, label, href] = link;
        if (!isSafeLinkHref(href)) return escapeHtml(label);
        return `<a href="${escapeHtml(href.trim())}" style="color:#c83803; font-weight:700; text-decoration:underline;">${escapeHtml(label)}</a>`;
      }

      return escapeHtml(part);
    })
    .join("");
}

function renderImageSection({
  imageUrl,
  alt,
  href,
  caption,
  framed = true,
  topPadding = 20,
}: {
  imageUrl?: string;
  alt: string;
  href?: string;
  caption?: string;
  framed?: boolean;
  topPadding?: number;
}) {
  if (!imageUrl) return "";

  const img = `
    <img
      src="${escapeHtml(imageUrl)}"
      alt="${escapeHtml(alt)}"
      width="720"
      style="display:block; width:100%; max-width:720px; height:auto;${framed ? ' border:1px solid #cbd5e1; border-radius:24px;' : ''}"
    />
  `;

  return `
    <tr>
      <td style="padding:${topPadding}px 32px 0 32px;">
        ${
          href
            ? `<a href="${escapeHtml(href)}" style="display:block; text-decoration:none;">${img}</a>`
            : img
        }
        ${
          caption
            ? `<div style="padding-top:10px; font-size:13px; line-height:20px; color:#64748b;">${escapeHtml(caption)}</div>`
            : ""
        }
      </td>
    </tr>
  `;
}

function getImageWidthPercent(width: EmailImageWidth) {
  if (width === "compact") return "72%";
  if (width === "medium") return "92%";
  if (width === "wide") return "100%";
  return "100%";
}

function getSpacerHeight(size: EmailSpacerSize) {
  if (size === "s") return "24px";
  if (size === "l") return "56px";
  return "40px";
}


function renderQuestionCard(block: EmailQuestionCardBlock) {
  const href = escapeHtml(block.href);

  return `
    <tr>
      <td style="padding:14px 20px 0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:separate; border:1px solid #dbe4ef; border-radius:16px; background-color:#ffffff;">
          <tr>
            <td style="padding:16px 18px 18px 18px;">
              <a href="${href}" style="display:block; font-size:19px; line-height:26px; font-weight:800; color:#0b162a; text-decoration:none;">${escapeHtml(block.question)} <span style="color:#c83803;">&rarr;</span></a>
              ${
                block.text
                  ? `<div style="padding-top:6px; font-size:15px; line-height:22px; color:#64748b;">${escapeHtml(block.text)}</div>`
                  : ""
              }
              ${
                block.choices.length > 0
                  ? `<div style="padding-top:10px; font-size:15px; line-height:22px; font-weight:600; color:#475569;">${block.choices
                      .map((choice) => escapeHtml(choice))
                      .join(" &middot; ")}</div>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderComposerBlock(block: EmailBlock) {
  if (block.type === "heading") {
    return `
      <tr>
        <td style="padding:34px 20px 0 20px;">
          <h2 style="margin:0; font-size:32px; line-height:38px; font-weight:900; color:#0b162a;">${escapeHtml(block.text)}</h2>
        </td>
      </tr>
    `;
  }

  if (block.type === "paragraph") {
    return `
      <tr>
        <td style="padding:22px 20px 0 20px; font-size:18px; line-height:31px; color:#334155;">
          <p style="margin:0; white-space:pre-line;">${renderInlineStrongText(block.text)}</p>
        </td>
      </tr>
    `;
  }

  if (block.type === "image") {
    const frameStyles = block.framed === false ? "" : " border:1px solid #cbd5e1; border-radius:24px;";
    const image = `
      <img
        src="${escapeHtml(block.src)}"
        alt="${escapeHtml(block.alt)}"
        width="720"
        style="display:block; width:100%; max-width:720px; height:auto;${frameStyles}"
      />
    `;

    return `
      <tr>
        <td style="padding:22px 20px 0 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${getImageWidthPercent(block.width)}" align="center" style="width:${getImageWidthPercent(block.width)}; margin:0 auto;">
            <tr>
              <td>
                ${
                  block.href
                    ? `<a href="${escapeHtml(block.href)}" style="display:block; text-decoration:none;">${image}</a>`
                    : image
                }
                ${
                  block.caption
                    ? `<div style="padding-top:10px; font-size:13px; line-height:20px; color:#64748b;">${escapeHtml(block.caption)}</div>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  if (block.type === "button") {
    const buttonStyles =
      block.tone === "secondary"
        ? "border:1px solid #cbd5e1; background-color:#ffffff; color:#1e293b;"
        : "background-color:#c83803; color:#ffffff;";

    return `
      <tr>
        <td align="center" style="padding:30px 20px 0 20px;">
          <a
            href="${escapeHtml(block.href)}"
            style="display:inline-block; border-radius:999px; padding:14px 26px; font-size:16px; line-height:20px; font-weight:700; text-decoration:none; ${buttonStyles}"
          >
            ${escapeHtml(block.label)}
          </a>
        </td>
      </tr>
    `;
  }

  if (block.type === "question_card") {
    return renderQuestionCard(block);
  }

  if (block.type === "signature") {
    return `
      <tr>
        <td style="padding:6px 20px 0 20px;">
          <div style="font-size:48px; line-height:1; color:#0b162a; font-family:'Brush Script MT', 'Snell Roundhand', cursive;">
            ${escapeHtml(block.text)}
          </div>
        </td>
      </tr>
    `;
  }

  return `
    <tr>
      <td style="height:${getSpacerHeight(block.size)}; line-height:${getSpacerHeight(block.size)}; font-size:0;">&nbsp;</td>
    </tr>
  `;
}

function renderButtonRow(buttons: EmailButtonBlock[]) {
  const cells = buttons
    .map((button) => {
      const buttonStyles =
        button.tone === "secondary"
          ? "border:1px solid #cbd5e1; background-color:#ffffff; color:#1e293b;"
          : "background-color:#c83803; color:#ffffff;";

      return `
        <td align="center" style="padding:0 8px;">
          <a
            href="${escapeHtml(button.href)}"
            style="display:inline-block; border-radius:999px; padding:14px 26px; font-size:16px; line-height:20px; font-weight:700; text-decoration:none; white-space:nowrap; ${buttonStyles}"
          >
            ${escapeHtml(button.label)}
          </a>
        </td>
      `;
    })
    .join("");

  return `
    <tr>
      <td align="center" style="padding:30px 20px 10px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            ${cells}
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderComposerBlocks(blocks: EmailBlock[]) {
  let html = "";

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.type === "button") {
      const buttons: EmailButtonBlock[] = [block];

      while (index + 1 < blocks.length && blocks[index + 1].type === "button") {
        buttons.push(blocks[index + 1] as EmailButtonBlock);
        index += 1;
      }

      html += renderButtonRow(buttons);
      continue;
    }

    html += renderComposerBlock(block);
  }

  return html;
}

export function buildSeasonRecapEmail({
  previewText,
  imageUrls,
  links,
  unsubscribeUrl,
  headerEyebrow,
  headerTitle,
  headerMeta,
  footerLinkLabel,
  footerLinkHref,
  blocks,
}: SeasonRecapTemplateOptions) {
  const safePreviewText = escapeHtml(previewText);
  const safeDashboardUrl = escapeHtml(links.dashboard);
  const safeRecapUrl = escapeHtml(links.recap);
  const safeLeaderboardUrl = escapeHtml(links.leaderboard);
  const safeDraftQuestionUrl = escapeHtml(links.draftQuestion);
  const safeHeaderEyebrow = escapeHtml(headerEyebrow ?? "2025 Season Recap");
  const safeHeaderTitle = escapeHtml(headerTitle ?? "How Bears Fans Predicted the Season");
  const safeHeaderMeta = escapeHtml(headerMeta ?? "Irfan | Mar 31");
  const safeFooterLinkLabel = escapeHtml(footerLinkLabel ?? "View the recap on the site");
  const safeFooterLinkHref = escapeHtml(footerLinkHref ?? links.recap);
  const hasHeaderEyebrow = Boolean(headerEyebrow && headerEyebrow.trim());
  const hasHeaderTitle = Boolean(headerTitle && headerTitle.trim());
  const hasHeaderMeta = Boolean(headerMeta && headerMeta.trim());
  const hasFooterLink = Boolean(footerLinkLabel && footerLinkLabel.trim() && footerLinkHref && footerLinkHref.trim());
  const renderedBlocks = blocks ? renderComposerBlocks(blocks) : "";

  if (blocks && blocks.length > 0) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <title>${safeHeaderTitle}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#1e293b;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${safePreviewText}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc; margin:0; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; max-width:720px; background-color:#ffffff; border-radius:24px; overflow:hidden;">
            <tr>
              <td style="background-color:#0b162a; padding:18px 20px; text-align:center;">
                <div style="font-size:20px; line-height:28px; font-weight:800; letter-spacing:0.01em; color:#ffffff;">Bears Prediction Tracker</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 20px 10px 20px;">
                ${
                  hasHeaderEyebrow
                    ? `<div style="font-size:12px; line-height:18px; letter-spacing:0.2em; text-transform:uppercase; font-weight:700; color:#c83803;">
                  ${safeHeaderEyebrow}
                </div>`
                    : ""
                }
                ${
                  hasHeaderTitle
                    ? `<h1 style="margin:${hasHeaderEyebrow ? "14px" : "0"} 0 0 0; font-size:38px; line-height:40px; font-weight:900; color:#0b162a;">
                  ${safeHeaderTitle}
                </h1>`
                    : ""
                }
                ${
                  hasHeaderMeta
                    ? `<div style="margin-top:16px; font-size:13px; line-height:18px; letter-spacing:0.18em; text-transform:uppercase; font-weight:700; color:#64748b;">
                  ${safeHeaderMeta}
                </div>`
                    : ""
                }
              </td>
            </tr>
            ${renderedBlocks}
            <tr>
              <td style="padding:28px 20px 38px 20px; text-align:center; border-top:1px solid #e2e8f0;">
                <div style="font-size:15px; line-height:28px;">
                  ${
                    hasFooterLink
                      ? `<a href="${safeFooterLinkHref}" style="color:#64748b; text-decoration:underline;">
                    ${safeFooterLinkLabel}
                  </a>`
                      : ""
                  }
                  ${
                    unsubscribeUrl
                      ? `${hasFooterLink ? '<span style="color:#94a3b8;">&nbsp;|&nbsp;</span>' : ""}
                  <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b; text-decoration:underline;">
                    Unsubscribe
                  </a>`
                      : ""
                  }
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <title>${safeHeaderTitle}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#1e293b;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${safePreviewText}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc; margin:0; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; max-width:720px; background-color:#ffffff; border-radius:24px; overflow:hidden;">
            <tr>
              <td style="background-color:#0b162a; padding:18px 32px; text-align:center;">
                <div style="font-size:20px; line-height:28px; font-weight:800; color:#ffffff;">Bears Prediction Tracker</div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <div style="font-size:12px; line-height:18px; letter-spacing:0.2em; text-transform:uppercase; font-weight:700; color:#c83803;">
                  2025 Season Recap
                </div>
                <h1 style="margin:14px 0 0 0; font-size:40px; line-height:44px; font-weight:900; color:#0b162a;">
                  How Bears Fans Predicted the Season
                </h1>
                <div style="margin-top:14px; font-size:13px; line-height:18px; letter-spacing:0.18em; text-transform:uppercase; font-weight:700; color:#64748b;">
                  Irfan | Mar 31
                </div>
              </td>
            </tr>

            ${renderImageSection({
              imageUrl: imageUrls?.hero,
              alt: "Caleb Williams smiling with Ben Johnson on the sideline",
              href: safeRecapUrl,
              caption: "Photo: Jacob Funk/Chicago Bears.",
            })}

            <tr>
              <td style="padding:28px 32px 0 32px; font-size:18px; line-height:32px; color:#334155;">
                <p style="margin:0 0 18px 0;">
                  Before the season started, Bears Prediction Tracker asked fans to make calls on
                  everything from Caleb's stats to the draft to whether this team would end the
                  playoff drought. Hundreds of you locked in your picks.
                </p>
                <p style="margin:0;">The dust has settled. Here's how you did.</p>
              </td>
            </tr>

            ${renderImageSection({
              imageUrl: imageUrls?.communityAccuracy,
              alt: "Community accuracy chart for 2025 Bears predictions",
              href: safeRecapUrl,
              framed: false,
              topPadding: 28,
            })}

            <tr>
              <td style="padding:24px 32px 0 32px; font-size:17px; line-height:30px; color:#334155;">
                <p style="margin:0;">
                  <span style="font-weight:700; color:#0b162a;">Want to see how you did?</span>
                  &nbsp;Check your results in
                  <a href="${safeDashboardUrl}" style="color:#c83803; font-weight:600; text-decoration:underline;">My Predictions</a>
                  &nbsp;or see where you stand on the
                  <a href="${safeLeaderboardUrl}" style="color:#c83803; font-weight:600; text-decoration:underline;">Leaderboard</a>.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:40px 32px 0 32px;">
                <h2 style="margin:0; font-size:32px; line-height:38px; font-weight:900; color:#0b162a;">The Season in Context</h2>
                <div style="margin-top:18px; font-size:17px; line-height:30px; color:#334155;">
                  <p style="margin:0 0 18px 0;">
                    There was cautious optimism heading into 2025. New head coach. Second-year
                    quarterback with sky-high potential. Most fans weren't sure if this was a
                    playoff team or another rebuilding year.
                  </p>
                  <p style="margin:0 0 18px 0;">
                    The Bears exceeded expectations. The offense clicked in the second half. The
                    playoff drought ended. Chicago picked up its first playoff win in over a
                    decade. Caleb delivered clutch performances down the stretch. Iceman.
                  </p>
                  <p style="margin:0;">Now to the predictions.</p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:40px 32px 0 32px;">
                <h2 style="margin:0; font-size:32px; line-height:38px; font-weight:900; color:#0b162a;">The Sure Things</h2>
                <div style="margin-top:18px; font-size:17px; line-height:30px; color:#334155;">
                  <p style="margin:0 0 18px 0;">Some predictions showed overwhelming consensus and fans nailed them.</p>
                  <p style="margin:0 0 18px 0;">
                    Caleb Williams breaking the Bears' single-season passing record was the most
                    confident correct call of the year. Williams threw for 3,942 yards, surpassing
                    Erik Kramer's franchise mark.
                    <span style="font-weight:700; color:#0b162a;"> 90% of fans predicted it, most with high confidence.</span>
                  </p>
                </div>
              </td>
            </tr>

            ${renderImageSection({
              imageUrl: imageUrls?.calebRecord,
              alt: "Caleb versus the Bears passing record graphic",
            })}

            <tr>
              <td style="padding:20px 32px 0 32px; font-size:17px; line-height:30px; color:#334155;">
                <p style="margin:0 0 18px 0;">
                  He still fell short of 4,000 yards. No Bears quarterback has ever hit that mark.
                  That will be a prediction in 2026.
                </p>
                <p style="margin:0 0 18px 0;">
                  He also started every game, something 58% of fans correctly predicted, though
                  confidence was mixed. Durability for a Bears QB has been a question mark in the
                  past.
                </p>
                <p style="margin:0 0 18px 0;">
                  One question we probably should have asked was completion percentage. Ben's stated
                  goal for him was 70%, but Williams finished at a league-low 59%.
                </p>
                <p style="margin:0 0 18px 0;">
                  Speaking of BJ, Bears fans had a lot of confidence in him. 79% saw Johnson as a
                  Coach of the Year finalist.
                </p>
                <p style="margin:0 0 18px 0;">
                  While fans trusted Johnson to elevate the offense, they weren't buying the
                  defense. 87% correctly predicted the Bears would not finish as a top-10 defense,
                  most with high confidence. It would have been a bottom-10 unit if not for leading
                  the league in turnovers.
                </p>
                <p style="margin:0;">
                  When it came to win total, 72% predicted the Bears would win more than eight
                  games. Few would have predicted 11 wins, though, given that most weren't even
                  confident the Bears would make the playoffs.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:40px 32px 0 32px;">
                <h2 style="margin:0; font-size:32px; line-height:38px; font-weight:900; color:#0b162a;">The Coin Flip</h2>
                <div style="margin-top:18px; font-size:17px; line-height:30px; color:#334155;">
                  <p style="margin:0 0 18px 0;">
                    The Bears making the playoffs was the most divisive prediction of the season.
                    Just 54% picked correctly, with confidence spread almost evenly across the board.
                  </p>
                  <p style="margin:0;">A true coin flip and the kind of question we'll have a lot more of in 2026.</p>
                </div>
              </td>
            </tr>

            ${renderImageSection({
              imageUrl: imageUrls?.playoff,
              alt: "Playoff prediction split chart",
            })}

            <tr>
              <td style="padding:40px 32px 0 32px;">
                <h2 style="margin:0; font-size:32px; line-height:38px; font-weight:900; color:#0b162a;">The Confident Misses</h2>
                <div style="margin-top:18px; font-size:17px; line-height:30px; color:#334155;">
                  <p style="margin:0 0 18px 0;">Not every strong conviction landed.</p>
                  <p style="margin:0 0 18px 0;">
                    78% of fans predicted Rome Odunze would surpass 1,000 receiving yards. 52%
                    made that call with high confidence. A late-season injury cost him 5 games, and
                    he ultimately fell short of the milestone.
                  </p>
                </div>
              </td>
            </tr>

            ${renderImageSection({
              imageUrl: imageUrls?.romeOdunze,
              alt: "Rome Odunze 2025 stat card",
            })}

            <tr>
              <td style="padding:20px 32px 0 32px; font-size:17px; line-height:30px; color:#334155;">
                <p style="margin:0 0 18px 0;">
                  Montez Sweat reaching 10 sacks was another misread, but in the other direction.
                  73% of fans predicted he'd fall short. Sweat just barely got there, a solid
                  rebound from a disappointing 2024.
                </p>
                <p style="margin:0;">
                  The Bears' offense exceeded expectations too, finishing 4th in the NFL in total
                  offense at 375.7 yards per game.
                  <span style="font-weight:700; color:#0b162a;"> Only 40% of fans expected the unit to crack the top ten, which made it one of the biggest surprises of the season.</span>
                </p>
              </td>
            </tr>

            ${renderImageSection({
              imageUrl: imageUrls?.offenseSurprise,
              alt: "Offense surprise stat card",
            })}

            <tr>
              <td style="padding:40px 32px 0 32px;">
                <h2 style="margin:0; font-size:32px; line-height:38px; font-weight:900; color:#0b162a;">The Impossible Question</h2>
                <div style="margin-top:18px; font-size:17px; line-height:30px; color:#334155;">
                  <p style="margin:0;">
                    The hardest question of the year: who would the Bears select with the 10th pick?
                    Most fans expected Penn State tight end Tyler Warren. The Bears went with Colston
                    Loveland, who wasn't even listed as an option.
                  </p>
                </div>
              </td>
            </tr>

            ${renderImageSection({
              imageUrl: imageUrls?.draft,
              alt: "Draft prediction graphic",
            })}

            <tr>
              <td style="padding:40px 32px 0 32px;">
                <h2 style="margin:0; font-size:32px; line-height:38px; font-weight:900; color:#0b162a;">What's Next</h2>
                <div style="margin-top:18px; font-size:17px; line-height:30px; color:#334155;">
                  <p style="margin:0 0 18px 0;">All 13 predictions are now resolved and up on the site.</p>
                  <p style="margin:0;">
                    We're already working on 2026. More questions, more categories, and game-by-game
                    picks. The first question is already live:
                    <a href="${safeDraftQuestionUrl}" style="color:#c83803; font-weight:600; text-decoration:underline;">
                      Which position will the Bears pick with the 25th pick?
                    </a>
                    You can make your prediction now, and you'll have until draft day to lock it in.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 32px 16px 32px; font-size:18px; line-height:32px; color:#334155;">
                <p style="margin:0 0 18px 0; font-weight:700; color:#0b162a;">Thanks for joining the community.</p>
                <p style="margin:0; font-size:34px; line-height:38px; color:#0b162a; font-family:'Brush Script MT', 'Snell Roundhand', cursive;">
                  Irfan
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px 32px 32px; text-align:center; border-top:1px solid #e2e8f0;">
                <div style="font-size:14px; line-height:24px;">
                  <a href="${safeRecapUrl}" style="color:#64748b; text-decoration:underline;">
                    View the recap on the site
                  </a>
                  ${
                    unsubscribeUrl
                      ? `<span style="color:#94a3b8;">&nbsp;|&nbsp;</span>
                  <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b; text-decoration:underline;">
                    Unsubscribe
                  </a>`
                      : ""
                  }
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Renders the Markdown subset Mandaloria accepts in posts and comments.
 *
 * The database stores exactly what the author typed, so sanitisation happens
 * here, at render. The order is the whole security argument: **every character
 * is HTML-escaped first**, and only then are the allowed constructs rewritten
 * into tags. Author text can therefore never reach the output as markup —
 * `<script>` is already `&lt;script&gt;` before any rule runs, and no rule can
 * turn it back. There is no allowlist to keep in sync and no parser to outrun,
 * which is why this is a few dozen lines instead of a dependency.
 *
 * The subset is deliberately small: headings, bold, italic, inline code, fenced
 * code, links, blockquotes, lists and paragraphs. Images, raw HTML, tables and
 * footnotes are not supported; unsupported syntax survives as the literal text
 * the author wrote rather than being silently dropped.
 *
 * Links accept `http`, `https` and `mailto` only. `javascript:` and `data:`
 * URLs, and anything with embedded credentials, render as plain text.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

function isSafeUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (url.length === 0 || url.length > 2048) return false;
  // Control characters are how `java\nscript:` style bypasses are smuggled in.
  if (/[\u0000-\u0020\u007f]/.test(url)) return false;

  if (url.startsWith("/") && !url.startsWith("//")) return true;

  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    return (
      parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

/**
 * Applied to already-escaped text. Placeholders keep inline code out of reach of
 * the emphasis and link rules, so backticks behave the way an author expects.
 */
function renderInline(escaped: string): string {
  const codeFragments: string[] = [];
  let text = escaped.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeFragments.push(code);
    return `\u0000CODE${codeFragments.length - 1}\u0000`;
  });

  text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    // `href` arrives escaped, so `&amp;` has to become `&` again before the URL
    // is parsed — and the result is re-escaped for the attribute.
    const decoded = href
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
    if (!isSafeUrl(decoded)) return match;

    const rel = decoded.startsWith("/")
      ? ""
      : ' rel="nofollow noopener noreferrer" target="_blank"';
    return `<a href="${escapeHtml(decoded)}"${rel}>${label}</a>`;
  });

  text = text.replace(/\*\*([^\n*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^\n*]+)\*/g, "$1<em>$2</em>");
  text = text.replace(/(^|[^_])_([^\n_]+)_/g, "$1<em>$2</em>");

  return text.replace(/\u0000CODE(\d+)\u0000/g, (_match, index: string) => {
    return `<code>${codeFragments[Number(index)]}</code>`;
  });
}

export interface RenderMarkdownOptions {
  /** Hard ceiling on input length; longer content is truncated, never rejected. */
  maxLength?: number;
}

export function renderMarkdown(source: string, options: RenderMarkdownOptions = {}): string {
  const maxLength = options.maxLength ?? 40_000;
  const normalized = source.slice(0, maxLength).replace(/\r\n?/g, "\n");

  // Block structure is detected on the raw line and escaped as each piece is
  // emitted. Escaping first would turn a `>` quote marker into `&gt;` before it
  // could ever be recognised.
  const lines = normalized.split("\n");
  const blocks: string[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let quote: string[] = [];
  let codeLines: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${renderInline(escapeHtml(paragraph.join(" ")))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const tag = listOrdered ? "ol" : "ul";
    blocks.push(
      `<${tag}>${listItems.map((item) => `<li>${renderInline(escapeHtml(item))}</li>`).join("")}</${tag}>`,
    );
    listItems = [];
  };

  const flushQuote = () => {
    if (quote.length === 0) return;
    blocks.push(`<blockquote><p>${renderInline(escapeHtml(quote.join(" ")))}</p></blockquote>`);
    quote = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (codeLines !== null) {
      if (line.trimEnd() === "```") {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = null;
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      flushAll();
      codeLines = [];
      continue;
    }

    if (line.trim().length === 0) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      // Headings start at h2: the page owns its single h1.
      const level = Math.min(heading[1].length + 1, 5);
      blocks.push(`<h${level}>${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }

    const unordered = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const nextOrdered = Boolean(ordered);
      if (listItems.length > 0 && nextOrdered !== listOrdered) flushList();
      listOrdered = nextOrdered;
      listItems.push((unordered ?? ordered)![1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  if (codeLines !== null) {
    // An unterminated fence still has to render; dropping the text would lose
    // the author's content.
    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  flushAll();

  return blocks.join("");
}

/** Plain-text reduction for previews, meta descriptions and search. */
export function markdownToPlainText(source: string, maxLength = 280): string {
  const text = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[*_]{1,2}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

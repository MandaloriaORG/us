import { describe, expect, it } from "vitest";

import { escapeHtml, markdownToPlainText, renderMarkdown } from "@/lib/content/markdown";

/**
 * The renderer emits a fixed, closed set of tags. A payload is neutralised when
 * it survives only as visible text, so the invariant to assert is that the
 * output contains no tag outside that set — not that a dangerous-looking
 * substring is absent, because `&lt;svg/onload=…&gt;` is inert text and asserting
 * on it would fail for the wrong reason.
 */
const ALLOWED_TAGS = /<\/?(?:p|h[2-5]|strong|em|code|pre|ul|ol|li|blockquote|a)(?:\s|>|\/)/g;

function tagsOutsideAllowlist(html: string): string[] {
  return html.replace(ALLOWED_TAGS, "").match(/<[^\s]/g) ?? [];
}

describe("markdown sanitisation", () => {
  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<iframe src='https://evil.test'></iframe>",
    "<svg/onload=alert(1)>",
    "<a href='javascript:alert(1)'>x</a>",
    "<style>body{display:none}</style>",
    "<!--[if IE]><script>alert(1)</script><![endif]-->",
    "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  ])("emits no tag outside the allowlist for %s", (payload) => {
    const html = renderMarkdown(payload);

    expect(tagsOutsideAllowlist(html)).toEqual([]);
    expect(html).not.toMatch(/<a\s[^>]*javascript:/i);
  });

  it("emits anchors carrying only href, rel and target", () => {
    const html = renderMarkdown("[a](https://example.test) and <a onclick=alert(1)>b</a>");

    for (const anchor of html.match(/<a\s[^>]*>/g) ?? []) {
      expect(anchor).toMatch(
        /^<a href="[^"]*"( rel="nofollow noopener noreferrer" target="_blank")?>$/,
      );
    }
  });

  it("escapes every angle bracket the author typed", () => {
    expect(renderMarkdown("a < b && c > d")).toBe("<p>a &lt; b &amp;&amp; c &gt; d</p>");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "//evil.test/path",
    "https://user:pass@evil.test",
    "file:///etc/passwd",
  ])("refuses to link %s and leaves it as text", (href) => {
    const html = renderMarkdown(`[click](${href})`);

    expect(html).not.toContain("<a ");
    expect(html).toContain("click");
  });

  it.each(["https://example.test/x", "http://example.test", "mailto:someone@example.test"])(
    "links %s with hardened rel attributes",
    (href) => {
      const html = renderMarkdown(`[label](${href})`);

      expect(html).toContain(`href="${href}"`);
      expect(html).toContain('rel="nofollow noopener noreferrer"');
      expect(html).toContain('target="_blank"');
    },
  );

  it("keeps an internal link in the same tab and without nofollow", () => {
    const html = renderMarkdown("[members](/members)");

    expect(html).toContain('<a href="/members">members</a>');
    expect(html).not.toContain("target=");
  });

  it("does not let an escaped entity be decoded back into a scheme", () => {
    const html = renderMarkdown("[x](java&#39;script:alert(1))");

    expect(html).not.toContain("<a ");
  });
});

describe("markdown subset", () => {
  it("renders headings below the page h1", () => {
    expect(renderMarkdown("# Title")).toBe("<h2>Title</h2>");
    expect(renderMarkdown("#### Deep")).toBe("<h5>Deep</h5>");
  });

  it("renders emphasis and strong", () => {
    expect(renderMarkdown("**bold** and *italic* and _also_")).toBe(
      "<p><strong>bold</strong> and <em>italic</em> and <em>also</em></p>",
    );
  });

  it("keeps markup inside inline code literal", () => {
    const html = renderMarkdown("use `**not bold**` here");

    expect(html).toBe("<p>use <code>**not bold**</code> here</p>");
  });

  it("keeps a fenced block literal, including escaped markup", () => {
    const html = renderMarkdown("```\n<script>alert(1)</script>\n```");

    expect(html).toBe("<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>");
  });

  it("renders an unterminated fence rather than dropping the text", () => {
    expect(renderMarkdown("```\nstill mine")).toBe("<pre><code>still mine</code></pre>");
  });

  it("renders both list kinds and separates them", () => {
    const html = renderMarkdown("- one\n- two\n\n1. first\n2. second");

    expect(html).toBe("<ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>");
  });

  it("renders a blockquote", () => {
    expect(renderMarkdown("> quoted line")).toBe("<blockquote><p>quoted line</p></blockquote>");
  });

  it("joins wrapped lines into one paragraph and splits on a blank line", () => {
    expect(renderMarkdown("one\ntwo\n\nthree")).toBe("<p>one two</p><p>three</p>");
  });

  it("normalises CRLF", () => {
    expect(renderMarkdown("one\r\n\r\ntwo")).toBe("<p>one</p><p>two</p>");
  });

  it("truncates beyond the ceiling instead of rejecting", () => {
    const html = renderMarkdown("x".repeat(500), { maxLength: 10 });

    expect(html).toBe("<p>xxxxxxxxxx</p>");
  });

  it("returns nothing for empty input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("   \n\n  ")).toBe("");
  });

  it("renders strikethrough as <del>", () => {
    expect(renderMarkdown("this is ~~wrong~~ now corrected")).toBe(
      "<p>this is <del>wrong</del> now corrected</p>",
    );
  });
});

describe("plain text reduction", () => {
  it("strips syntax for previews", () => {
    expect(markdownToPlainText("# Title\n\n**bold** [link](https://x.test)")).toBe(
      "Title bold link",
    );
  });

  it("drops fenced code entirely", () => {
    expect(markdownToPlainText("before\n```\nsecret\n```\nafter")).toBe("before after");
  });

  it("ellipsises past the limit", () => {
    const text = markdownToPlainText("word ".repeat(200), 20);

    expect(text).toHaveLength(20);
    expect(text.endsWith("…")).toBe(true);
  });

  it("escapes independently of rendering", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});

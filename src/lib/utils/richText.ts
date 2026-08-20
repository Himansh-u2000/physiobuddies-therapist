/**
 * Markdown ⇄ HTML for the article editor.
 *
 * The editor surface is `contenteditable`, which speaks HTML, but articles are **stored as
 * Markdown** and always have been. Nothing in this app renders a therapist's article as formatted
 * text — the list only strips markup — so the consumer of that stored string is the patient-facing
 * surface. Switching the stored format to HTML would risk showing raw tags over there, which is
 * why the conversion happens here rather than changing what gets persisted.
 *
 * The supported subset is deliberately **exactly what `MarkdownText` can render**: bold, italic,
 * `##` headings, `-` bullets, `1.` ordered items, `>` quotes and paragraphs. Supporting more in
 * the editor than the renderer understands is how you get an article that looks right while being
 * written and wrong once published, so anything outside the subset is flattened to plain text on
 * the way back rather than silently preserved as HTML.
 */

/** Escape text destined for an HTML document. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Decode the entities `esc` produces, plus the few a browser reintroduces on its own. */
function unesc(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/** Inline markers → inline tags. Bold is matched before italic so `**x**` isn't read as `_x_`. */
function inlineToHtml(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_(.+?)_(?=$|[\s.,!?):])/g, "$1<em>$2</em>");
}

/**
 * Markdown → HTML for seeding the editable document.
 *
 * Block-scanned line by line rather than regex-replaced wholesale, so a list keeps its items in
 * one `<ul>` instead of becoming a run of single-item lists — which is what the editor would then
 * hand back, turning one list into several on every save.
 */
export function markdownToHtml(md: string): string {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^##\s+/.test(line)) {
      out.push(`<h2>${inlineToHtml(line.replace(/^##\s+/, ""))}</h2>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        quote.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inlineToHtml(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push(inlineToHtml((lines[i] ?? "").replace(/^[-*]\s+/, "")));
        i++;
      }
      out.push(`<ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        items.push(inlineToHtml((lines[i] ?? "").replace(/^\d+\.\s+/, "")));
        i++;
      }
      out.push(`<ol>${items.map((t) => `<li>${t}</li>`).join("")}</ol>`);
      continue;
    }

    // Consecutive plain lines form one paragraph, matching MarkdownText's own paragraph rule.
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(##\s+|>\s?|[-*]\s+|\d+\.\s+)/.test(lines[i] ?? "")
    ) {
      para.push(lines[i] ?? "");
      i++;
    }
    out.push(`<p>${inlineToHtml(para.join(" "))}</p>`);
  }

  return out.join("") || "<p></p>";
}

/** Inline tags → inline markers, for the text inside one block. */
function inlineToMarkdown(html: string): string {
  return unesc(
    html
      .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
      .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "_$2_")
      // Anything else the browser invented (spans, styling divs, fonts) is dropped rather than
      // carried through — the renderer on the other side would only print it literally.
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * HTML → Markdown on the way out of the editor.
 *
 * `contenteditable` is generous about what it produces: a browser will happily emit `<div>` for a
 * line break, wrap fragments in `<span style=…>`, and nest tags in ways nobody typed. So this
 * walks the block-level tags it recognises and flattens everything else, which keeps the stored
 * Markdown to the subset the renderer understands no matter what the editing surface did.
 */
export function htmlToMarkdown(html: string): string {
  const src = (html ?? "").replace(/\r\n/g, "\n");
  const blocks: string[] = [];

  // One pass over the recognised block tags, in document order.
  const blockRe =
    /<(h2|blockquote|ul|ol|p|div)\b[^>]*>([\s\S]*?)<\/\1>|<br\s*\/?>/gi;
  let m: RegExpExecArray | null;
  let matchedAny = false;

  while ((m = blockRe.exec(src)) !== null) {
    matchedAny = true;
    const tag = (m[1] ?? "").toLowerCase();
    const inner = m[2] ?? "";

    if (!tag) continue; // a bare <br> between blocks — the join below already separates them

    if (tag === "h2") {
      const t = inlineToMarkdown(inner);
      if (t) blocks.push(`## ${t}`);
    } else if (tag === "blockquote") {
      const t = inlineToMarkdown(inner);
      if (t) blocks.push(`> ${t}`);
    } else if (tag === "ul" || tag === "ol") {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((li) => inlineToMarkdown(li[1] ?? ""))
        .filter(Boolean);
      if (items.length) {
        blocks.push(
          items.map((t, idx) => (tag === "ul" ? `- ${t}` : `${idx + 1}. ${t}`)).join("\n"),
        );
      }
    } else {
      // <p> and <div> both mean "a line of prose" coming out of contenteditable.
      const t = inlineToMarkdown(inner);
      if (t) blocks.push(t);
    }
  }

  // No block tags at all — the whole document is loose inline content.
  if (!matchedAny) {
    const t = inlineToMarkdown(src);
    return t;
  }

  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

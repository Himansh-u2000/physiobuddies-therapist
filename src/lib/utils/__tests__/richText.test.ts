/**
 * The article editor is WYSIWYG (contenteditable, so HTML) but articles are stored as Markdown,
 * which means every save round-trips through these two functions. A bug here doesn't throw — it
 * quietly rewrites a published article, and the therapist only finds out from a patient. So the
 * properties pinned below are the ones that would corrupt content rather than merely look odd:
 * lists staying single lists, unknown markup being flattened instead of stored, and a document
 * that survives a load/save cycle unchanged.
 */
import { markdownToHtml, htmlToMarkdown } from "@/lib/utils/richText";

describe("markdownToHtml", () => {
  it("keeps consecutive bullets in ONE list", () => {
    // Emitting <ul> per line would come back as several lists, and each save would multiply them.
    expect(markdownToHtml("- one\n- two\n- three")).toBe(
      "<ul><li>one</li><li>two</li><li>three</li></ul>",
    );
  });

  it("keeps consecutive numbered items in one ordered list", () => {
    expect(markdownToHtml("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("renders headings, quotes and inline marks", () => {
    expect(markdownToHtml("## Title")).toBe("<h2>Title</h2>");
    expect(markdownToHtml("> quoted")).toBe("<blockquote>quoted</blockquote>");
    expect(markdownToHtml("a **bold** word")).toBe("<p>a <strong>bold</strong> word</p>");
    expect(markdownToHtml("an _italic_ word")).toBe("<p>an <em>italic</em> word</p>");
  });

  it("escapes HTML in the source so authored text can't inject markup", () => {
    expect(markdownToHtml("5 < 6 & <script>x</script>")).toContain("&lt;script&gt;");
  });

  it("joins consecutive prose lines into one paragraph", () => {
    expect(markdownToHtml("line one\nline two")).toBe("<p>line one line two</p>");
  });
});

describe("htmlToMarkdown", () => {
  it("converts the supported blocks back to markers", () => {
    expect(htmlToMarkdown("<h2>Title</h2>")).toBe("## Title");
    expect(htmlToMarkdown("<blockquote>quoted</blockquote>")).toBe("> quoted");
    expect(htmlToMarkdown("<ul><li>a</li><li>b</li></ul>")).toBe("- a\n- b");
    expect(htmlToMarkdown("<ol><li>a</li><li>b</li></ol>")).toBe("1. a\n2. b");
  });

  it("accepts the tags execCommand actually emits, not just the canonical ones", () => {
    // Browsers hand back <b>/<i> rather than <strong>/<em> depending on engine and version.
    expect(htmlToMarkdown("<p>a <b>bold</b> word</p>")).toBe("a **bold** word");
    expect(htmlToMarkdown("<p>an <i>italic</i> word</p>")).toBe("an _italic_ word");
  });

  it("flattens markup outside the supported subset instead of storing it", () => {
    // The renderer on the patient side would print these literally, so they must not survive.
    expect(htmlToMarkdown('<p><span style="color:red">plain</span></p>')).toBe("plain");
    expect(htmlToMarkdown("<p>see <a href='http://x'>this</a></p>")).toBe("see this");
  });

  it("treats contenteditable's <div> lines as paragraphs", () => {
    expect(htmlToMarkdown("<div>one</div><div>two</div>")).toBe("one\n\ntwo");
  });

  it("drops empty blocks rather than emitting blank markdown", () => {
    expect(htmlToMarkdown("<p></p><p>real</p><p><br></p>")).toBe("real");
  });

  it("handles a document with no block tags at all", () => {
    expect(htmlToMarkdown("just text")).toBe("just text");
  });

  it("decodes entities so stored markdown holds real characters", () => {
    expect(htmlToMarkdown("<p>5 &lt; 6 &amp; 7</p>")).toBe("5 < 6 & 7");
  });
});

describe("round trip", () => {
  // The property that actually matters: opening an article and saving it without editing must
  // not change it. Anything else means content drifts a little on every visit.
  const cases = [
    "## Heading\n\nA paragraph with **bold** and _italic_.",
    "- one\n- two\n- three",
    "1. first\n2. second",
    "> a quotation",
    "Plain prose with no formatting at all.",
    "## Title\n\nIntro line.\n\n- bullet one\n- bullet two\n\n> closing thought",
  ];

  it.each(cases)("survives markdown → html → markdown unchanged: %s", (md) => {
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });
});

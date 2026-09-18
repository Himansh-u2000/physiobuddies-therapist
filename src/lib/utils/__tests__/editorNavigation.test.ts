import { allowEditorNavigation } from "@/lib/utils/richText";

/**
 * The article editor was blank on iOS because its navigation guard refused everything — including
 * the editor's own document, which iOS (unlike Android) loads as a navigation to `about:blank`.
 */
describe("allowEditorNavigation", () => {
  it("lets the editor's own document load — the iOS bug", () => {
    expect(allowEditorNavigation("about:blank")).toBe(true);
    expect(allowEditorNavigation("about:srcdoc")).toBe(true);
  });

  it.each([
    "https://example.com",
    "http://api.dev.physiobuddies.in/",
    "javascript:alert(1)",
    "file:///etc/hosts",
    "about:blank#x",
  ])("still refuses any other navigation: %s", (url) => {
    expect(allowEditorNavigation(url)).toBe(false);
  });
});

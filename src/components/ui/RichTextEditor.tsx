import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Bold, Italic, Heading2, List, ListOrdered, Quote, Undo2, Redo2 } from "lucide-react-native";
import { COLORS } from "@/constants/config";
import { markdownToHtml, htmlToMarkdown } from "@/lib/utils/richText";

/**
 * WYSIWYG rich-text editor for patient-education articles.
 *
 * Formatting is **shown, not typed**: bold text is bold on screen while you write it, headings
 * look like headings, bullets are bullets. This replaced a Markdown editor whose toolbar inserted
 * `**` and `##` markers into a plain text box — technically "rich text", but the therapist saw
 * punctuation rather than the article their patients would read.
 *
 * The editing surface is a `contenteditable` document inside a WebView, because React Native has
 * no way to render inline bold/italic *inside an editable field* — nested `<Text>` children of a
 * `TextInput` don't survive editing on Android. The HTML is inlined as a string rather than
 * loaded from a bundled asset or a CDN, so it works offline and there is no network surface.
 *
 * **The value in and out is still Markdown**, converted at both boundaries by
 * `lib/utils/richText`. Articles have always been stored as Markdown and the patient-facing app
 * is what reads them, so the storage format is deliberately unchanged — see that file for why.
 */
interface RichTextEditorProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  label?: string;
}

/** Commands the document understands, posted in from the native toolbar. */
type Command =
  | "bold"
  | "italic"
  | "h2"
  | "ul"
  | "ol"
  | "quote"
  | "undo"
  | "redo";

/**
 * The editor document.
 *
 * `execCommand` is formally deprecated, but it remains the only API every WebView engine
 * implements for contenteditable formatting, and the alternative is hand-rolling selection and
 * range surgery. Its output is normalised back to the supported Markdown subset on the way out,
 * so the deprecated bits producing `<span style>` or `<b>` instead of `<strong>` doesn't matter.
 */
function buildHtml(initialHtml: string, placeholder: string, minHeight: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  #editor {
    min-height: ${minHeight}px;
    padding: 12px 14px;
    outline: none;
    font-family: -apple-system, Roboto, "Helvetica Neue", sans-serif;
    font-size: 14px;
    line-height: 20px;
    color: ${COLORS.fg};
    -webkit-user-select: text;
    user-select: text;
  }
  #editor:empty:before {
    content: attr(data-placeholder);
    color: ${COLORS.muted};
    pointer-events: none;
  }
  #editor h2 { font-size: 17px; line-height: 24px; font-weight: 800; margin: 14px 0 6px; }
  #editor p { margin: 0 0 10px; }
  #editor ul, #editor ol { margin: 0 0 10px; padding-left: 22px; }
  #editor li { margin: 2px 0; }
  #editor blockquote {
    margin: 0 0 10px; padding: 6px 12px;
    border-left: 3px solid ${COLORS.accent};
    background: rgba(0,64,96,0.04);
    color: ${COLORS.muted};
  }
  #editor strong { font-weight: 800; color: ${COLORS.fg}; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="${placeholder.replace(/"/g, "&quot;")}">${initialHtml}</div>
<script>
  (function () {
    var el = document.getElementById("editor");
    var post = function (payload) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    };

    var notify = function () {
      post({ type: "change", html: el.innerHTML });
    };

    // Height is reported so the native side can grow the WebView to fit its content: a WebView
    // has no intrinsic size, so without this the article is edited through a fixed viewport that
    // scrolls independently of the screen — which on a phone means the caret disappears under
    // the keyboard with no way to follow it.
    var lastHeight = 0;
    var reportHeight = function () {
      var h = Math.max(el.scrollHeight, ${minHeight});
      if (Math.abs(h - lastHeight) > 2) {
        lastHeight = h;
        post({ type: "height", height: h });
      }
    };

    el.addEventListener("input", function () { notify(); reportHeight(); });
    el.addEventListener("blur", notify);

    // Paste as plain text. Pasting from another app otherwise drags in that app's markup and
    // inline styles, which the Markdown conversion would strip anyway — better to never let it
    // into the document than to silently discard it on save.
    el.addEventListener("paste", function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text);
    });

    window.__apply = function (cmd) {
      el.focus();
      switch (cmd) {
        case "bold": document.execCommand("bold"); break;
        case "italic": document.execCommand("italic"); break;
        case "h2": {
          // Toggle: a second tap on a heading returns the line to a paragraph.
          var block = document.queryCommandValue("formatBlock");
          document.execCommand("formatBlock", false, /h2/i.test(block) ? "p" : "h2");
          break;
        }
        case "ul": document.execCommand("insertUnorderedList"); break;
        case "ol": document.execCommand("insertOrderedList"); break;
        case "quote": {
          var b = document.queryCommandValue("formatBlock");
          document.execCommand("formatBlock", false, /blockquote/i.test(b) ? "p" : "blockquote");
          break;
        }
        case "undo": document.execCommand("undo"); break;
        case "redo": document.execCommand("redo"); break;
      }
      notify();
      reportHeight();
    };

    reportHeight();
    post({ type: "ready" });
  })();
  true;
</script>
</body>
</html>`;
}

export function RichTextEditor({
  value,
  onChangeText,
  placeholder = "",
  minHeight = 200,
  label,
}: RichTextEditorProps) {
  const webRef = useRef<WebView>(null);
  const [height, setHeight] = useState(minHeight);

  /**
   * The document is built ONCE from the value this component mounted with, and never rebuilt from
   * later `value` changes. That is deliberate: re-seeding `source` on every keystroke would reload
   * the WebView, losing the caret and the undo stack. The parent's state is downstream of this
   * editor, so there is no other writer to reconcile with — and the article screen mounts fresh
   * with the article's saved content each time it opens.
   */
  const html = useMemo(
    () => buildHtml(markdownToHtml(value), placeholder, minHeight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let msg: { type?: string; html?: string; height?: number };
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return; // never let a malformed frame take down the editor
      }
      if (msg.type === "change" && typeof msg.html === "string") {
        onChangeText(htmlToMarkdown(msg.html));
      } else if (msg.type === "height" && typeof msg.height === "number") {
        setHeight(Math.max(msg.height, minHeight));
      }
    },
    [onChangeText, minHeight],
  );

  const apply = (cmd: Command) => {
    webRef.current?.injectJavaScript(`window.__apply(${JSON.stringify(cmd)}); true;`);
  };

  const tools: { key: Command; Icon: typeof Bold; label: string }[] = [
    { key: "bold", Icon: Bold, label: "Bold" },
    { key: "italic", Icon: Italic, label: "Italic" },
    { key: "h2", Icon: Heading2, label: "Heading" },
    { key: "ul", Icon: List, label: "Bulleted list" },
    { key: "ol", Icon: ListOrdered, label: "Numbered list" },
    { key: "quote", Icon: Quote, label: "Quote" },
  ];

  return (
    <View style={{ gap: 8 }}>
      {label && <Text className="text-[12px] font-bold text-fg">{label}</Text>}
      <View className="border-[1.5px] border-border rounded-[13px] bg-white overflow-hidden">
        <View className="flex-row items-center border-b border-border px-1.5 py-1.5">
          <View className="flex-row flex-1" style={{ gap: 2 }}>
            {tools.map(({ key, Icon, label: a11y }) => (
              <Pressable
                key={key}
                onPress={() => apply(key)}
                accessibilityRole="button"
                accessibilityLabel={a11y}
                className="w-8 h-8 rounded-[8px] items-center justify-center active:bg-bg"
                hitSlop={2}
              >
                <Icon size={17} color={COLORS.fg} />
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => apply("undo")}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            className="w-8 h-8 rounded-[8px] items-center justify-center active:bg-bg"
            hitSlop={2}
          >
            <Undo2 size={16} color={COLORS.muted} />
          </Pressable>
          <Pressable
            onPress={() => apply("redo")}
            accessibilityRole="button"
            accessibilityLabel="Redo"
            className="w-8 h-8 rounded-[8px] items-center justify-center active:bg-bg"
            hitSlop={2}
          >
            <Redo2 size={16} color={COLORS.muted} />
          </Pressable>
        </View>

        <View style={{ height }}>
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={{ html }}
            onMessage={handleMessage}
            // The document is a local string with no links; nothing should ever navigate.
            onShouldStartLoadWithRequest={() => false}
            // The native ScrollView owns scrolling — two nested scrollers fight each other and
            // the inner one wins, trapping the page.
            scrollEnabled={false}
            nestedScrollEnabled={false}
            hideKeyboardAccessoryView
            keyboardDisplayRequiresUserAction={false}
            automaticallyAdjustContentInsets={false}
            style={{ backgroundColor: "#ffffff", flex: 1 }}
          />
        </View>
      </View>
      <Text className="text-muted/70 text-[11px]">
        Select text, then tap a format. What you see here is what your patients read.
      </Text>
    </View>
  );
}

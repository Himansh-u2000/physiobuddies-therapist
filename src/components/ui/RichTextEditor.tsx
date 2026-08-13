import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Bold, Italic, Heading2, List, ListOrdered, Quote, Eye, Pencil } from "lucide-react-native";
import { COLORS } from "@/constants/config";
import { MarkdownText } from "./MarkdownText";

/**
 * Markdown-backed rich-text editor: a formatting toolbar over a multiline input, plus a live
 * Preview toggle that renders via {@link MarkdownText}. Deliberately dependency-free — a true
 * WYSIWYG editor would need `react-native-webview` (a native rebuild + RN-0.85 compat risk), so
 * this gives real formatting (bold/italic/headings/lists/quotes) with zero native surface. The
 * value it produces and consumes is a Markdown string.
 */
interface RichTextEditorProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  label?: string;
}

export function RichTextEditor({
  value,
  onChangeText,
  placeholder,
  minHeight = 200,
  label,
}: RichTextEditorProps) {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [preview, setPreview] = useState(false);

  /** Wrap the current selection (or a placeholder word) with an inline marker. */
  const wrap = (marker: string, placeholderWord: string) => {
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    const chosen = value.slice(start, end) || placeholderWord;
    onChangeText(`${value.slice(0, start)}${marker}${chosen}${marker}${value.slice(end)}`);
  };

  /** Toggle a block prefix (heading / list / quote) on the line the cursor sits in. */
  const linePrefix = (prefix: string) => {
    const pos = Math.min(selection.start, selection.end);
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    const rest = value.slice(lineStart);
    const next = rest.startsWith(prefix)
      ? value.slice(0, lineStart) + rest.slice(prefix.length)
      : value.slice(0, lineStart) + prefix + rest;
    onChangeText(next);
  };

  const tools = [
    { key: "b", Icon: Bold, onPress: () => wrap("**", "bold") },
    { key: "i", Icon: Italic, onPress: () => wrap("_", "italic") },
    { key: "h", Icon: Heading2, onPress: () => linePrefix("## ") },
    { key: "ul", Icon: List, onPress: () => linePrefix("- ") },
    { key: "ol", Icon: ListOrdered, onPress: () => linePrefix("1. ") },
    { key: "q", Icon: Quote, onPress: () => linePrefix("> ") },
  ];

  return (
    <View style={{ gap: 8 }}>
      {label && <Text className="text-[12px] font-bold text-fg">{label}</Text>}
      <View className="border-[1.5px] border-border rounded-[13px] bg-white overflow-hidden">
        <View className="flex-row items-center border-b border-border px-1.5 py-1.5">
          <View className="flex-row flex-1" style={{ gap: 2 }}>
            {tools.map(({ key, Icon, onPress }) => (
              <Pressable
                key={key}
                onPress={onPress}
                disabled={preview}
                className={`w-8 h-8 rounded-[8px] items-center justify-center ${
                  preview ? "opacity-30" : "active:bg-bg"
                }`}
                hitSlop={2}
              >
                <Icon size={17} color={COLORS.fg} />
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setPreview((p) => !p)}
            className="flex-row items-center px-2.5 h-8 rounded-[8px] active:bg-bg"
            style={{ gap: 5 }}
          >
            {preview ? (
              <Pencil size={14} color={COLORS.accent} />
            ) : (
              <Eye size={14} color={COLORS.accent} />
            )}
            <Text className="text-accent text-[12px] font-bold">{preview ? "Edit" : "Preview"}</Text>
          </Pressable>
        </View>

        {preview ? (
          <View className="px-3.5 py-3" style={{ minHeight }}>
            {value.trim() ? (
              <MarkdownText content={value} />
            ) : (
              <Text className="text-muted text-[13px] italic">Nothing to preview yet.</Text>
            )}
          </View>
        ) : (
          <TextInput
            multiline
            value={value}
            onChangeText={onChangeText}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder={placeholder}
            placeholderTextColor="#5e6b77"
            textAlignVertical="top"
            className="px-3.5 py-3 text-[14px] text-fg leading-5"
            style={{ minHeight }}
          />
        )}
      </View>
      <Text className="text-muted/70 text-[11px]">
        Formatting uses Markdown — **bold**, _italic_, ## heading, - bullets, {">"} quote.
      </Text>
    </View>
  );
}

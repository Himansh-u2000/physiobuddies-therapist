import { Fragment, type ReactNode } from "react";
import { View, Text } from "react-native";

/**
 * Compact Markdown renderer — a deliberately dependency-free subset (headings, bold, italic,
 * inline code, bullet/numbered lists, blockquotes, paragraphs). The article rich-text editor
 * stores Markdown, and this renders it for the preview and for reading. Not a full CommonMark
 * implementation; it covers what the toolbar can produce.
 */

const HEADING_CLASS: Record<number, string> = {
  1: "text-[20px] font-extrabold",
  2: "text-[17px] font-extrabold",
  3: "text-[15px] font-bold",
};

/** Parse inline **bold**, _italic_/*italic*, and `code` into styled Text segments. */
function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const bold = m[2] ?? m[3];
    const italic = m[4] ?? m[5];
    const code = m[6];
    if (bold !== undefined) {
      nodes.push(
        <Text key={key++} className="font-bold text-fg">
          {bold}
        </Text>,
      );
    } else if (italic !== undefined) {
      nodes.push(
        <Text key={key++} className="italic">
          {italic}
        </Text>,
      );
    } else if (code !== undefined) {
      nodes.push(
        <Text key={key++} className="text-accent" style={{ fontFamily: "monospace" }}>
          {code}
        </Text>,
      );
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
}

const BLOCK_START = /^(#{1,3}\s|>\s?|[-*]\s+|\d+\.\s+)/;

export function MarkdownText({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      blocks.push(
        <Text key={key++} className={`text-fg mt-2 mb-1 leading-6 ${HEADING_CLASS[level]}`}>
          {parseInline(heading[2]!)}
        </Text>,
      );
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        quote.push(lines[i]!.replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <View key={key++} className="border-l-[3px] border-accent/40 pl-3 my-1.5">
          <Text className="text-muted text-[13.5px] italic leading-5">
            {parseInline(quote.join(" "))}
          </Text>
        </View>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <View key={key++} className="my-1" style={{ gap: 4 }}>
          {items.map((it, ix) => (
            <View key={ix} className="flex-row" style={{ gap: 8 }}>
              <Text className="text-accent text-[13.5px] leading-5">{"•"}</Text>
              <Text className="flex-1 text-fg/90 text-[13.5px] leading-5">{parseInline(it)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <View key={key++} className="my-1" style={{ gap: 4 }}>
          {items.map((it, ix) => (
            <View key={ix} className="flex-row" style={{ gap: 8 }}>
              <Text className="text-accent text-[13.5px] leading-5 font-bold">{ix + 1}.</Text>
              <Text className="flex-1 text-fg/90 text-[13.5px] leading-5">{parseInline(it)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !BLOCK_START.test(lines[i]!)) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push(
      <Text key={key++} className="text-fg/90 text-[13.5px] leading-5 my-0.5">
        {parseInline(para.join(" "))}
      </Text>,
    );
  }

  return <View className={className}>{blocks}</View>;
}

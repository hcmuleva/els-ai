import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { WebView } from 'react-native-webview';
import { ChatMarkdown } from '../chat/ChatMarkdown';
import ImageLightboxModal from '../media/ImageLightboxModal';
import MermaidViewer, { isMermaid, hasMermaidBlocks } from '../media/MermaidViewer';

export type TextFormat = 'auto' | 'html' | 'markdown' | 'plain' | 'mermaid';

export interface RichTextRendererProps {
  content?: string;
  text?: string;
  format?: TextFormat;
  isUser?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HTML_TAG_REGEX = /<(?:p|div|span|h[1-6]|ul|ol|li|b|strong|i|em|u|a|table|tr|td|th|br|code|pre|blockquote|img|section|article)[^>]*>/i;
const MARKDOWN_REGEX = /(?:^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|```|`[^`]+`|\[.*?\]\(.*?\)|^>\s)/m;

export function isInteractiveHtml(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const hasScript = /<script[\s\S]*?>[\s\S]*?<\/script>/i.test(trimmed);
  const isFullDoc = /^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
  const hasStyleTag = /<style[\s\S]*?>[\s\S]*?<\/style>/i.test(trimmed);
  return hasScript || (isFullDoc && hasStyleTag);
}

export function sanitizeHtmlForRender(html: string): string {
  if (!html || typeof html !== 'string') return '';
  let clean = html.trim();

  // If a full HTML document with <body> is provided, extract the body content
  const bodyMatch = clean.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]?.trim()) {
    clean = bodyMatch[1].trim();
  }

  // Strip DOCTYPE, <html>, </html>, <head>...</head>, <script>...</script>, <style>...</style>, <meta...>, <link...>, comments
  clean = clean
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();

  return clean || html.trim();
}

export function isPureHtml(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Explicit HTML document declaration or root
  if (/^<!DOCTYPE\s+html/i.test(trimmed)) return true;
  if (/^<html[\s>]/i.test(trimmed)) return true;
  if (/^<(?:head|body)\b/i.test(trimmed)) return true;

  const hasMarkdownHeadings = /^#{1,6}\s+/m.test(trimmed);
  const hasMarkdownFences = /^```/m.test(trimmed);

  // If starts with common block element and has no markdown headings or fences
  if (/^<(?:div|section|article|main|header|footer|nav|aside|table|p|ul|ol|h[1-6]|blockquote)\b/i.test(trimmed)) {
    if (!hasMarkdownHeadings && !hasMarkdownFences) {
      return true;
    }
  }

  // If text contains multiple HTML tags and no markdown headings/fences
  const htmlTagCount = (trimmed.match(/<\/?(?:div|p|span|h[1-6]|ul|ol|li|b|strong|i|em|u|a|table|tr|td|th|br|code|pre|blockquote|img|section|article)\b/gi) || []).length;
  if (htmlTagCount >= 2 && !hasMarkdownHeadings && !hasMarkdownFences) {
    return true;
  }

  return false;
}

export function markdownToHtml(md: string): string {
  if (!md || typeof md !== 'string') return '';

  if (isPureHtml(md)) {
    return sanitizeHtmlForRender(md);
  }

  const lines = md.split(/\r?\n/);
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inUl = false;
  let inOl = false;
  let inHtmlTag = false;

  const closeLists = () => {
    if (inUl) {
      result.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      result.push('</ol>');
      inOl = false;
    }
  };

  const processInline = (str: string): string => {
    return str
      // Bold + Italic: ***text***
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_
      .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<em>$1</em>')
      .replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
      // Inline Code: `code`
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Link: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  };

  const isHtmlTagLine = (l: string): boolean => {
    const s = l.trim();
    return /^<\/?(?:[a-zA-Z0-9-]+|!--|!DOCTYPE)\b/i.test(s) || /<\/(?:[a-zA-Z0-9-]+)>$/i.test(s);
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        closeLists();
        inCodeBlock = true;
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        const escaped = codeBuffer
          .join('\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        result.push(`<pre><code>${escaped}</code></pre>`);
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Handle multiline HTML tag (e.g. <div style="..."\n id="...">)
    if (inHtmlTag) {
      result.push(rawLine);
      if (line.includes('>')) {
        inHtmlTag = false;
      }
      continue;
    }

    if (line.startsWith('<') && !line.includes('>')) {
      closeLists();
      inHtmlTag = true;
      result.push(rawLine);
      continue;
    }

    // Preserve existing HTML elements or comments
    if (isHtmlTagLine(line)) {
      closeLists();
      result.push(rawLine);
      continue;
    }

    // Headings: #, ##, ###, ####, #####, ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      result.push(`<h${level}>${processInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Horizontal Rule: --- or ***
    if (/^(?:---|\*\*\*|___)$/.test(line)) {
      closeLists();
      result.push('<hr/>');
      continue;
    }

    // Blockquote: > text
    if (line.startsWith('>')) {
      closeLists();
      const quoteText = line.replace(/^>\s*/, '');
      result.push(`<blockquote>${processInline(quoteText)}</blockquote>`);
      continue;
    }

    // Unordered List: - item or * item
    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) {
        result.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        result.push('<ul>');
        inUl = true;
      }
      result.push(`<li>${processInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered List: 1. item
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        result.push('<ol>');
        inOl = true;
      }
      result.push(`<li>${processInline(olMatch[1])}</li>`);
      continue;
    }

    // Blank line
    if (!line) {
      closeLists();
      continue;
    }

    // Standard paragraph line
    closeLists();
    result.push(`<p>${processInline(rawLine)}</p>`);
  }

  closeLists();
  return result.join('\n');
}

export function detectTextFormat(text: string): 'html' | 'markdown' | 'plain' | 'mermaid' {
  if (!text || typeof text !== 'string') return 'plain';
  const trimmed = text.trim();
  if (isMermaid(trimmed)) return 'mermaid';
  if (isPureHtml(trimmed)) return 'html';

  const hasMdHeadings = /^#{1,6}\s+/m.test(trimmed);
  const hasMdLists = /^\s*[-*+]\s+[^\s]/m.test(trimmed) || /^\s*\d+\.\s+[^\s]/m.test(trimmed);
  const hasMdBlockquote = /^>\s+/m.test(trimmed);
  const hasMdFences = /^```/m.test(trimmed);
  const hasMdLinks = /\[[^\]\r\n]+\]\((?:https?:\/\/[^\s)]+|\/[^\s)]+)\)/.test(trimmed);
  const hasMdFormatting = /(\*\*|__)[^\r\n]+?\1/.test(trimmed) || /(?<!\w)(\*|_)[^\s\r\n]+?\1(?!\w)/.test(trimmed) || /`[^`\r\n]+`/.test(trimmed);

  const hasMd = hasMdHeadings || hasMdLists || hasMdBlockquote || hasMdFences || hasMdLinks || hasMdFormatting;
  const hasHtml = HTML_TAG_REGEX.test(trimmed);

  if (hasHtml && !hasMd) return 'html';
  if (hasMd) return 'markdown';
  if (hasHtml) return 'html';
  return 'plain';
}

const customTagsStyles = {
  body: {
    color: '#1E293B',
    fontSize: 15,
    lineHeight: 24,
  },
  p: {
    marginVertical: 6,
    fontSize: 15,
    lineHeight: 24,
    color: '#1E293B',
  },
  h1: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#0F172A',
    marginVertical: 8,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0F172A',
    marginVertical: 6,
  },
  h3: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0F172A',
    marginVertical: 4,
  },
  strong: {
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  b: {
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  em: {
    fontStyle: 'italic' as const,
  },
  i: {
    fontStyle: 'italic' as const,
  },
  ul: {
    marginVertical: 6,
    paddingLeft: 16,
  },
  ol: {
    marginVertical: 6,
    paddingLeft: 16,
  },
  li: {
    marginVertical: 2,
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
  },
  code: {
    backgroundColor: '#F1F5F9',
    color: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13.5,
  },
  pre: {
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginVertical: 10,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    paddingLeft: 12,
    color: '#475569',
    fontStyle: 'italic' as const,
    marginVertical: 6,
  },
  a: {
    color: '#2563EB',
    textDecorationLine: 'underline' as const,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 8,
  },
  th: {
    backgroundColor: '#F8FAFC',
    fontWeight: '700' as const,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  td: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
};

export default function RichTextRenderer({
  content,
  text,
  format = 'auto',
  isUser = false,
  style,
}: RichTextRendererProps) {
  const { width } = useWindowDimensions();
  const effectiveWidth = Math.max(width - 48, 280);
  const rawText = content ?? text ?? '';
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const effectiveFormat = useMemo(() => {
    if (format !== 'auto') return format;
    return detectTextFormat(rawText);
  }, [rawText, format]);

  if (!rawText || !rawText.trim()) {
    return null;
  }

  const htmlContent = useMemo(() => {
    return markdownToHtml(rawText);
  }, [rawText]);

  if (effectiveFormat === 'mermaid' || isMermaid(rawText)) {
    return (
      <View style={[styles.wrap, style]}>
        <MermaidViewer code={rawText} />
      </View>
    );
  }

  if (hasMermaidBlocks(rawText)) {
    const parts = rawText.split(/(```mermaid\b[\s\S]*?```)/gi);
    return (
      <View style={[styles.wrap, style]}>
        {parts.map((part, index) => {
          if (!part || !part.trim()) return null;
          if (/^```mermaid\b/i.test(part.trim())) {
            return <MermaidViewer key={index} code={part} />;
          }
          return <RichTextRenderer key={index} content={part} format="markdown" isUser={isUser} />;
        })}
      </View>
    );
  }

  if (isInteractiveHtml(rawText)) {
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.wrap, style]}>
          <iframe
            srcDoc={rawText}
            style={{
              width: '100%',
              minHeight: 650,
              height: 700,
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
            }}
            title="Interactive Content Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </View>
      );
    }
    return (
      <View style={[styles.wrap, { minHeight: 650 }, style]}>
        <WebView
          source={{ html: rawText }}
          style={{ width: '100%', height: 650, borderRadius: 12 }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      </View>
    );
  }

  if (effectiveFormat === 'html' || effectiveFormat === 'markdown') {
    // If it has HTML tags or format is auto/html, render with RenderHtml using the converted HTML
    const hasHtmlTags = HTML_TAG_REGEX.test(rawText);
    if (hasHtmlTags || effectiveFormat === 'html') {
      return (
        <View style={[styles.wrap, style]}>
          <RenderHtml
            contentWidth={effectiveWidth}
            source={{ html: htmlContent }}
            tagsStyles={customTagsStyles}
            enableCSSInlineProcessing
            defaultTextProps={{ selectable: true }}
          />
          <ImageLightboxModal
            visible={!!lightboxImg}
            imageUrl={lightboxImg || undefined}
            onClose={() => setLightboxImg(null)}
          />
        </View>
      );
    }

    return (
      <View style={[styles.wrap, style]}>
        <ChatMarkdown content={rawText} isUser={isUser} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.plainText} selectable>
        {rawText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    ...(Platform.OS === 'web' ? ({ userSelect: 'text' as any }) : {}),
  },
  plainText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#1E293B',
    ...(Platform.OS === 'web' ? ({ userSelect: 'text' as any }) : {}),
  },
});


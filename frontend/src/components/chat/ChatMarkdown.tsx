import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Check, Copy } from 'lucide-react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';

interface ChatMarkdownProps {
  content: string;
  isUser?: boolean;
}

type InlineToken = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  linkUrl?: string;
  strikethrough?: boolean;
};

type BlockType =
  | { type: 'heading'; level: number; text: string }
  | { type: 'section_header'; text: string; hasColon: boolean }
  | { type: 'key_value'; key: string; value: string }
  | { type: 'unordered_item'; indent: number; marker: string; text: string }
  | { type: 'ordered_item'; indent: number; number: string; text: string }
  | { type: 'code_block'; language: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string }
  | { type: 'spacer' };

/**
 * Tokenizes inline formatting: bold (** or __), italic (* or _), inline code (`), and links.
 */
export function tokenizeInline(text: string): InlineToken[] {
  if (!text) return [];

  // Match:
  // 1: ***bold italic***
  // 2: **bold**
  // 3: *italic*
  // 4: ___bold italic___
  // 5: __bold__
  // 6: _italic_ (avoid matching middle_of_word)
  // 7: `inline code`
  // 8: [link text](url)
  const regex =
    /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|___([^_]+)___|__([^_]+)__|(?<!\w)_([^_]+)_(?!\w)|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      // ***bold italic***
      tokens.push({ text: match[2], bold: true, italic: true });
    } else if (match[3] !== undefined) {
      // **bold**
      tokens.push({ text: match[3], bold: true });
    } else if (match[4] !== undefined) {
      // *italic*
      tokens.push({ text: match[4], italic: true });
    } else if (match[5] !== undefined) {
      // ___bold italic___
      tokens.push({ text: match[5], bold: true, italic: true });
    } else if (match[6] !== undefined) {
      // __bold__
      tokens.push({ text: match[6], bold: true });
    } else if (match[7] !== undefined) {
      // _italic_
      tokens.push({ text: match[7], italic: true });
    } else if (match[8] !== undefined) {
      // `code`
      tokens.push({ text: match[8], code: true });
    } else if (match[9] !== undefined && match[10] !== undefined) {
      // [text](url)
      tokens.push({ text: match[9], linkUrl: match[10] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    // If text ends with an unclosed delimiter (e.g. streaming **something), treat gracefully
    tokens.push({ text: text.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Parses markdown lines into structured block elements.
 */
export function parseBlocks(rawContent: string): BlockType[] {
  if (!rawContent) return [];
  const lines = rawContent.split(/\r?\n/);
  const blocks: BlockType[] = [];

  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code block toggle
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.replace(/^```/, '').trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        blocks.push({
          type: 'code_block',
          language: codeLang,
          code: codeLines.join('\n'),
        });
        codeLang = '';
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    // Empty line
    if (!trimmed) {
      // Avoid consecutive spacers
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'spacer') {
        blocks.push({ type: 'spacer' });
      }
      continue;
    }

    // Horizontal rule: --- or *** or ___
    if (/^([-*_]){3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      continue;
    }

    // Markdown Heading: #, ##, ###, ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    // Standalone bold header: **Objectives:** or **Day 1: Introduction...** or **Lesson Plan:**
    const standaloneHeaderMatch = trimmed.match(/^\*\*([^*]+)\*\*(\:?)$/);
    if (standaloneHeaderMatch) {
      const headerText = standaloneHeaderMatch[1].trim();
      const hasColon = standaloneHeaderMatch[2] === ':' || headerText.endsWith(':');
      blocks.push({
        type: 'section_header',
        text: headerText.replace(/:$/, ''),
        hasColon,
      });
      continue;
    }

    // Key-Value pair on its own line: **Key:** Value
    const keyValueMatch = trimmed.match(/^\*\*([^*]+?)\:\*\*\s*(.*)$/);
    if (keyValueMatch) {
      blocks.push({
        type: 'key_value',
        key: keyValueMatch[1].trim(),
        value: keyValueMatch[2].trim(),
      });
      continue;
    }

    // Blockquote: > text
    if (trimmed.startsWith('>')) {
      blocks.push({
        type: 'quote',
        text: trimmed.replace(/^>\s*/, ''),
      });
      continue;
    }

    // Ordered list item: e.g. "1. Item" or "\t2. Item" or "  1) Item"
    const orderedMatch = rawLine.match(/^(\s*)(\d+)[\.\)]\s+(.*)$/);
    if (orderedMatch) {
      const leadingSpace = orderedMatch[1].replace(/\t/g, '  ').length;
      const indent = Math.min(3, Math.floor(leadingSpace / 2));
      blocks.push({
        type: 'ordered_item',
        indent,
        number: orderedMatch[2],
        text: orderedMatch[3].trim(),
      });
      continue;
    }

    // Unordered list item: e.g. "* Item", "- Item", "+ Item", "• Item"
    const unorderedMatch = rawLine.match(/^(\s*)([*•+-])\s+(.*)$/);
    if (unorderedMatch) {
      const leadingSpace = unorderedMatch[1].replace(/\t/g, '  ').length;
      const indent = Math.min(3, Math.floor(leadingSpace / 2));
      blocks.push({
        type: 'unordered_item',
        indent,
        marker: unorderedMatch[2],
        text: unorderedMatch[3].trim(),
      });
      continue;
    }

    // Standard paragraph line
    blocks.push({
      type: 'paragraph',
      text: rawLine.trim(),
    });
  }

  // If message ended with unclosed code block (e.g. streaming)
  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({
      type: 'code_block',
      language: codeLang,
      code: codeLines.join('\n'),
    });
  }

  return blocks;
}

/**
 * Renders formatted inline text (supporting bold, italic, code pills, and links).
 */
export function FormattedInlineText({
  text,
  isUser,
  baseStyle,
}: {
  text: string;
  isUser?: boolean;
  baseStyle?: TextStyle;
}) {
  const tokens = useMemo(() => tokenizeInline(text), [text]);

  const defaultTextColor = isUser ? '#FFFFFF' : Colors.text;
  const boldTextColor = isUser ? '#FFFFFF' : '#0F172A';

  return (
    <Text style={[styles.inlineBase, { color: defaultTextColor }, baseStyle]}>
      {tokens.map((token, idx) => {
        if (token.code) {
          return (
            <Text
              key={idx}
              style={[
                styles.codeInline,
                {
                  backgroundColor: isUser ? 'rgba(255,255,255,0.25)' : '#EEF2F9',
                  color: isUser ? '#FFFFFF' : '#1E293B',
                },
              ]}
            >
              {' '}{token.text}{' '}
            </Text>
          );
        }

        const tokenStyles: TextStyle[] = [];
        if (token.bold) {
          tokenStyles.push({
            fontWeight: '700',
            color: boldTextColor,
          });
        }
        if (token.italic) {
          tokenStyles.push({ fontStyle: 'italic' });
        }
        if (token.strikethrough) {
          tokenStyles.push({ textDecorationLine: 'line-through' });
        }
        if (token.linkUrl) {
          tokenStyles.push({
            color: isUser ? '#D6E8FF' : Colors.primary,
            textDecorationLine: 'underline',
          });
        }

        return (
          <Text key={idx} style={tokenStyles}>
            {token.text}
          </Text>
        );
      })}
    </Text>
  );
}

/**
 * Code Block Component with language tag and clipboard copy button.
 */
function CodeBlock({ code, language, isUser }: { code: string; language: string; isUser?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={styles.codeBlockCard}>
      <View style={styles.codeBlockHeader}>
        <Text style={styles.codeBlockLang}>{language || 'code'}</Text>
        <Pressable onPress={handleCopy} hitSlop={6} style={styles.codeCopyBtn}>
          {copied ? (
            <Check size={13} color={Colors.success} strokeWidth={2.5} />
          ) : (
            <Copy size={13} color={Colors.textMuted} strokeWidth={2} />
          )}
          <Text style={[styles.codeCopyText, copied && { color: Colors.success }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeScroll}>
        <Text style={styles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
}

/**
 * Full Markdown Document Renderer for Chat Bubbles.
 */
export function ChatMarkdown({ content, isUser = false }: ChatMarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'spacer':
            return <View key={index} style={styles.spacer} />;

          case 'hr':
            return (
              <View
                key={index}
                style={[
                  styles.hr,
                  { backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : Colors.border },
                ]}
              />
            );

          case 'heading': {
            const headingStyles: TextStyle[] = [styles.heading];
            if (block.level === 1) {
              headingStyles.push(styles.h1);
            } else if (block.level === 2) {
              headingStyles.push(styles.h2);
            } else if (block.level === 3) {
              headingStyles.push(styles.h3);
            } else {
              headingStyles.push(styles.h4);
            }
            if (isUser) {
              headingStyles.push({ color: '#FFFFFF' });
            }
            return (
              <View key={index} style={styles.headingWrap}>
                <FormattedInlineText text={block.text} isUser={isUser} baseStyle={StyleSheet.flatten(headingStyles)} />
              </View>
            );
          }

          case 'section_header': {
            // Standalone headers like **Lesson Plan:** or **Day 1: Introduction...**
            const isDayOrMajor = /^(day\s*\d+|part\s*\d+|section\s*\d+)/i.test(block.text);
            return (
              <View key={index} style={[styles.sectionHeaderRow, isDayOrMajor && styles.majorSectionWrap]}>
                <View style={styles.sectionHeaderContent}>
                  <FormattedInlineText
                    text={block.text + (block.hasColon ? ':' : '')}
                    isUser={isUser}
                    baseStyle={isDayOrMajor ? styles.majorSectionText : styles.sectionHeaderText}
                  />
                </View>
              </View>
            );
          }

          case 'key_value': {
            // Format like **Lesson Topic:** Plant Growth and Photosynthesis
            return (
              <View key={index} style={styles.keyValueRow}>
                <Text style={[styles.inlineBase, isUser && { color: '#FFFFFF' }]}>
                  <Text
                    style={[
                      styles.keyText,
                      { color: isUser ? '#FFFFFF' : '#0F172A' },
                    ]}
                  >
                    {block.key}:{' '}
                  </Text>
                  <FormattedInlineText
                    text={block.value}
                    isUser={isUser}
                    baseStyle={styles.keyValueBody}
                  />
                </Text>
              </View>
            );
          }

          case 'ordered_item': {
            // E.g. "1. **Introduction (10 minutes)**"
            const indentMargin = block.indent * 18;
            return (
              <View key={index} style={[styles.listItemRow, { marginLeft: indentMargin }]}>
                <View
                  style={[
                    styles.orderBadge,
                    isUser
                      ? styles.orderBadgeUser
                      : styles.orderBadgeAssistant,
                  ]}
                >
                  <Text
                    style={[
                      styles.orderBadgeText,
                      { color: isUser ? '#FFFFFF' : Colors.primary },
                    ]}
                  >
                    {block.number}
                  </Text>
                </View>
                <View style={styles.listItemTextWrap}>
                  <FormattedInlineText text={block.text} isUser={isUser} />
                </View>
              </View>
            );
          }

          case 'unordered_item': {
            // Unordered list item with clean nested bullets
            const indentMargin = block.indent * 18;
            const isSubLevel = block.indent > 0;
            return (
              <View key={index} style={[styles.listItemRow, { marginLeft: indentMargin }]}>
                <View style={styles.bulletMarkerWrap}>
                  {block.marker === '+' || block.indent >= 2 ? (
                    <View
                      style={[
                        styles.bulletSquare,
                        { backgroundColor: isUser ? '#FFFFFF' : Colors.textMuted },
                      ]}
                    />
                  ) : isSubLevel ? (
                    <View
                      style={[
                        styles.bulletRing,
                        { borderColor: isUser ? '#FFFFFF' : Colors.primary },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.bulletDot,
                        { backgroundColor: isUser ? '#FFFFFF' : Colors.primary },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.listItemTextWrap}>
                  <FormattedInlineText text={block.text} isUser={isUser} />
                </View>
              </View>
            );
          }

          case 'quote': {
            return (
              <View
                key={index}
                style={[
                  styles.quoteCard,
                  {
                    backgroundColor: isUser ? 'rgba(255,255,255,0.12)' : '#F8FAFD',
                    borderColor: isUser ? 'rgba(255,255,255,0.3)' : Colors.border,
                  },
                ]}
              >
                <FormattedInlineText
                  text={block.text}
                  isUser={isUser}
                  baseStyle={styles.quoteText}
                />
              </View>
            );
          }

          case 'code_block': {
            return (
              <CodeBlock
                key={index}
                code={block.code}
                language={block.language}
                isUser={isUser}
              />
            );
          }

          case 'paragraph':
          default:
            return (
              <View key={index} style={styles.paragraphWrap}>
                <FormattedInlineText text={block.text} isUser={isUser} />
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  inlineBase: {
    fontSize: 13.5,
    lineHeight: 20.5,
    letterSpacing: 0.1,
  },

  paragraphWrap: {
    marginVertical: 2.5,
  },

  spacer: {
    height: 7,
  },

  hr: {
    height: 1,
    marginVertical: 8,
    width: '100%',
  },

  // Headings
  headingWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  heading: {
    color: '#0F172A',
  },
  h1: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },
  h2: {
    fontSize: 15.5,
    fontWeight: '700',
    lineHeight: 21,
  },
  h3: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
  },
  h4: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 19,
  },

  // Section Headers (**Objectives:**, **Lesson Plan:**, etc.)
  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 3,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.15,
  },
  majorSectionWrap: {
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
    backgroundColor: '#EEF4FF',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#DCE8FD',
  },
  majorSectionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E4A9E',
  },

  // Key-Value Rows (**Lesson Topic:** Plant Growth)
  keyValueRow: {
    marginVertical: 2,
  },
  keyText: {
    fontWeight: '700',
    fontSize: 13.5,
  },
  keyValueBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },

  // List Items
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2.5,
  },
  listItemTextWrap: {
    flex: 1,
    paddingLeft: 4,
  },

  // Unordered Bullets
  bulletMarkerWrap: {
    width: 16,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
  },
  bulletRing: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.2,
    backgroundColor: 'transparent',
  },
  bulletSquare: {
    width: 4,
    height: 4,
    borderRadius: 1,
  },

  // Ordered Numbers
  orderBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 9.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    marginTop: 1,
    paddingHorizontal: 3,
  },
  orderBadgeAssistant: {
    backgroundColor: '#EBF1FF',
    borderWidth: 1,
    borderColor: '#DCE7FE',
  },
  orderBadgeUser: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  orderBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },

  // Code Block
  codeBlockCard: {
    marginVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: '#1E2433',
    borderWidth: 1,
    borderColor: '#2D3748',
    overflow: 'hidden',
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    backgroundColor: '#161B26',
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  codeBlockLang: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'lowercase',
  },
  codeCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  codeCopyText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  codeScroll: {
    padding: Spacing.md,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#E2E8F0',
  },

  // Inline Code
  codeInline: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    borderRadius: 4,
    fontWeight: '600',
  },

  // Blockquote Card
  quoteCard: {
    marginVertical: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  quoteText: {
    fontStyle: 'italic',
    color: '#334155',
  },
});

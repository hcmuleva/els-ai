/**
 * LatexText — Reusable LaTeX renderer for Physics, Chemistry, and Math.
 *
 * Supports:
 *   - Inline LaTeX:  $...$  or  \(...\)
 *   - Display LaTeX: $$...$$ or \[...\]
 *   - Mixed text + LaTeX in one string
 *   - Compact mode for card previews (fixed height, clips overflow)
 *   - Full mode for quiz player / question view (auto-sizes)
 *
 * Rendering strategy:
 *   - If the text contains NO LaTeX → renders as plain <Text> (zero overhead).
 *   - If LaTeX is detected → renders via WebView with KaTeX loaded from CDN.
 *     The WebView is transparent and auto-sizes via postMessage.
 */

import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { TextStyle } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LatexTextProps {
  /** The content string — may contain LaTeX delimiters mixed with plain text. */
  content: string;
  /**
   * Style applied when rendering plain text (no LaTeX).
   * `fontSize` and `color` are extracted and forwarded to the KaTeX renderer.
   */
  style?: TextStyle;
  /**
   * Compact mode: fixes the WebView to `compactHeight` and clips overflow.
   * Ideal for card lists / previews where you want consistent row heights.
   */
  compact?: boolean;
  /** Fixed height used in compact mode. Default: 44 */
  compactHeight?: number;
  /** numberOfLines for plain-text fallback in compact mode. Default: 2 */
  numberOfLines?: number;
  /** Background color passed to the KaTeX page. Default: transparent */
  background?: string;
}

// ─── LaTeX detection ──────────────────────────────────────────────────────────

/** Returns true if the string contains any recognised LaTeX delimiter. */
export function hasLatex(text: string): boolean {
  if (!text) return false;
  // Display: $$...$$ or \[...\]
  if (/\$\$[\s\S]+?\$\$/.test(text)) return true;
  if (/\\\[[\s\S]+?\\\]/.test(text)) return true;
  // Inline: $...$ (single, not double) or \(...\)
  if (/(?<!\$)\$(?!\$).+?(?<!\$)\$(?!\$)/.test(text)) return true;
  if (/\\\([\s\S]+?\\\)/.test(text)) return true;
  return false;
}

// ─── KaTeX HTML builder ───────────────────────────────────────────────────────

function buildKatexHtml(
  content: string,
  fontSize: number,
  color: string,
  background: string
): string {
  // JSON-encode the content so we don't have to worry about any escape issues.
  const jsonContent = JSON.stringify(content);

  const bgStyle =
    background === 'transparent'
      ? 'background: transparent;'
      : `background: ${background};`;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { ${bgStyle} font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: ${fontSize}px; color: ${color}; line-height: 1.5; overflow-x: hidden; -webkit-text-size-adjust: none; }
  #content { padding: 2px 0; word-break: break-word; }
  .katex { font-size: 1em; }
  .katex-display { margin: 6px 0; overflow-x: auto; }
  .katex-error { color: #cc0000; font-size: 0.85em; }
</style>
</head>
<body>
<div id="content"></div>
<script>
  (function() {
    var raw = ${jsonContent};
    var el = document.getElementById('content');
    el.textContent = raw;
    renderMathInElement(el, {
      delimiters: [
        { left: '$$',   right: '$$',   display: true  },
        { left: '\\\\[', right: '\\\\]', display: true  },
        { left: '$',    right: '$',    display: false },
        { left: '\\\\(', right: '\\\\)', display: false }
      ],
      throwOnError: false,
      errorColor: '#cc0000'
    });
    function postHeight() {
      var h = el.scrollHeight;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
      }
    }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(postHeight);
      ro.observe(el);
    } else {
      setTimeout(postHeight, 250);
    }
    // Also fire immediately after render
    postHeight();
  })();
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LatexText({
  content,
  style,
  compact = false,
  compactHeight = 44,
  numberOfLines = 2,
  background = 'transparent',
}: LatexTextProps) {
  const [webViewHeight, setWebViewHeight] = useState(compact ? compactHeight : 40);
  const didSetHeight = useRef(false);

  const fontSize: number = (style as any)?.fontSize ?? 15;
  const color: string = (style as any)?.color ?? '#1A2233';

  // ── Fast path: no LaTeX ─────────────────────────────────────────────────────
  if (!hasLatex(content || '')) {
    return (
      <Text style={style} numberOfLines={compact ? numberOfLines : undefined}>
        {content}
      </Text>
    );
  }

  // ── LaTeX path via WebView ──────────────────────────────────────────────────
  const html = buildKatexHtml(content, fontSize, color, background);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'height' && typeof data.value === 'number') {
          const h = Math.ceil(data.value) + 6; // 6px breathing room
          if (compact) {
            // In compact mode, cap at compactHeight and only set once
            if (!didSetHeight.current) {
              didSetHeight.current = true;
              setWebViewHeight(Math.min(h, compactHeight));
            }
          } else {
            setWebViewHeight(Math.max(h, 20));
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    },
    [compact, compactHeight]
  );

  const viewHeight = compact ? compactHeight : webViewHeight;

  return (
    <View style={{ height: viewHeight, overflow: 'hidden' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={onMessage}
        backgroundColor={background === 'transparent' ? 'transparent' : background}
        javaScriptEnabled
        domStorageEnabled={false}
        mixedContentMode="compatibility"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

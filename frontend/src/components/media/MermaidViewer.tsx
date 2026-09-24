import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Check, Code, Copy, Eye, Maximize2, X } from 'lucide-react-native';

const MERMAID_DIAGRAM_REGEX =
  /^\s*(?:graph\s+[A-Z]{2}|flowchart\s+[A-Z]{2}|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie(?:\s+title)?|quadrantChart|mindmap|timeline|gitGraph|zenuml|C4Context|sankey-beta|block-beta)\b/m;

export function isMermaid(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (/^```mermaid\b/i.test(trimmed)) return true;

  if (MERMAID_DIAGRAM_REGEX.test(trimmed)) {
    const hasMdHeadings = /^#{1,6}\s+/m.test(trimmed);
    if (!hasMdHeadings) return true;
  }

  return false;
}

export function hasMermaidBlocks(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /```mermaid\b[\s\S]*?```/i.test(text);
}

export function extractMermaidCode(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  const match = trimmed.match(/^```mermaid\s*([\s\S]*?)\s*```$/i);
  if (match) return match[1].trim();
  return trimmed;
}

export function buildMermaidHtml(code: string, theme: 'default' | 'neutral' | 'dark' = 'default'): string {
  const sanitized = code.replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: auto;
    }
    #wrapper {
      padding: 24px 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100%;
    }
    .mermaid {
      display: flex;
      justify-content: center;
      width: 100%;
      text-align: center;
    }
    .mermaid svg {
      max-width: 100%;
      height: auto !important;
      border-radius: 8px;
    }
    #error-box {
      display: none;
      color: #B91C1C;
      background: #FEF2F2;
      border: 1px solid #FEE2E2;
      border-radius: 8px;
      padding: 14px 18px;
      font-family: monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      max-width: 100%;
      text-align: left;
    }
  </style>
</head>
<body>
  <div id="wrapper">
    <div id="error-box"></div>
    <div id="container" class="mermaid">
${sanitized}
    </div>
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: '${theme}',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    mermaid.parseError = function(err, hash) {
      document.getElementById('container').style.display = 'none';
      var errBox = document.getElementById('error-box');
      errBox.style.display = 'block';
      errBox.textContent = 'Mermaid Diagram Syntax Error:\\n' + (typeof err === 'string' ? err : (err && err.str) || 'Check diagram structure');
    };
  </script>
</body>
</html>`;
}

export interface MermaidViewerProps {
  code: string;
  title?: string;
  height?: number;
  showCodeToggle?: boolean;
}

export default function MermaidViewer({
  code,
  title = 'Mermaid Diagram',
  height = 360,
  showCodeToggle = true,
}: MermaidViewerProps) {
  const [viewMode, setViewMode] = useState<'diagram' | 'code'>('diagram');
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanCode = useMemo(() => extractMermaidCode(code), [code]);
  const htmlContent = useMemo(() => buildMermaidHtml(cleanCode), [cleanCode]);

  const handleCopy = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(cleanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderContent = (isModal = false) => {
    if (viewMode === 'code') {
      return (
        <ScrollView style={isModal ? styles.modalCodeScroll : styles.codeScroll}>
          <Text style={styles.codeText} selectable>
            {cleanCode}
          </Text>
        </ScrollView>
      );
    }

    if (Platform.OS === 'web') {
      return (
        <iframe
          srcDoc={htmlContent}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#FFFFFF',
          }}
          title={title}
          sandbox="allow-scripts allow-same-origin"
        />
      );
    }

    return (
      <WebView
        source={{ html: htmlContent }}
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Toolbar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MERMAID</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {showCodeToggle ? (
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setViewMode('diagram')}
                style={[styles.toggleBtn, viewMode === 'diagram' && styles.toggleBtnActive]}
              >
                <Eye size={12} color={viewMode === 'diagram' ? '#2563EB' : '#64748B'} />
                <Text style={[styles.toggleBtnText, viewMode === 'diagram' && styles.toggleBtnTextActive]}>
                  Diagram
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setViewMode('code')}
                style={[styles.toggleBtn, viewMode === 'code' && styles.toggleBtnActive]}
              >
                <Code size={12} color={viewMode === 'code' ? '#2563EB' : '#64748B'} />
                <Text style={[styles.toggleBtnText, viewMode === 'code' && styles.toggleBtnTextActive]}>
                  Code
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCopy}
            style={styles.iconBtn}
            accessibilityLabel="Copy Mermaid code"
          >
            {copied ? <Check size={13} color="#16A34A" /> : <Copy size={13} color="#475569" />}
            <Text style={[styles.iconBtnText, copied && { color: '#16A34A' }]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setFullscreen(true)}
            style={styles.iconBtn}
            accessibilityLabel="Expand Mermaid diagram"
          >
            <Maximize2 size={13} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stage Container */}
      <View style={[styles.stage, { height }]}>
        {renderContent(false)}
      </View>

      {/* Fullscreen Lightbox Modal */}
      <Modal
        visible={fullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>MERMAID</Text>
                </View>
                <Text style={styles.modalTitle}>{title}</Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCopy}
                  style={styles.iconBtn}
                >
                  {copied ? <Check size={13} color="#16A34A" /> : <Copy size={13} color="#475569" />}
                  <Text style={[styles.iconBtnText, copied && { color: '#16A34A' }]}>
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setFullscreen(false)}
                  style={styles.modalCloseBtn}
                >
                  <X size={18} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalBody}>
              {renderContent(true)}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F6',
    borderRadius: 6,
    padding: 2,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  stage: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  codeScroll: {
    padding: 14,
    backgroundColor: '#0F172A',
    flex: 1,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    lineHeight: 20,
    color: '#F8FAFC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 960,
    height: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalCodeScroll: {
    padding: 16,
    backgroundColor: '#0F172A',
    flex: 1,
  },
});

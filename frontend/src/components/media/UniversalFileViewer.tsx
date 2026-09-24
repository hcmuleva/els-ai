import React, { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { Download, ExternalLink, FileCode, FileText, Image as ImageIcon, Maximize2, Video as VideoIcon } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import AudioPlayer from './AudioPlayer';
import DocumentViewer from './DocumentViewer';
import RichTextRenderer from '../text/RichTextRenderer';
import ImageLightboxModal from './ImageLightboxModal';
import MermaidViewer from './MermaidViewer';

export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'text' | 'html' | 'mermaid';

export function detectFileCategory(uri: string = '', fileName: string = ''): FileCategory {
  const uriLower = (uri || '').toLowerCase();
  const fileLower = (fileName || '').toLowerCase();

  // 1. Mermaid Diagrams
  if (
    /\.(mmd|mermaid)(?:$|[?#])/i.test(uriLower) ||
    /\.(mmd|mermaid)$/i.test(fileLower)
  ) {
    return 'mermaid';
  }

  // 2. HTML Documents
  if (
    /\.(html?)(?:$|[?#])/i.test(uriLower) ||
    /\.(html?)$/i.test(fileLower) ||
    /^data:text\/html/i.test(uriLower)
  ) {
    return 'html';
  }

  // 3. Text / Markdown
  if (
    /\.(txt|md|markdown|json|csv|log)(?:$|[?#])/i.test(uriLower) ||
    /\.(txt|md|markdown|json|csv|log)$/i.test(fileLower) ||
    /^data:text\//i.test(uriLower)
  ) {
    return 'text';
  }

  // 2. Audio
  if (
    /\.(mp3|wav|ogg|aac|m4a|flac)(?:$|[?#])/i.test(uriLower) ||
    /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(fileLower) ||
    /^data:audio\//i.test(uriLower)
  ) {
    return 'audio';
  }

  // 3. Video
  if (
    /\.(mp4|mov|m4v|webm|avi|mkv|ogv)(?:$|[?#])/i.test(uriLower) ||
    /\.(mp4|mov|m4v|webm|avi|mkv|ogv)$/i.test(fileLower) ||
    /^data:video\//i.test(uriLower)
  ) {
    return 'video';
  }

  // 4. PDF
  if (
    /\.pdf(?:$|[?#])/i.test(uriLower) ||
    /\.pdf$/i.test(fileLower) ||
    /^data:application\/pdf/i.test(uriLower)
  ) {
    return 'pdf';
  }

  // 5. Office Documents
  if (
    /\.(docx?|pptx?|xlsx?|rtf|odt|ods|odp)(?:$|[?#])/i.test(uriLower) ||
    /\.(docx?|pptx?|xlsx?|rtf|odt|ods|odp)$/i.test(fileLower)
  ) {
    return 'document';
  }

  // 6. Image
  if (
    /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)(?:$|[?#])/i.test(uriLower) ||
    /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i.test(fileLower) ||
    /images\.unsplash\.com/i.test(uriLower) ||
    /^data:image\//i.test(uriLower) ||
    /(?:auto|format)=(?:jpg|jpeg|png|webp|avif)/i.test(uriLower) ||
    /\/images?\//i.test(uriLower) ||
    /\b(photo|image|picture|graphic|wallpaper)\b/i.test(uriLower) ||
    /\b(photo|image|diagram|chart|infographic|picture)\b/i.test(fileLower)
  ) {
    return 'image';
  }

  return 'document';
}

interface UniversalFileViewerProps {
  uri?: string;
  mediaUrl?: string;
  title?: string;
  fileName?: string;
  textContent?: string;
  accentColor?: string;
  bgColor?: string;
  height?: number;
}

export default function UniversalFileViewer({
  uri,
  mediaUrl,
  title,
  fileName,
  textContent,
  accentColor = '#2D5DC9',
  bgColor = '#D6EAFF',
  height = 320,
}: UniversalFileViewerProps) {
  const effectiveUri = uri || mediaUrl || '';
  const [loadedText, setLoadedText] = useState<string>(textContent || '');
  const [loadingText, setLoadingText] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const category = detectFileCategory(effectiveUri, fileName);

  useEffect(() => {
    if ((category === 'text' || category === 'html' || category === 'mermaid') && !textContent && effectiveUri && effectiveUri.startsWith('http')) {
      setLoadingText(true);
      fetch(effectiveUri)
        .then((res) => res.text())
        .then((txt) => {
          setLoadedText(txt);
          setLoadingText(false);
        })
        .catch(() => {
          setLoadingText(false);
        });
    } else if (textContent) {
      setLoadedText(textContent);
    }
  }, [effectiveUri, textContent, category]);

  if (!effectiveUri && !textContent) {
    return (
      <View style={[styles.placeholder, { minHeight: height }]}>
        <View style={styles.placeholderIconBox}>
          <FileText size={28} color="#94A3B8" />
        </View>
        <Text style={styles.placeholderTitle}>File Stage Ready</Text>
        <Text style={styles.placeholderSub}>Upload an image, video, PDF, document, or text file to preview</Text>
      </View>
    );
  }

  // 1. Image
  if (category === 'image' && effectiveUri) {
    return (
      <View style={styles.imageCard}>
        <Pressable
          style={styles.imagePressable}
          onPress={() => setLightboxVisible(true)}
          accessibilityLabel="Expand image view"
        >
          <Image
            source={{ uri: effectiveUri }}
            style={[styles.image, { height }]}
            resizeMode="contain"
          />
          <View style={styles.expandBadge}>
            <Maximize2 size={13} color="#FFFFFF" />
            <Text style={styles.expandBadgeText}>Expand</Text>
          </View>
        </Pressable>

        <ImageLightboxModal
          visible={lightboxVisible}
          imageUrl={effectiveUri}
          title={title || fileName || 'Image View'}
          onClose={() => setLightboxVisible(false)}
        />
      </View>
    );
  }

  // 2. Video
  if (category === 'video' && effectiveUri) {
    return (
      <View style={[styles.videoContainer, { height }]}>
        {Platform.OS === 'web' ? (
          <video
            src={effectiveUri}
            controls
            style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'contain' }}
          />
        ) : (
          <Video
            source={{ uri: effectiveUri }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </View>
    );
  }

  // 3. Audio
  if (category === 'audio' && effectiveUri) {
    return (
      <View style={styles.wrap}>
        <AudioPlayer
          uri={effectiveUri}
          title={title || fileName || 'Audio Track'}
          subtitle="Uploaded Audio"
          accentColor={accentColor}
          bgColor={bgColor}
        />
      </View>
    );
  }

  // 4. Text / Markdown files
  if (category === 'text') {
    const isMd = (fileName || effectiveUri).toLowerCase().includes('.md');
    return (
      <View style={styles.textCard}>
        <View style={styles.textHeader}>
          <View style={styles.textHeaderLeft}>
            <FileCode size={16} color="#2563EB" />
            <Text style={styles.textHeaderTitle}>
              {fileName || title || (isMd ? 'Markdown Document' : 'Text File')}
            </Text>
          </View>
          {effectiveUri ? (
            <Pressable
              style={styles.downloadIconBtn}
              onPress={() => Linking.openURL(effectiveUri).catch(() => {})}
            >
              <Download size={14} color="#2563EB" />
              <Text style={styles.downloadIconBtnText}>Download</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.textContentBox}>
          {loadingText ? (
            <Text style={styles.loadingText}>Loading document contents…</Text>
          ) : (
            <RichTextRenderer
              content={loadedText || 'No text content available.'}
              format={isMd ? 'markdown' : 'auto'}
            />
          )}
        </View>
      </View>
    );
  }

  // 5. HTML Web Page / Interactive App
  if (category === 'html') {
    return (
      <View style={styles.textCard}>
        <View style={styles.textHeader}>
          <View style={styles.textHeaderLeft}>
            <FileCode size={16} color="#2563EB" />
            <Text style={styles.textHeaderTitle}>
              {fileName || title || 'Interactive HTML Document'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {effectiveUri ? (
              <Pressable
                style={styles.downloadIconBtn}
                onPress={() => Linking.openURL(effectiveUri).catch(() => {})}
              >
                <ExternalLink size={14} color="#2563EB" />
                <Text style={styles.downloadIconBtnText}>Open</Text>
              </Pressable>
            ) : null}
            {effectiveUri ? (
              <Pressable
                style={styles.downloadIconBtn}
                onPress={() => Linking.openURL(effectiveUri).catch(() => {})}
              >
                <Download size={14} color="#2563EB" />
                <Text style={styles.downloadIconBtnText}>Download</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ width: '100%', height: Math.max(height, 650), borderRadius: 12, overflow: 'hidden' }}>
          {Platform.OS === 'web' ? (
            <iframe
              src={effectiveUri || undefined}
              srcDoc={!effectiveUri && (loadedText || textContent) ? (loadedText || textContent) : undefined}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={title || fileName || 'HTML Preview'}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <WebView
              source={effectiveUri ? { uri: effectiveUri } : { html: loadedText || textContent || '' }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
            />
          )}
        </View>
      </View>
    );
  }

  // 6. Mermaid Diagrams
  if (category === 'mermaid') {
    return (
      <View style={styles.wrap}>
        <MermaidViewer
          code={loadedText || textContent || ''}
          title={fileName || title || 'Mermaid Diagram'}
          height={Math.max(height, 420)}
        />
      </View>
    );
  }

  // 7. PDF & Documents (Word, Excel, PowerPoint)
  return (
    <View style={styles.wrap}>
      <DocumentViewer
        uri={effectiveUri}
        title={title || fileName || 'Document'}
        accentColor={accentColor}
        bgColor={bgColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  imageCard: {
    width: '100%',
    position: 'relative',
  },
  imagePressable: {
    width: '100%',
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  expandBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    zIndex: 5,
  },
  expandBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  image: {
    width: '100%',
    maxHeight: 440,
    borderRadius: 12,
  },
  videoContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  placeholder: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  placeholderIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  placeholderSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  textCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  textHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  textHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  textHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  downloadIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  downloadIconBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  textContentBox: {
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
});

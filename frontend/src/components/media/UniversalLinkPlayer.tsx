import React, { useState } from 'react';
import { Linking, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';
import { WebView } from 'react-native-webview';
import { Check, Copy, ExternalLink, Globe, Play, Sparkles, Video as VideoIcon } from 'lucide-react-native';
import { parseLink } from '../../utils/linkPreviewUtils';
import AudioPlayer from './AudioPlayer';

interface UniversalLinkPlayerProps {
  url: string;
  title?: string;
  height?: number;
  accentColor?: string;
  showBadge?: boolean;
  fillContainer?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function UniversalLinkPlayer({
  url,
  title,
  height,
  accentColor = '#0284C7',
  showBadge = true,
  fillContainer = false,
  style,
}: UniversalLinkPlayerProps) {
  const [copied, setCopied] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const effectiveHeight = typeof height === 'number' ? height : Math.round((Math.min(windowWidth, 900) - 32) * (9 / 16));

  if (!url || typeof url !== 'string' || !url.trim()) {
    return (
      <View style={[styles.placeholder, fillContainer ? styles.fillContainer : { minHeight: effectiveHeight }, style]}>
        <View style={styles.placeholderIconBox}>
          <VideoIcon size={28} color="#94A3B8" />
        </View>
        <Text style={styles.placeholderTitle}>Link Stage Ready</Text>
        <Text style={styles.placeholderSub}>Enter any video, embed, or web link to preview</Text>
      </View>
    );
  }

  const meta = parseLink(url);

  const handleOpenExternal = () => {
    const target = meta.rawUrl.startsWith('http') ? meta.rawUrl : `https://${meta.rawUrl}`;
    Linking.openURL(target).catch(() => {});
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(meta.rawUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Render YouTube
  if (meta.type === 'youtube' && meta.videoId) {
    return (
      <View style={[fillContainer ? styles.fillContainer : styles.container, style]}>
        {showBadge && (
          <View style={styles.topInfoBar}>
            <View style={[styles.sourceBadge, { backgroundColor: '#FEE2E2' }]}>
              <Play size={11} color="#DC2626" fill="#DC2626" />
              <Text style={[styles.sourceBadgeText, { color: '#DC2626' }]}>YouTube Video</Text>
            </View>
            <Pressable style={styles.inlineLinkBtn} onPress={handleOpenExternal}>
              <ExternalLink size={12} color="#64748B" />
              <Text style={styles.inlineLinkText}>Open</Text>
            </Pressable>
          </View>
        )}
        <View style={[styles.playerBox, fillContainer ? styles.fillBox : { height: effectiveHeight }]}>
          {Platform.OS === 'web' ? (
            <iframe
              src={meta.embedUrl || `https://www.youtube.com/embed/${meta.videoId}?rel=0&controls=1`}
              style={{ width: '100%', height: '100%', border: 'none' } as any}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={title || 'YouTube Video'}
            />
          ) : (
            <YoutubePlayer height={effectiveHeight} videoId={meta.videoId} />
          )}
        </View>
      </View>
    );
  }

  // Render Direct Video Stream (.mp4, .webm, etc.)
  if (meta.type === 'direct_video') {
    return (
      <View style={[fillContainer ? styles.fillContainer : styles.container, style]}>
        {showBadge && (
          <View style={styles.topInfoBar}>
            <View style={[styles.sourceBadge, { backgroundColor: '#E0F2FE' }]}>
              <VideoIcon size={12} color="#0284C7" />
              <Text style={[styles.sourceBadgeText, { color: '#0284C7' }]}>Direct Video Stream</Text>
            </View>
            <Pressable style={styles.inlineLinkBtn} onPress={handleOpenExternal}>
              <ExternalLink size={12} color="#64748B" />
              <Text style={styles.inlineLinkText}>Open Stream</Text>
            </Pressable>
          </View>
        )}
        <View style={[styles.playerBox, fillContainer ? styles.fillBox : { height: effectiveHeight }, { backgroundColor: '#000000' }]}>
          {Platform.OS === 'web' ? (
            <video
              src={meta.rawUrl}
              controls
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Video
              source={{ uri: meta.rawUrl }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </View>
      </View>
    );
  }

  // Render Direct Audio Stream
  if (meta.type === 'direct_audio') {
    return (
      <View style={[styles.container, style]}>
        <AudioPlayer
          uri={meta.rawUrl}
          title={title || 'Audio Lesson'}
          subtitle={meta.domain}
          accentColor="#0284C7"
          bgColor="#E0F2FE"
        />
      </View>
    );
  }

  // Render Vimeo / Loom / Dailymotion / Instagram Embeds
  if (['vimeo', 'loom', 'dailymotion', 'instagram'].includes(meta.type) && meta.embedUrl) {
    return (
      <View style={[fillContainer ? styles.fillContainer : styles.container, style]}>
        {showBadge && (
          <View style={styles.topInfoBar}>
            <View style={[styles.sourceBadge, { backgroundColor: '#F3E8FF' }]}>
              <Sparkles size={11} color="#7C3AED" />
              <Text style={[styles.sourceBadgeText, { color: '#7C3AED' }]}>{meta.label}</Text>
            </View>
            <Pressable style={styles.inlineLinkBtn} onPress={handleOpenExternal}>
              <ExternalLink size={12} color="#64748B" />
              <Text style={styles.inlineLinkText}>View Source</Text>
            </Pressable>
          </View>
        )}
        <View style={[styles.playerBox, fillContainer ? styles.fillBox : { height: effectiveHeight }, { backgroundColor: '#0A0A10' }]}>
          {Platform.OS === 'web' ? (
            <iframe
              src={meta.embedUrl}
              style={{ width: '100%', height: '100%', border: 'none' } as any}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={title || meta.label}
            />
          ) : (
            <WebView
              source={{ uri: meta.embedUrl }}
              style={{ width: '100%', height: '100%' }}
              allowsFullscreenVideo
              javaScriptEnabled
            />
          )}
        </View>
      </View>
    );
  }

  // Fallback for Generic Web Links: Rich Interactive Link Card
  return (
    <View style={styles.container}>
      <View style={styles.webLinkCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.domainBadge}>
            <Globe size={13} color="#0284C7" />
            <Text style={styles.domainText}>{meta.domain}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.copyBtn} onPress={handleCopyLink}>
              {copied ? <Check size={13} color="#16A34A" /> : <Copy size={13} color="#64748B" />}
              <Text style={[styles.copyBtnText, copied && { color: '#16A34A' }]}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.linkTitle} numberOfLines={2}>
            {title || `Resource from ${meta.domain}`}
          </Text>
          <Text style={styles.linkUrlText} numberOfLines={1}>
            {meta.rawUrl}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <Pressable
            style={[styles.primaryActionBtn, { backgroundColor: accentColor }]}
            onPress={handleOpenExternal}
          >
            <ExternalLink size={15} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.primaryActionBtnText}>Open External Link</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
  },
  fillContainer: {
    width: '100%',
    height: '100%',
    flex: 1,
    overflow: 'hidden',
  },
  fillBox: {
    width: '100%',
    height: '100%',
    flex: 1,
    borderRadius: 0,
    backgroundColor: '#0F172A',
  },
  topInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inlineLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  inlineLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  playerBox: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
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
  webLinkCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    shadowColor: '#1A1D3A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  domainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  domainText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  cardBody: {
    gap: 4,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  linkUrlText: {
    fontSize: 12,
    color: '#64748B',
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

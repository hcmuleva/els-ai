import React, { useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Download, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react-native';
import { API_BASE_URL } from '../../context/AuthContext';

export interface ImageLightboxModalProps {
  visible: boolean;
  imageUrl?: string;
  title?: string;
  onClose: () => void;
}

export const resolveMediaUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/assets') || url.startsWith('./assets') || url.startsWith('assets/')) {
    const cleanUrl = url.startsWith('./') ? url.slice(1) : url.startsWith('assets/') ? `/${url}` : url;
    const frontendBaseUrl = (API_BASE_URL || '').replace(/\/api\/?$/, '');
    return `${frontendBaseUrl}${cleanUrl}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL || ''}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function ImageLightboxModal({
  visible,
  imageUrl,
  title = 'Image Preview',
  onClose,
}: ImageLightboxModalProps) {
  const [scale, setScale] = useState(1);
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  if (!visible || !imageUrl) return null;

  const resolvedUrl = resolveMediaUrl(imageUrl);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  const handleDownload = () => {
    if (resolvedUrl) {
      if (Platform.OS === 'web' && typeof globalThis.open === 'function') {
        globalThis.open(resolvedUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      Linking.openURL(resolvedUrl).catch(() => {});
    }
  };

  const stageWidth = Math.max(winWidth - 32, 280);
  const stageHeight = Math.max(winHeight - 130, 280);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Top Action Bar */}
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Maximize2 size={18} color="#94A3B8" />
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <View style={styles.controlsWrap}>
            {/* Zoom Out */}
            <Pressable
              style={styles.iconBtn}
              onPress={handleZoomOut}
              accessibilityLabel="Zoom out"
            >
              <ZoomOut size={18} color="#F8FAFC" />
            </Pressable>

            {/* Reset Zoom Indicator */}
            <Pressable
              style={styles.scaleBadge}
              onPress={handleResetZoom}
              accessibilityLabel="Reset zoom"
            >
              <Text style={styles.scaleBadgeText}>{Math.round(scale * 100)}%</Text>
            </Pressable>

            {/* Zoom In */}
            <Pressable
              style={styles.iconBtn}
              onPress={handleZoomIn}
              accessibilityLabel="Zoom in"
            >
              <ZoomIn size={18} color="#F8FAFC" />
            </Pressable>

            {/* Download / Open */}
            <Pressable
              style={styles.iconBtn}
              onPress={handleDownload}
              accessibilityLabel="Open original image"
            >
              <Download size={18} color="#F8FAFC" />
            </Pressable>

            {/* Close */}
            <Pressable
              style={[styles.iconBtn, styles.closeBtn]}
              onPress={onClose}
              accessibilityLabel="Close preview"
            >
              <X size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Center Image Stage */}
        <View style={styles.imageStage}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={3}
            minimumZoomScale={0.5}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
          >
            {Platform.OS === 'web' ? (
              <img
                src={resolvedUrl}
                alt={title}
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: stageWidth,
                  maxHeight: stageHeight,
                  objectFit: 'contain',
                  transform: `scale(${scale})`,
                  transition: 'transform 0.15s ease-out',
                }}
              />
            ) : (
              <Image
                source={{ uri: resolvedUrl }}
                style={{
                  width: stageWidth,
                  height: stageHeight,
                  transform: [{ scale }],
                }}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>

        {/* Bottom Helper Bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.bottomHint}>
            Use zoom controls or scroll to inspect details • Click X to exit
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any)
      : {}),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 16,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    flex: 1,
  },
  controlsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  closeBtn: {
    backgroundColor: '#EF4444',
  },
  scaleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  scaleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  imageStage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomHint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  PanResponder,
  PanResponderGestureState,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { X, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react-native';
import { Colors } from '../../theme';

interface ImageCropModalProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

const CROP_SIZE = 260; // Size of circular viewport box
const OUTPUT_SIZE = 512; // High-res output dimensions

export function ImageCropModal({
  visible,
  imageUri,
  onClose,
  onCropComplete,
}: ImageCropModalProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  // Keep refs for pan responder
  const offsetRef = useRef({ x: 0, y: 0 });
  offsetRef.current = offset;
  const startOffsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  scaleRef.current = scale;
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image dimensions
  useEffect(() => {
    if (!imageUri || !visible) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const img = new (window as any).Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;
        setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = imageUri;
    } else {
      // In native environments, measure or default
      setImgDimensions({ width: CROP_SIZE, height: CROP_SIZE });
    }
  }, [imageUri, visible]);

  // Pan responder for dragging the image
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startOffsetRef.current = { ...offsetRef.current };
      },
      onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
        setOffset({
          x: startOffsetRef.current.x + gestureState.dx,
          y: startOffsetRef.current.y + gestureState.dy,
        });
      },
    })
  ).current;

  const handleZoomChange = (delta: number) => {
    setScale((prev) => {
      const next = Math.min(Math.max(1, prev + delta), 3.5);
      return Number(next.toFixed(2));
    });
  };

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleCrop = useCallback(() => {
    if (processing) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        setProcessing(true);
        const img = imgRef.current;
        if (!img || !imgDimensions) {
          // If no image element, return original
          onCropComplete(imageUri);
          return;
        }

        const canvas = (window as any).document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onCropComplete(imageUri);
          return;
        }

        // Calculate aspect ratios & scaling
        const { width: nw, height: nh } = imgDimensions;
        // Fitting the image into CROP_SIZE viewport with object-fit: cover
        const imgAspect = nw / nh;
        let baseW = CROP_SIZE;
        let baseH = CROP_SIZE;
        if (imgAspect > 1) {
          baseW = CROP_SIZE * imgAspect;
        } else {
          baseH = CROP_SIZE / imgAspect;
        }

        const currentW = baseW * scale;
        const currentH = baseH * scale;

        // Image position in viewport
        const imgLeft = (CROP_SIZE - currentW) / 2 + offset.x;
        const imgTop = (CROP_SIZE - currentH) / 2 + offset.y;

        // Map viewport coordinate (0, 0, CROP_SIZE, CROP_SIZE) to natural image coordinates
        const scaleFactorX = nw / currentW;
        const scaleFactorY = nh / currentH;

        const sourceX = Math.max(0, -imgLeft * scaleFactorX);
        const sourceY = Math.max(0, -imgTop * scaleFactorY);
        const sourceW = Math.min(nw, CROP_SIZE * scaleFactorX);
        const sourceH = Math.min(nh, CROP_SIZE * scaleFactorY);

        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setProcessing(false);
        onCropComplete(dataUrl);
      } catch (err) {
        console.error('Failed to crop image on canvas:', err);
        setProcessing(false);
        onCropComplete(imageUri);
      }
    } else {
      // For mobile native, cropped URI from launchImageLibrary is already cropped
      onCropComplete(imageUri);
    }
  }, [processing, imgDimensions, scale, offset, imageUri, onCropComplete]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Crop Profile Photo</Text>
              <Text style={styles.subtitle}>Drag to reposition and zoom to fit</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color="#64748B" />
            </Pressable>
          </View>

          {/* Viewport Box */}
          <View style={styles.cropContainer}>
            <View style={styles.cropWindow} {...panResponder.panHandlers}>
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: imageUri }}
                  style={[
                    styles.cropImage,
                    {
                      transform: [
                        { translateX: offset.x },
                        { translateY: offset.y },
                        { scale: scale },
                      ],
                    },
                  ]}
                  resizeMode="cover"
                />
              </View>

              {/* Circular Overlay Mask */}
              <View pointerEvents="none" style={styles.circleOverlay} />
            </View>
          </View>

          {/* Zoom & Adjustment Controls */}
          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => handleZoomChange(-0.2)}
              style={styles.toolBtn}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
            >
              <ZoomOut size={18} color="#475569" />
            </Pressable>

            <View style={styles.zoomBadge}>
              <Text style={styles.zoomBadgeText}>{Math.round(scale * 100)}%</Text>
            </View>

            <Pressable
              onPress={() => handleZoomChange(0.2)}
              style={styles.toolBtn}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
            >
              <ZoomIn size={18} color="#475569" />
            </Pressable>

            <Pressable
              onPress={handleReset}
              style={[styles.toolBtn, { marginLeft: 16 }]}
              accessibilityRole="button"
              accessibilityLabel="Reset zoom and position"
            >
              <RotateCcw size={18} color="#475569" />
            </Pressable>
          </View>

          {/* Action Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              disabled={processing}
              style={styles.cancelBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleCrop}
              disabled={processing}
              style={styles.applyBtn}
              accessibilityRole="button"
              accessibilityLabel="Apply and crop"
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Check size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.applyBtnText}>Apply Photo</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  cropWindow: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropImage: {
    width: CROP_SIZE,
    height: CROP_SIZE,
  },
  circleOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CROP_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 22,
  },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    marginHorizontal: 10,
  },
  zoomBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  applyBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

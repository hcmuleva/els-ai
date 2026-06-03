import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Image } from 'react-native';
import { X, File as FileIcon, Image as ImageIcon, Video, Music, UploadCloud } from 'lucide-react-native';
import { PickedFile, pickFileAsDataUrl, resolveMediaType } from '../../utils/fileUpload';
import { API_BASE_URL } from '../../context/AuthContext';
import { getStorageItem } from '../../utils/storage';

export type MediaUploaderProps = {
  accept?: string;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  value: string | null;
  fileName?: string | null;
  onUploadSuccess: (url: string, fileName: string, kind: 'image' | 'audio' | 'video' | 'document') => void;
  onClear: () => void;
  buttonLabel?: string;
  unsupportedMessage?: string;
  thumbnailUrl?: string;
  onPlayPreview?: () => void;
};

export default function MediaUploader({
  accept = '*/*',
  mediaType = 'document',
  value,
  fileName,
  onUploadSuccess,
  onClear,
  buttonLabel = 'Upload file',
  unsupportedMessage = 'File upload is currently supported on web.',
  thumbnailUrl,
  onPlayPreview,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const getIcon = () => {
    if (mediaType === 'image') return <ImageIcon size={20} color="#4B5563" />;
    if (mediaType === 'video') return <Video size={20} color="#4B5563" />;
    if (mediaType === 'audio') return <Music size={20} color="#4B5563" />;
    return <FileIcon size={20} color="#4B5563" />;
  };

  const handlePickAndUpload = async () => {
    try {
      setError(null);
      const picked = await pickFileAsDataUrl(accept, unsupportedMessage);
      
      setUploading(true);
      setProgress(0);
      
      const token = await getStorageItem('accessToken');
      
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      
      xhr.open('POST', `${API_BASE_URL}/assets/upload`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      let simulatedProgress = 0;
      const progressInterval = setInterval(() => {
        if (simulatedProgress < 90) {
          simulatedProgress += 5;
          setProgress(simulatedProgress);
        }
      }, 250);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const realProgress = Math.round((event.loaded / event.total) * 100);
          if (realProgress > simulatedProgress) {
            simulatedProgress = realProgress;
            setProgress(simulatedProgress);
          }
        }
      };
      
      xhr.onload = () => {
        clearInterval(progressInterval);
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          try {
            const payload = JSON.parse(xhr.responseText);
            onUploadSuccess(payload.url || payload.canonicalUrl || '', picked.fileName, resolveMediaType(picked));
            setUploading(false);
          } catch (e) {
            setError('Failed to parse response');
            setUploading(false);
          }
        } else {
          setError('Upload failed: ' + xhr.statusText);
          setUploading(false);
        }
      };
      
      xhr.onerror = () => {
        clearInterval(progressInterval);
        setError('Network error during upload');
        setUploading(false);
      };
      
      xhr.onabort = () => {
        clearInterval(progressInterval);
        setError(null); // Silent abort
        setUploading(false);
      };
      
      const requestBody = JSON.stringify({
        dataUrl: picked.dataUrl,
        fileName: picked.fileName,
        mimeType: picked.mimeType,
        mediaType: resolveMediaType(picked),
      });
      
      xhr.send(requestBody);
      
    } catch (err: any) {
      if (err?.message === 'UPLOAD_CANCELLED') return;
      setError(err?.message || 'Failed to select file');
      setUploading(false);
    }
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploading(false);
    setProgress(0);
  };

  const clearFile = () => {
    cancelUpload();
    onClear();
  };

  if (uploading) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.uploadBtn} disabled>
          <Text style={[styles.uploadBtnText, { color: '#6B7280' }]}>Uploading... {progress}%</Text>
        </Pressable>
      </View>
    );
  }

  if (value) {
    return (
      <View style={styles.container}>
        <View style={styles.mediaPreviewRow}>
          <View style={styles.badge}>
            {thumbnailUrl ? (
              <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
            ) : (
              getIcon()
            )}
            <View style={styles.badgeInfo}>
              <Text style={styles.badgeTitle} numberOfLines={1}>{fileName || value.split('/').pop() || 'Uploaded File'}</Text>
              <Text style={styles.badgeSubtitle}>{mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}</Text>
            </View>
          </View>
          {onPlayPreview && (
            <Pressable onPress={onPlayPreview} style={styles.playBtn}>
              <Text style={styles.playBtnText}>▶ Play</Text>
            </Pressable>
          )}
          <Pressable onPress={clearFile} style={styles.mediaRemoveBtn}>
            <Text style={styles.mediaRemoveBtnText}>✕ Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.uploadBtn} onPress={handlePickAndUpload}>
        <Text style={styles.uploadBtnText}>⬆ {buttonLabel}</Text>
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  uploadBtn: { borderRadius: 10, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 12, alignItems: 'center', borderStyle: 'dashed' },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: '#4A90E2' },
  mediaPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F9FF', borderRadius: 12, borderWidth: 1, borderColor: '#ECEEF4', padding: 10 },
  badgeInfo: { flex: 1, gap: 4 },
  badgeTitle: { fontSize: 13, fontWeight: '600', color: '#374151' },
  badgeSubtitle: { fontSize: 11, color: '#6B7280' },
  thumbnail: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#ECEEF4' },
  playBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' },
  playBtnText: { fontSize: 12, fontWeight: '800', color: '#0284C7' },
  mediaRemoveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFE8E8', justifyContent: 'center', alignItems: 'center' },
  mediaRemoveBtnText: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 12, marginTop: 4 },
});

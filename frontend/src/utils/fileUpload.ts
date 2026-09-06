import { Platform } from 'react-native';
import { API_BASE_URL } from '../context/AuthContext';
import { getStorageItem } from './storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export type PickedFile = { dataUrl: string; fileName: string; mimeType: string };

export async function pickFileAsDataUrl(accept: string, unsupportedMessage = 'File upload is currently supported on web.'): Promise<PickedFile> {
  if (Platform.OS !== 'web') {
    const isImage = accept.includes('image');
    const isVideo = accept.includes('video');
    const isMedia = isImage || isVideo;

    if (isMedia) {
      let mediaTypes: ImagePicker.MediaTypeOptions = ImagePicker.MediaTypeOptions.All;
      if (isImage && !isVideo) {
        mediaTypes = ImagePicker.MediaTypeOptions.Images;
      } else if (isVideo && !isImage) {
        mediaTypes = ImagePicker.MediaTypeOptions.Videos;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        throw new Error('UPLOAD_CANCELLED');
      }

      const asset = result.assets[0];
      const mimeType = asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
      let dataUrl = '';
      if (asset.base64) {
        dataUrl = `data:${mimeType};base64,${asset.base64}`;
      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        dataUrl = `data:${mimeType};base64,${base64}`;
      }

      return {
        dataUrl,
        fileName: asset.fileName || asset.uri.split('/').pop() || 'uploaded-media',
        mimeType,
      };
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: accept === '*/*' ? '*/*' : accept,
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        throw new Error('UPLOAD_CANCELLED');
      }
      
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const mimeType = asset.mimeType || 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      return {
        dataUrl,
        fileName: asset.name || 'uploaded-file',
        mimeType,
      };
    }
  }

  return await new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc) {
      reject(new Error('File picker is unavailable in this environment.'));
      return;
    }
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;
    
    input.addEventListener('cancel', () => {
      reject(new Error('UPLOAD_CANCELLED'));
    });

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('UPLOAD_CANCELLED'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          dataUrl: String(reader.result || ''),
          fileName: file.name || 'uploaded-file',
          mimeType: file.type || '',
        });
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export function resolveMediaType(file: PickedFile): 'image' | 'audio' | 'video' | 'document' {
  const mime = file.mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  const fileName = file.fileName.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(fileName)) return 'image';
  if (/\.(mp3|wav|ogg|aac|m4a|flac)$/.test(fileName)) return 'audio';
  if (/\.(mp4|mov|avi|wmv|flv|mkv)$/.test(fileName)) return 'video';
  return 'document';
}

export async function uploadPickedFileToS3(
  picked: PickedFile,
  mediaType: 'image' | 'audio' | 'video' | 'document',
  context: string = 'media_upload',
  onProgress?: (pct: number) => void
): Promise<{ url: string; canonicalUrl: string; assetId: string; fileName: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await getStorageItem('accessToken');
      const xhr = new XMLHttpRequest();
      
      let simulatedProgress = 0;
      const progressInterval = setInterval(() => {
        if (simulatedProgress < 90) {
          simulatedProgress += 5;
          if (onProgress) onProgress(simulatedProgress);
        }
      }, 250);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const realProgress = Math.round((event.loaded / event.total) * 100);
          if (realProgress > simulatedProgress) {
            simulatedProgress = realProgress;
            onProgress(simulatedProgress);
          }
        }
      };

      xhr.open('POST', `${API_BASE_URL}/assets/upload`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onload = () => {
        clearInterval(progressInterval);
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          try {
            const payload = JSON.parse(xhr.responseText);
            resolve({
              url: String(payload.url || ''),
              canonicalUrl: String(payload.canonicalUrl || ''),
              assetId: String(payload.assetId || ''),
              fileName: String(payload.fileName || picked.fileName || 'uploaded-file'),
            });
          } catch (e) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error('Upload failed: ' + xhr.statusText));
        }
      };

      xhr.onerror = () => {
        clearInterval(progressInterval);
        reject(new Error('Network error during upload'));
      };
      
      xhr.onabort = () => {
        clearInterval(progressInterval);
        reject(new Error('UPLOAD_CANCELLED'));
      };

      xhr.send(JSON.stringify({
        dataUrl: picked.dataUrl,
        fileName: picked.fileName,
        mimeType: picked.mimeType,
        mediaType,
        context,
      }));
    } catch (err) {
      reject(err);
    }
  });
}

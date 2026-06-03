import { Platform } from 'react-native';
import { API_BASE_URL } from '../context/AuthContext';
import { getStorageItem } from './storage';

export type PickedFile = { dataUrl: string; fileName: string; mimeType: string };

export async function pickFileAsDataUrl(accept: string, unsupportedMessage = 'File upload is currently supported on web.'): Promise<PickedFile> {
  if (Platform.OS !== 'web') {
    throw new Error(unsupportedMessage);
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

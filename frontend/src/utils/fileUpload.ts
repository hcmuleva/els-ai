import { Platform } from 'react-native';
import { API_BASE_URL } from '../context/AuthContext';
import { getStorageItem } from './storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export const ALL_SUPPORTED_FILE_TYPES =
  'image/*,video/*,audio/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.html,.htm,.mmd,.mermaid,text/*';

export type PickedFile = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  textContent?: string;
};

export async function pickFileAsDataUrl(accept: string = ALL_SUPPORTED_FILE_TYPES, unsupportedMessage = 'File upload is currently supported on web.'): Promise<PickedFile> {
  if (Platform.OS !== 'web') {
    const isImage = accept.includes('image');
    const isVideo = accept.includes('video');
    const isOnlyMedia = (isImage || isVideo) && !accept.includes('pdf') && !accept.includes('doc') && !accept.includes('text') && !accept.includes('*/*');

    if (isOnlyMedia) {
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
          encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
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
        type: accept === '*/*' || accept.includes('image/*,video/*') ? '*/*' : accept,
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        throw new Error('UPLOAD_CANCELLED');
      }
      
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
      });
      
      const mimeType = asset.mimeType || 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      let textContent: string | undefined = undefined;
      const lowerName = (asset.name || '').toLowerCase();
      if (
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.html') ||
        lowerName.endsWith('.htm') ||
        lowerName.endsWith('.mmd') ||
        lowerName.endsWith('.mermaid')
      ) {
        try {
          textContent = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8',
          });
        } catch {
          // ignore error
        }
      }

      return {
        dataUrl,
        fileName: asset.name || 'uploaded-file',
        mimeType,
        textContent,
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
    
    let resolved = false;

    const cleanup = () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onWindowFocus);
      }
    };

    const onCancel = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error('UPLOAD_CANCELLED'));
    };

    const onWindowFocus = () => {
      // When file dialog closes on Cancel, the window regains focus.
      // Give onchange 400ms to fire if a file was selected.
      setTimeout(() => {
        if (!resolved) {
          if (!input.files || input.files.length === 0) {
            onCancel();
          }
        }
      }, 400);
    };

    input.addEventListener('cancel', onCancel);
    input.oncancel = onCancel;
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onWindowFocus, { once: true });
    }

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        onCancel();
        return;
      }
      resolved = true;
      cleanup();
      const reader = new FileReader();
      const lowerName = file.name.toLowerCase();
      const isTextFile =
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.html') ||
        lowerName.endsWith('.htm') ||
        lowerName.endsWith('.mmd') ||
        lowerName.endsWith('.mermaid') ||
        file.type.startsWith('text/');

      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (isTextFile) {
          const textReader = new FileReader();
          textReader.onload = () => {
            resolve({
              dataUrl,
              fileName: file.name || 'uploaded-file',
              mimeType: file.type || 'text/plain',
              textContent: String(textReader.result || ''),
            });
          };
          textReader.onerror = () => {
            resolve({
              dataUrl,
              fileName: file.name || 'uploaded-file',
              mimeType: file.type || 'text/plain',
            });
          };
          textReader.readAsText(file);
        } else {
          resolve({
            dataUrl,
            fileName: file.name || 'uploaded-file',
            mimeType: file.type || '',
          });
        }
      };
      reader.onerror = () => {
        resolved = true;
        cleanup();
        reject(new Error('Failed to read selected file.'));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export function resolveMediaType(file: PickedFile): 'image' | 'audio' | 'video' | 'document' | 'text' | 'pdf' | 'html' {
  const mime = file.mimeType.toLowerCase();
  if (mime.includes('html')) return 'html';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.startsWith('text/')) return 'text';
  const fileName = file.fileName.toLowerCase();
  if (/\.(html?)$/.test(fileName)) return 'html';
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(fileName)) return 'image';
  if (/\.(mp3|wav|ogg|aac|m4a|flac)$/.test(fileName)) return 'audio';
  if (/\.(mp4|mov|avi|wmv|flv|mkv)$/.test(fileName)) return 'video';
  if (/\.pdf$/.test(fileName)) return 'pdf';
  if (/\.(txt|md|markdown|json|csv|log)$/.test(fileName)) return 'text';
  return 'document';
}

export async function uploadPickedFileToS3(
  picked: PickedFile,
  mediaType: 'image' | 'audio' | 'video' | 'document' | 'text' | 'pdf' | 'html',
  contextOrProgress?: string | ((pct: number) => void),
  maybeProgress?: (pct: number) => void
): Promise<{ url: string; canonicalUrl: string; assetId: string; fileName: string }> {
  const context = typeof contextOrProgress === 'string' ? contextOrProgress : 'media_upload';
  const onProgress = typeof contextOrProgress === 'function' ? contextOrProgress : maybeProgress;
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

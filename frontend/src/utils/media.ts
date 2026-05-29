import { API_BASE_URL } from '../context/AuthContext';

// Resolves a stored media reference to a fully-qualified URL the app can load.
// Local `/media/...` paths are served by the gateway (API_BASE_URL), NOT by the
// Metro/Expo web origin, so they must be prefixed. Production CDN URLs that are
// unreachable in dev are rewritten to a labeled placeholder.
export function resolveMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.includes('media.els-ai.in')) {
    const clean = url.split('?')[0].split('#')[0];
    const base = clean.substring(clean.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/i, '');
    const label = base.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (m) => m.toUpperCase()) || 'Image';
    return `https://placehold.co/400x400/EEF2FF/4338CA?text=${encodeURIComponent(label)}`;
  }
  if (url.startsWith('/media')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

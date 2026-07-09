import type { VideoType } from '../types/videoContent';

const YT_ID_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url || '');
}

export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(YT_ID_RE);
  return match ? match[1] : null;
}

export function getYouTubeThumb(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

export function detectVideoType(url: string): VideoType {
  return isYouTubeUrl(url) ? 'youtube' : 'uploaded';
}

// Embed URL for the IFrame Player API with JS control enabled and the segment
// bounded by start/end. The `end` param is a safety net; runtime polling drives
// the "show quiz" trigger.
export function buildEmbedUrl(
  videoId: string,
  opts: { start?: number; end?: number; autoplay?: boolean; origin?: string } = {},
): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    controls: '1',
    playsinline: '1',
  });
  if (opts.start != null) params.set('start', String(Math.floor(opts.start)));
  if (opts.end != null) params.set('end', String(Math.ceil(opts.end)));
  if (opts.autoplay) params.set('autoplay', '1');
  if (opts.origin) params.set('origin', opts.origin);
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

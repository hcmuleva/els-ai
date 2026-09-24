import { getYouTubeVideoId, isYouTubeUrl } from './youtubeUtils';

export type LinkType =
  | 'youtube'
  | 'vimeo'
  | 'loom'
  | 'dailymotion'
  | 'direct_video'
  | 'direct_audio'
  | 'instagram'
  | 'generic';

export interface LinkMeta {
  type: LinkType;
  rawUrl: string;
  embedUrl: string | null;
  videoId: string | null;
  domain: string;
  label: string;
}

const DIRECT_VIDEO_REGEX = /\.(mp4|mov|m4v|webm|ogv|mkv)(?:$|[?#])/i;
const DIRECT_AUDIO_REGEX = /\.(mp3|wav|ogg|aac|m4a|flac)(?:$|[?#])/i;
const VIMEO_REGEX = /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+))/i;
const LOOM_REGEX = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i;
const DAILYMOTION_REGEX = /(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/i;
const INSTAGRAM_REEL_REGEX = /instagram\.com\/(?:reel|reels|p)\/([a-zA-Z0-9_-]+)/i;

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

export function detectLinkType(url: string): LinkType {
  if (!url || typeof url !== 'string') return 'generic';
  const trimmed = url.trim();

  if (isYouTubeUrl(trimmed)) return 'youtube';
  if (DIRECT_VIDEO_REGEX.test(trimmed)) return 'direct_video';
  if (DIRECT_AUDIO_REGEX.test(trimmed)) return 'direct_audio';
  if (VIMEO_REGEX.test(trimmed)) return 'vimeo';
  if (LOOM_REGEX.test(trimmed)) return 'loom';
  if (DAILYMOTION_REGEX.test(trimmed)) return 'dailymotion';
  if (INSTAGRAM_REEL_REGEX.test(trimmed)) return 'instagram';

  return 'generic';
}

export function parseLink(url: string): LinkMeta {
  const trimmed = (url || '').trim();
  const type = detectLinkType(trimmed);
  const domain = extractDomain(trimmed);

  let embedUrl: string | null = null;
  let videoId: string | null = null;
  let label = 'External Link';

  switch (type) {
    case 'youtube': {
      videoId = getYouTubeVideoId(trimmed);
      embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&controls=1` : null;
      label = 'YouTube Video';
      break;
    }
    case 'vimeo': {
      const match = trimmed.match(VIMEO_REGEX);
      videoId = match ? match[3] || match[2] || match[1] || null : null;
      embedUrl = videoId ? `https://player.vimeo.com/video/${videoId}` : null;
      label = 'Vimeo Video';
      break;
    }
    case 'loom': {
      const match = trimmed.match(LOOM_REGEX);
      videoId = match ? match[1] : null;
      embedUrl = videoId ? `https://www.loom.com/embed/${videoId}` : null;
      label = 'Loom Video';
      break;
    }
    case 'dailymotion': {
      const match = trimmed.match(DAILYMOTION_REGEX);
      videoId = match ? match[1] : null;
      embedUrl = videoId ? `https://www.dailymotion.com/embed/video/${videoId}` : null;
      label = 'Dailymotion Video';
      break;
    }
    case 'instagram': {
      const match = trimmed.match(INSTAGRAM_REEL_REGEX);
      videoId = match ? match[1] : null;
      embedUrl = videoId ? `https://www.instagram.com/reel/${videoId}/embed` : null;
      label = 'Instagram Reel';
      break;
    }
    case 'direct_video': {
      embedUrl = trimmed;
      label = 'Video Stream';
      break;
    }
    case 'direct_audio': {
      embedUrl = trimmed;
      label = 'Audio Stream';
      break;
    }
    case 'generic':
    default: {
      embedUrl = trimmed;
      label = domain !== 'web' ? domain : 'External Link';
      break;
    }
  }

  return {
    type,
    rawUrl: trimmed,
    embedUrl,
    videoId,
    domain,
    label,
  };
}

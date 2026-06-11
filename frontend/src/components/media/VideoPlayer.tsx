/**
 * VideoPlayer — shared component for YouTube + S3/direct video playback.
 * Handles:
 *   - YouTube: responsive 16:9 iframe on web, YoutubePlayer on native
 *   - Direct video (S3/mp4/mov/webm): html5 <video> on web, expo-av Video on native
 * Height is always capped so native controls are never pushed off-screen.
 */
import { Dimensions, Platform, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';

const { width: W, height: H } = Dimensions.get('window');

// Max video height: the smaller of 16:9 based on width OR 50% of screen height.
// This ensures the native playback controls are always on screen.
const VIDEO_H = Math.round(Math.min(W * (9 / 16), H * 0.5));

function getYouTubeVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(?:$|[?#])/i.test(url);
}

type Props = {
  url: string;
  /** Optional accent color for the border (YouTube embed wrapper only) */
  accentColor?: string;
  /** Whether to auto-play (native only, used for in-view detection) */
  shouldPlay?: boolean;
};

export default function VideoPlayer({ url, accentColor, shouldPlay }: Props) {
  if (!url) return null;

  const youTubeId = isYouTubeUrl(url) ? getYouTubeVideoId(url) : null;

  if (youTubeId) {
    return (
      <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#0a0a0a', marginBottom: 4 }}>
        {Platform.OS === 'web' ? (
          // Padding-top 56.25% = 16:9 responsive iframe trick
          <div
            style={{
              position: 'relative',
              paddingTop: '56.25%',
              backgroundColor: '#0a0a0a',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${youTubeId}?rel=0&controls=1`}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <YoutubePlayer
            height={Math.round(W * (9 / 16))}
            videoId={youTubeId}
            webViewStyle={{ opacity: 0.99 }}
          />
        )}
      </View>
    );
  }

  if (isDirectVideoUrl(url)) {
    return (
      <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#0a0a0a', marginBottom: 4 }}>
        {Platform.OS === 'web' ? (
          // html5 video: intrinsic height, capped at 55vh so controls bar stays on screen
          <video
            src={url}
            controls
            style={{
              width: '100%',
              maxHeight: '55vh',
              minHeight: 160,
              display: 'block',
              objectFit: 'contain',
              backgroundColor: '#0a0a0a',
            }}
          />
        ) : (
          // expo-av: CONTAIN letterboxes any aspect ratio; height capped to VIDEO_H
          <Video
            source={{ uri: url }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={shouldPlay}
            style={{ width: '100%', height: VIDEO_H, backgroundColor: '#0a0a0a' }}
          />
        )}
      </View>
    );
  }

  return null;
}

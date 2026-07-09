import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';
import { detectVideoType, getYouTubeVideoId } from '../../utils/youtubeUtils';

export interface SectionPreviewHandle {
  seekTo: (t: number, autoplay?: boolean) => void;
  playSegment: (start: number, end: number) => void;
  pause: () => void;
}

interface Props {
  videoUrl: string;
  onReady?: (duration: number) => void;
  onTick?: (t: number) => void;
}

let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(w.YT);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

const WebPreview = forwardRef<SectionPreviewHandle, Props>(function WebPreview({ videoUrl, onReady, onTick }, ref) {
  const type = detectVideoType(videoUrl);
  const videoId = getYouTubeVideoId(videoUrl);
  const iframeRef = useRef<any>(null);
  const ytRef = useRef<any>(null);
  const videoElRef = useRef<any>(null);
  const pollRef = useRef<any>(null);
  const segEndRef = useRef<number | null>(null);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (type !== 'youtube' || !videoId) return undefined;
    let mounted = true;
    let durationPoll: any = null;
    // getDuration() commonly returns 0 at onReady until metadata loads, so poll
    // until we get a real value before showing the timeline slider.
    const reportDuration = () => {
      try {
        const d = Math.floor(ytRef.current?.getDuration?.() || 0);
        if (d > 0) {
          onReady?.(d);
          return true;
        }
      } catch {
        /* noop */
      }
      return false;
    };
    loadYouTubeApi()
      .then((YT) => {
        if (!mounted || !iframeRef.current) return;
        // Attach the API to our own full-size iframe so it fills the preview box
        // (passing a bare div makes YT create a fixed 640x360 iframe that clips).
        ytRef.current = new YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              if (reportDuration()) return;
              let tries = 0;
              durationPoll = setInterval(() => {
                tries += 1;
                if (reportDuration() || tries > 30) {
                  clearInterval(durationPoll);
                  durationPoll = null;
                }
              }, 400);
            },
          },
        });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      clearPoll();
      if (durationPoll) clearInterval(durationPoll);
      try {
        ytRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      ytRef.current = null;
    };
  }, [type, videoId]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (t, autoplay) => {
        if (type === 'youtube') {
          try {
            ytRef.current?.seekTo(t, true);
            if (autoplay) ytRef.current?.playVideo();
            else ytRef.current?.pauseVideo();
          } catch {
            /* noop */
          }
        } else {
          const v = videoElRef.current;
          if (v) {
            try {
              v.currentTime = t;
              if (autoplay) v.play();
              else v.pause();
            } catch {
              /* noop */
            }
          }
        }
      },
      playSegment: (start, end) => {
        segEndRef.current = end;
        clearPoll();
        if (type === 'youtube') {
          try {
            ytRef.current?.seekTo(start, true);
            ytRef.current?.playVideo();
          } catch {
            /* noop */
          }
          pollRef.current = setInterval(() => {
            try {
              const t = ytRef.current?.getCurrentTime?.() ?? 0;
              onTick?.(t);
              if (segEndRef.current != null && t >= segEndRef.current) {
                ytRef.current?.pauseVideo?.();
                clearPoll();
              }
            } catch {
              /* noop */
            }
          }, 250);
        } else {
          const v = videoElRef.current;
          if (v) {
            try {
              v.currentTime = start;
              v.play();
            } catch {
              /* noop */
            }
            pollRef.current = setInterval(() => {
              const t = v.currentTime as number;
              onTick?.(t);
              if (segEndRef.current != null && t >= segEndRef.current) {
                v.pause();
                clearPoll();
              }
            }, 250);
          }
        }
      },
      pause: () => {
        clearPoll();
        if (type === 'youtube') {
          try {
            ytRef.current?.pauseVideo?.();
          } catch {
            /* noop */
          }
        } else {
          try {
            videoElRef.current?.pause?.();
          } catch {
            /* noop */
          }
        }
      },
    }),
    [type],
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&controls=1${
        origin ? `&origin=${encodeURIComponent(origin)}` : ''
      }`
    : '';
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' }}>
      {type === 'youtube'
        ? React.createElement('iframe', {
            ref: iframeRef,
            src: embedSrc,
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowFullScreen: true,
            style: { width: '100%', height: '100%', border: 'none' },
          })
        : React.createElement('video', {
            ref: videoElRef,
            src: videoUrl,
            controls: true,
            style: { width: '100%', height: '100%' },
            onLoadedMetadata: (e: any) => onReady?.(Math.floor(e.target.duration || 0)),
          })}
    </View>
  );
});

const NativePreview = forwardRef<SectionPreviewHandle, Props>(function NativePreview({ videoUrl, onReady, onTick }, ref) {
  const type = detectVideoType(videoUrl);
  const videoId = getYouTubeVideoId(videoUrl);
  const ytRef = useRef<any>(null);
  const videoRef = useRef<Video>(null);
  const pollRef = useRef<any>(null);
  const segEndRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const width = Dimensions.get('window').width - 32;

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => clearPoll(), []);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: async (t, autoplay) => {
        if (type === 'youtube') {
          try {
            await ytRef.current?.seekTo?.(t, true);
          } catch {
            /* noop */
          }
          setPlaying(!!autoplay);
        } else {
          try {
            await videoRef.current?.setPositionAsync(t * 1000);
            if (autoplay) await videoRef.current?.playAsync();
            else await videoRef.current?.pauseAsync();
          } catch {
            /* noop */
          }
        }
      },
      playSegment: async (start, end) => {
        segEndRef.current = end;
        clearPoll();
        if (type === 'youtube') {
          try {
            await ytRef.current?.seekTo?.(start, true);
          } catch {
            /* noop */
          }
          setPlaying(true);
          pollRef.current = setInterval(async () => {
            try {
              const t = (await ytRef.current?.getCurrentTime?.()) ?? 0;
              onTick?.(t);
              if (segEndRef.current != null && t >= segEndRef.current) {
                setPlaying(false);
                clearPoll();
              }
            } catch {
              /* noop */
            }
          }, 300);
        } else {
          try {
            await videoRef.current?.setPositionAsync(start * 1000);
            await videoRef.current?.playAsync();
          } catch {
            /* noop */
          }
        }
      },
      pause: () => {
        clearPoll();
        if (type === 'youtube') setPlaying(false);
        else videoRef.current?.pauseAsync?.().catch(() => undefined);
      },
    }),
    [type],
  );

  if (type === 'youtube' && videoId) {
    return (
      <YoutubePlayer
        ref={ytRef}
        height={width * (9 / 16)}
        play={playing}
        videoId={videoId}
        onReady={async () => {
          try {
            const d = await ytRef.current?.getDuration?.();
            onReady?.(Math.floor(d || 0));
          } catch {
            /* noop */
          }
        }}
      />
    );
  }

  return (
    <Video
      ref={videoRef}
      source={{ uri: videoUrl }}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }}
      onLoad={(status: any) => {
        if (status?.durationMillis) onReady?.(Math.floor(status.durationMillis / 1000));
      }}
      onPlaybackStatusUpdate={(status: any) => {
        if (!status?.isLoaded) return;
        const t = (status.positionMillis || 0) / 1000;
        onTick?.(t);
        if (segEndRef.current != null && t >= segEndRef.current) {
          videoRef.current?.pauseAsync?.().catch(() => undefined);
          segEndRef.current = null;
        }
      }}
    />
  );
});

const SectionPreviewPlayer = forwardRef<SectionPreviewHandle, Props>(function SectionPreviewPlayer(props, ref) {
  return Platform.OS === 'web' ? <WebPreview ref={ref} {...props} /> : <NativePreview ref={ref} {...props} />;
});

export default SectionPreviewPlayer;

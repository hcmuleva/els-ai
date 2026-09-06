import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useVideoSectionPlayback } from './useVideoSectionPlayback';

export interface YouTubeSectionPlayerProps {
  videoId: string;
  startTime: number;
  endTime: number;
  // Increment to (re)start playback from startTime. 0 = idle.
  playToken: number;
  // When true, force-pause playback (e.g. while a quiz modal is open).
  paused?: boolean;
  onSectionEnd: () => void;
  onTick?: (currentTime: number) => void;
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

function WebYouTube({ videoId, startTime, endTime, playToken, paused, onSectionEnd, onTick }: YouTubeSectionPlayerProps) {
  const hostRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadYouTubeApi()
      .then((YT) => {
        if (!mounted || !hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            controls: 1,
            playsinline: 1,
            start: Math.floor(startTime),
            end: Math.ceil(endTime),
          },
          events: {
            onReady: () => setReady(true),
            onStateChange: (e: any) => setPlaying(e?.data === 1),
          },
        });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (!ready || !playerRef.current || playToken === 0) return;
    try {
      playerRef.current.seekTo(Math.floor(startTime), true);
      playerRef.current.playVideo();
      setPlaying(true);
    } catch {
      /* noop */
    }
  }, [playToken, ready, startTime]);

  useEffect(() => {
    if (!ready || !playerRef.current || !paused) return;
    try {
      playerRef.current.pauseVideo?.();
    } catch {
      /* noop */
    }
    setPlaying(false);
  }, [paused, ready]);

  const getCurrentTime = useCallback(() => {
    try {
      return playerRef.current?.getCurrentTime?.() ?? 0;
    } catch {
      return 0;
    }
  }, []);

  useVideoSectionPlayback({
    active: playing,
    endTime,
    getCurrentTime,
    onTick,
    resetKey: playToken,
    onEnd: () => {
      try {
        playerRef.current?.pauseVideo?.();
      } catch {
        /* noop */
      }
      setPlaying(false);
      onSectionEnd();
    },
  });

  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden' }}>
      {React.createElement('div', { ref: hostRef, style: { width: '100%', height: '100%' } })}
    </View>
  );
}

function NativeYouTube({ videoId, startTime, endTime, playToken, paused, onSectionEnd, onTick }: YouTubeSectionPlayerProps) {
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const width = Dimensions.get('window').width - 32;

  useEffect(() => {
    if (playToken === 0) return;
    (async () => {
      try {
        await playerRef.current?.seekTo?.(Math.floor(startTime), true);
      } catch {
        /* noop */
      }
      setPlaying(true);
    })();
  }, [playToken, startTime]);

  useEffect(() => {
    if (paused) setPlaying(false);
  }, [paused]);

  const getCurrentTime = useCallback(async () => {
    try {
      return (await playerRef.current?.getCurrentTime?.()) ?? 0;
    } catch {
      return 0;
    }
  }, []);

  useVideoSectionPlayback({
    active: playing,
    endTime,
    getCurrentTime,
    onTick,
    resetKey: playToken,
    onEnd: () => {
      setPlaying(false);
      onSectionEnd();
    },
  });

  return (
    <YoutubePlayer
      ref={playerRef}
      height={width * (9 / 16)}
      play={playing}
      videoId={videoId}
      initialPlayerParams={{ start: Math.floor(startTime), end: Math.ceil(endTime) }}
      onChangeState={(state: string) => {
        if (state === 'playing') setPlaying(true);
        if (state === 'paused' || state === 'ended') setPlaying(false);
      }}
    />
  );
}

export default function YouTubeSectionPlayer(props: YouTubeSectionPlayerProps) {
  return Platform.OS === 'web' ? <WebYouTube {...props} /> : <NativeYouTube {...props} />;
}

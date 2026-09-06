import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';

export interface UploadedVideoSectionPlayerProps {
  url: string;
  startTime: number;
  endTime: number;
  playToken: number;
  paused?: boolean;
  onSectionEnd: () => void;
  onTick?: (currentTime: number) => void;
}

function WebUploaded({ url, startTime, endTime, playToken, paused, onSectionEnd, onTick }: UploadedVideoSectionPlayerProps) {
  const ref = useRef<any>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    endedRef.current = false;
    const v = ref.current;
    if (!v || playToken === 0) return;
    try {
      v.currentTime = startTime;
      v.play();
    } catch {
      /* noop */
    }
  }, [playToken, startTime]);

  useEffect(() => {
    const v = ref.current;
    if (v && paused) {
      try {
        v.pause();
      } catch {
        /* noop */
      }
    }
  }, [paused]);

  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden' }}>
      {React.createElement('video', {
        ref,
        src: url,
        controls: true,
        style: { width: '100%', height: '100%' },
        onLoadedMetadata: (e: any) => {
          try {
            e.target.currentTime = startTime;
          } catch {
            /* noop */
          }
        },
        onTimeUpdate: (e: any) => {
          const t = e.target.currentTime as number;
          onTick?.(t);
          if (!endedRef.current && t >= endTime) {
            endedRef.current = true;
            try {
              e.target.pause();
            } catch {
              /* noop */
            }
            onSectionEnd();
          }
        },
      })}
    </View>
  );
}

function NativeUploaded({ url, startTime, endTime, playToken, paused, onSectionEnd, onTick }: UploadedVideoSectionPlayerProps) {
  const ref = useRef<Video>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    endedRef.current = false;
    if (playToken === 0) return;
    (async () => {
      try {
        await ref.current?.setPositionAsync(startTime * 1000);
        await ref.current?.playAsync();
      } catch {
        /* noop */
      }
    })();
  }, [playToken, startTime]);

  useEffect(() => {
    if (paused) ref.current?.pauseAsync?.().catch(() => undefined);
  }, [paused]);

  return (
    <Video
      ref={ref}
      source={{ uri: url }}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }}
      onPlaybackStatusUpdate={(status: any) => {
        if (!status?.isLoaded) return;
        const t = (status.positionMillis || 0) / 1000;
        onTick?.(t);
        if (!endedRef.current && t >= endTime) {
          endedRef.current = true;
          ref.current?.pauseAsync?.().catch(() => undefined);
          onSectionEnd();
        }
      }}
    />
  );
}

export default function UploadedVideoSectionPlayer(props: UploadedVideoSectionPlayerProps) {
  return Platform.OS === 'web' ? <WebUploaded {...props} /> : <NativeUploaded {...props} />;
}

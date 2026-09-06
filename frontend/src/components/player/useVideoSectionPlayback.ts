import { useEffect, useRef } from 'react';

interface Args {
  // Whether the section is currently playing and should be monitored.
  active: boolean;
  // Section end boundary in seconds.
  endTime: number;
  // Reads the player's current time (may be sync or async depending on platform).
  getCurrentTime: () => number | Promise<number>;
  // Fired exactly once when currentTime crosses endTime.
  onEnd: () => void;
  onTick?: (currentTime: number) => void;
  intervalMs?: number;
  // Bump to re-arm the one-shot end detection (e.g. on replay).
  resetKey?: number;
}

// Shared timing engine for every section player. It polls the player's current
// time and fires onEnd once when the section boundary is reached. No media is
// cut; playback is simply paused by the caller inside onEnd.
export function useVideoSectionPlayback({
  active,
  endTime,
  getCurrentTime,
  onEnd,
  onTick,
  intervalMs = 400,
  resetKey = 0,
}: Args): void {
  const endedRef = useRef(false);
  const getCurrentTimeRef = useRef(getCurrentTime);
  const onEndRef = useRef(onEnd);
  const onTickRef = useRef(onTick);
  getCurrentTimeRef.current = getCurrentTime;
  onEndRef.current = onEnd;
  onTickRef.current = onTick;

  useEffect(() => {
    endedRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const t = await getCurrentTimeRef.current();
        if (cancelled || typeof t !== 'number' || Number.isNaN(t)) return;
        onTickRef.current?.(t);
        if (!endedRef.current && t >= endTime) {
          endedRef.current = true;
          onEndRef.current();
        }
      } catch {
        // Ignore transient player errors between frames.
      }
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, endTime, intervalMs]);
}

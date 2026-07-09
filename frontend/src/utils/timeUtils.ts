// Time helpers for video sections. All internal values are integer seconds.
// Accepts three input formats: HH:MM:SS, MM:SS, or a raw seconds number.

export function parseTime(input: string | number): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? Math.floor(input) : null;
  }
  const raw = input.trim();
  if (raw === '') return null;

  if (/^\d+$/.test(raw)) {
    return parseInt(raw, 10);
  }

  const parts = raw.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p.trim()))) return null;

  const nums = parts.map((p) => parseInt(p.trim(), 10));
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (nums.length === 3) {
    [hours, minutes, seconds] = nums;
  } else {
    [minutes, seconds] = nums;
  }
  if (seconds >= 60 || minutes >= 60) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

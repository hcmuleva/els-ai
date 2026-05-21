import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

// Point to local Kokoro TTS Python server (same machine as the app dev server)
const TTS_BASE =
  (process.env.EXPO_PUBLIC_TTS_URL ?? '').length > 0
    ? process.env.EXPO_PUBLIC_TTS_URL
    : 'http://localhost:5001';

const VOICE = 'af_heart';
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

let _sound: Audio.Sound | null = null;
let _kokoroAvailable: boolean | null = null; // null = unchecked

async function checkKokoroAvailable(): Promise<boolean> {
  if (_kokoroAvailable !== null) return _kokoroAvailable;
  try {
    const res = await fetch(`${TTS_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    _kokoroAvailable = res.ok;
  } catch {
    _kokoroAvailable = false;
  }
  return _kokoroAvailable;
}

async function playUrl(url: string): Promise<void> {
  try {
    if (_sound) {
      await _sound.stopAsync().catch(() => {});
      await _sound.unloadAsync().catch(() => {});
      _sound = null;
    }
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
    _sound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        _sound = null;
      }
    });
  } catch (e) {
    console.warn('[KokoroTTS] playUrl failed:', e);
  }
}

function fallbackSpeak(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 0.9, pitch: 1.0 });
}

export async function kokoroSpeak(text: string): Promise<void> {
  if (!text) return;
  const available = await checkKokoroAvailable();
  if (!available) {
    fallbackSpeak(text);
    return;
  }
  const url = `${TTS_BASE}/tts?text=${encodeURIComponent(text)}&voice=${VOICE}&speed=1.0`;
  await playUrl(url);
}

export async function kokoroSpeakWithOptions(
  questionText: string,
  options: Array<{ label?: string }>,
): Promise<void> {
  const labeledOpts = options.filter((o) => o.label);
  let full = questionText;
  if (labeledOpts.length > 0) {
    const optText = labeledOpts
      .map((o, i) => `${OPTION_LETTERS[i]}, ${o.label}`)
      .join('. ');
    full = `${questionText}. Your options are: ${optText}.`;
  }
  await kokoroSpeak(full);
}

export function kokoroStop() {
  _sound?.stopAsync().catch(() => {});
  Speech.stop();
}

export function resetKokoroAvailability() {
  _kokoroAvailable = null;
}

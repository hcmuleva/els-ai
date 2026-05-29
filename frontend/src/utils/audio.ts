import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const BGM_VOLUME = 0.2;

export class AudioManager {
  private static bgmSound: any = null;
  private static promptSound: any = null;
  private static muted = false;

  static isMuted() {
    return this.muted;
  }

  // Mute/unmute the background music for the whole game (persists across plays).
  static async setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.bgmSound) return;
    try {
      if (Platform.OS === 'web') {
        this.bgmSound.muted = muted;
      } else {
        await this.bgmSound.setStatusAsync({ volume: muted ? 0 : BGM_VOLUME });
      }
    } catch (e) {}
  }

  // Plays a (possibly longer) prompt clip that must be stoppable when the
  // round/quiz ends, so it never bleeds into the next question or past the end.
  static async playPrompt(url: string) {
    if (!url) return;
    await this.stopPrompt();
    if (Platform.OS === 'web') {
      try {
        this.promptSound = new (window as any).Audio(url);
        this.promptSound.volume = 0.9;
        await this.promptSound.play();
      } catch (e) {
        console.warn('Web prompt play failed', e);
      }
    } else {
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
        this.promptSound = sound;
      } catch (e) {
        console.warn('Native prompt play failed', e);
      }
    }
  }

  static async stopPrompt() {
    if (Platform.OS === 'web') {
      if (this.promptSound) {
        try { this.promptSound.pause(); } catch (e) {}
        this.promptSound = null;
      }
    } else if (this.promptSound) {
      try {
        await this.promptSound.stopAsync();
        await this.promptSound.unloadAsync();
      } catch (e) {}
      this.promptSound = null;
    }
  }

  static async playSound(url: string) {
    if (Platform.OS === 'web') {
      try {
        const audio = new (window as any).Audio(url);
        audio.volume = 0.8;
        await audio.play();
      } catch (e) {
        console.warn('Web Audio play failed', e);
      }
    } else {
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: url });
        await sound.playAsync();
      } catch (e) {
        console.warn('Native Audio play failed', e);
      }
    }
  }

  static async playBGM(url: string) {
    if (!url) return;
    if (Platform.OS === 'web') {
      try {
        if (this.bgmSound) {
          this.bgmSound.pause();
        }
        this.bgmSound = new (window as any).Audio(url);
        this.bgmSound.loop = true;
        this.bgmSound.volume = BGM_VOLUME;
        this.bgmSound.muted = this.muted;
        await this.bgmSound.play();
      } catch (e) {
        console.warn('Web BGM play failed', e);
      }
    } else {
      try {
        if (this.bgmSound) {
          await this.bgmSound.unloadAsync();
        }
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, isLooping: true, volume: this.muted ? 0 : BGM_VOLUME }
        );
        this.bgmSound = sound;
      } catch (e) {
        console.warn('Native BGM play failed', e);
      }
    }
  }

  static async pauseBGM() {
    if (!this.bgmSound) return;
    try {
      if (Platform.OS === 'web') this.bgmSound.pause();
      else await this.bgmSound.pauseAsync();
    } catch (e) {}
  }

  static async resumeBGM() {
    if (!this.bgmSound) return;
    try {
      if (Platform.OS === 'web') await this.bgmSound.play();
      else await this.bgmSound.playAsync();
    } catch (e) {}
  }

  static async stopBGM() {
    if (Platform.OS === 'web') {
      if (this.bgmSound) {
        this.bgmSound.pause();
        this.bgmSound = null;
      }
    } else {
      if (this.bgmSound) {
        try {
          await this.bgmSound.stopAsync();
          await this.bgmSound.unloadAsync();
        } catch (e) {}
        this.bgmSound = null;
      }
    }
  }
}

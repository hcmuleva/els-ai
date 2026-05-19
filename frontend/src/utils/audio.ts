import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export class AudioManager {
  private static bgmSound: any = null;

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
        this.bgmSound.volume = 0.1;
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
          { shouldPlay: true, isLooping: true, volume: 0.1 }
        );
        this.bgmSound = sound;
      } catch (e) {
        console.warn('Native BGM play failed', e);
      }
    }
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

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let player: ReturnType<typeof createAudioPlayer> | undefined;
export async function playCompletionSound(): Promise<void> {
  try {
    await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false });
    player ??= createAudioPlayer(require('../../assets/complete.wav'));
    await player.seekTo(0);
    player.play();
  } catch {
    // Saving progress never depends on audio availability or device mute settings.
  }
}

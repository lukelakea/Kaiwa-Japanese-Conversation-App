export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export type TtsSpeed = 0.5 | 0.75 | 1.0;

export interface AppSettings {
  textSize: TextSize;
  /** VOICEVOX speaker/style ID. null = use server default from env. */
  ttsVoice: number | null;
  /** Playback rate applied to synthesised audio. */
  ttsSpeed: TtsSpeed;
  /** Automatically play TTS for each new assistant message. */
  ttsAutoPlay: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  textSize: 'md',
  ttsVoice: null,
  ttsSpeed: 1.0,
  ttsAutoPlay: false,
};

/** Tailwind class for each text size step. */
export const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  sm: 'text-[0.9rem]',
  md: 'text-[1.05rem]',
  lg: 'text-[1.3rem]',
  xl: 'text-[1.6rem]',
};

export type TextSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AppSettings {
  textSize: TextSize;
  /** VOICEVOX speaker/style ID. null = use server default from env. */
  ttsVoice: number | null;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  textSize: 'md',
  ttsVoice: null,
};

/** Tailwind class for each text size step. */
export const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  sm: 'text-[0.9rem]',
  md: 'text-[1.05rem]',
  lg: 'text-[1.3rem]',
  xl: 'text-[1.6rem]',
};

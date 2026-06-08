/**
 * UI metadata for the three conversation settings (brief §4).
 *
 * Data-driven on purpose: the settings bar renders from these arrays, so
 * adjusting labels or adding descriptions never touches component code.
 * Each option carries an English label, a Japanese label for flavour, and a
 * short hint. JLPT levels are intentionally never surfaced (brief §4.1).
 */

import type {
  ConversationSettings,
  Difficulty,
  Formality,
  Initiative,
} from '../types/conversation';

export interface SettingOption<T extends string> {
  value: T;
  label: string;
  labelJa: string;
  hint: string;
}

export const DIFFICULTY_OPTIONS: SettingOption<Difficulty>[] = [
  { value: 'beginner', label: 'Beginner', labelJa: '初級', hint: 'Simple words, short sentences' },
  {
    value: 'intermediate',
    label: 'Intermediate',
    labelJa: '中級',
    hint: 'Everyday conversational Japanese',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    labelJa: '上級',
    hint: 'Rich vocabulary and idioms',
  },
  {
    value: 'near_fluent',
    label: 'Near-Fluent',
    labelJa: '上級＋',
    hint: 'Full natural range, unsimplified',
  },
];

export const FORMALITY_OPTIONS: SettingOption<Formality>[] = [
  { value: 'casual', label: 'Casual', labelJa: 'タメ口', hint: 'Close friends, family' },
  { value: 'friendly', label: 'Friendly', labelJa: '親しみ', hint: 'New friends, peers' },
  { value: 'polite', label: 'Polite', labelJa: '丁寧', hint: 'Strangers, service (です・ます)' },
  { value: 'formal', label: 'Formal', labelJa: '敬語', hint: 'Workplace, seniors' },
];

export const INITIATIVE_OPTIONS: SettingOption<Initiative>[] = [
  { value: 'ai_led', label: 'AI-led', labelJa: 'AI主導', hint: 'The AI steers and asks questions' },
  { value: 'balanced', label: 'Balanced', labelJa: 'バランス', hint: 'Natural give-and-take' },
  {
    value: 'user_led',
    label: 'User-led',
    labelJa: 'あなた主導',
    hint: 'You steer; minimal prompting',
  },
];

export const DEFAULT_SETTINGS: ConversationSettings = {
  difficulty: 'intermediate',
  formality: 'polite',
  initiative: 'balanced',
};

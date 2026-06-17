import { DIFFICULTY_OPTIONS, FORMALITY_OPTIONS, INITIATIVE_OPTIONS } from '../../config/settings';
import type { ConversationSettings } from '../../types/conversation';
import { SettingDropdown } from './SettingDropdown';

interface SettingsBarProps {
  settings: ConversationSettings;
  onChange: (settings: ConversationSettings) => void;
}

/**
 * The three behaviour-shaping settings (brief §4), adjustable at any time —
 * including mid-conversation. Changes apply to subsequent turns only.
 */
export function SettingsBar({ settings, onChange }: SettingsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SettingDropdown
        title="Difficulty"
        description="How complex the AI's Japanese is"
        value={settings.difficulty}
        options={DIFFICULTY_OPTIONS}
        onChange={(difficulty) => onChange({ ...settings, difficulty })}
      />
      <SettingDropdown
        title="Register"
        description="Speech style — casual to formal"
        value={settings.formality}
        options={FORMALITY_OPTIONS}
        onChange={(formality) => onChange({ ...settings, formality })}
      />
      <SettingDropdown
        title="Initiative"
        description="Who drives the conversation"
        value={settings.initiative}
        options={INITIATIVE_OPTIONS}
        onChange={(initiative) => onChange({ ...settings, initiative })}
      />
    </div>
  );
}

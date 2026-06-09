import { useState } from 'react';

import { DEFAULT_APP_SETTINGS } from '../types/settings';
import type { AppSettings } from '../types/settings';

const STORAGE_KEY = 'kaiwa:app-settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const update = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable (e.g. private browsing with storage blocked).
      }
      return next;
    });
  };

  return { settings, update };
}

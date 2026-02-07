import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  type UserSettings,
  type SettingsCategory,
} from '@shared/settings';
import { useThemeStore } from './themeStore';

interface SettingsState {
  settings: UserSettings;
  loaded: boolean;
  settingsOpen: boolean;

  openSettings: () => void;
  closeSettings: () => void;

  loadSettings: () => Promise<void>;
  updateSetting: <C extends SettingsCategory>(
    category: C,
    key: keyof UserSettings[C],
    value: UserSettings[C][keyof UserSettings[C]]
  ) => void;
  updateCategory: <C extends SettingsCategory>(
    category: C,
    values: Partial<UserSettings[C]>
  ) => void;
  resetCategory: (category: SettingsCategory) => void;
  resetAll: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
  settingsOpen: false,

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  loadSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings: UserSettings = await res.json();
        set({ settings, loaded: true });
        // Sync theme to themeStore
        useThemeStore.getState().setTheme(settings.general.theme);
      }
    } catch {
      // Use defaults on error
      set({ loaded: true });
    }
  },

  updateSetting: (category, key, value) => {
    const { settings } = get();
    const updated = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    };
    set({ settings: updated });

    // Sync theme changes
    if (category === 'general' && key === 'theme') {
      useThemeStore.getState().setTheme(value as 'dark' | 'light' | 'system');
    }

    // Persist to server
    fetch(`/api/settings/${category}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  },

  updateCategory: (category, values) => {
    const { settings } = get();
    const updated = {
      ...settings,
      [category]: { ...settings[category], ...values },
    };
    set({ settings: updated });

    // Sync theme if general category changed
    if (category === 'general' && 'theme' in values) {
      useThemeStore.getState().setTheme(
        (values as Partial<UserSettings['general']>).theme!
      );
    }

    fetch(`/api/settings/${category}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    }).catch(() => {});
  },

  resetCategory: (category) => {
    const { settings } = get();
    const updated = {
      ...settings,
      [category]: { ...DEFAULT_SETTINGS[category] },
    };
    set({ settings: updated });

    if (category === 'general') {
      useThemeStore.getState().setTheme(DEFAULT_SETTINGS.general.theme);
    }

    fetch(`/api/settings/${category}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEFAULT_SETTINGS[category]),
    }).catch(() => {});
  },

  resetAll: () => {
    set({ settings: { ...DEFAULT_SETTINGS } });
    useThemeStore.getState().setTheme(DEFAULT_SETTINGS.general.theme);

    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEFAULT_SETTINGS),
    }).catch(() => {});
  },
}));

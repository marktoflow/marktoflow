// Settings types, defaults, and utilities shared between client and server

export interface GeneralSettings {
  theme: 'dark' | 'light' | 'system';
}

export interface CanvasSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showMinimap: boolean;
  animateEdges: boolean;
}

export interface EditorSettings {
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  autoValidateOnChange: boolean;
  confirmBeforeDelete: boolean;
}

export interface ExecutionSettings {
  confirmBeforeExecute: boolean;
  autoScrollLogs: boolean;
  showExecutionNotifications: boolean;
}

export interface AISettings {
  showPromptBar: boolean;
  showAISuggestions: boolean;
}

export interface NotificationSettings {
  executionComplete: boolean;
  executionFailed: boolean;
  workflowSaved: boolean;
  connectionStatus: boolean;
}

export interface UserSettings {
  general: GeneralSettings;
  canvas: CanvasSettings;
  editor: EditorSettings;
  execution: ExecutionSettings;
  ai: AISettings;
  notifications: NotificationSettings;
}

export type SettingsCategory = keyof UserSettings;

export const DEFAULT_SETTINGS: UserSettings = {
  general: {
    theme: 'dark',
  },
  canvas: {
    showGrid: true,
    snapToGrid: true,
    gridSize: 20,
    showMinimap: true,
    animateEdges: true,
  },
  editor: {
    autoSaveEnabled: false,
    autoSaveIntervalMs: 30000,
    autoValidateOnChange: true,
    confirmBeforeDelete: true,
  },
  execution: {
    confirmBeforeExecute: true,
    autoScrollLogs: true,
    showExecutionNotifications: true,
  },
  ai: {
    showPromptBar: true,
    showAISuggestions: true,
  },
  notifications: {
    executionComplete: true,
    executionFailed: true,
    workflowSaved: false,
    connectionStatus: true,
  },
};

/**
 * Deep-merge saved settings with defaults so new settings get their defaults
 * automatically when the schema evolves.
 */
export function deepMergeSettings(
  defaults: UserSettings,
  saved: Partial<Record<string, unknown>>
): UserSettings {
  const result = {} as Record<string, Record<string, unknown>>;

  for (const key of Object.keys(defaults) as SettingsCategory[]) {
    const defaultCategory = defaults[key] as unknown as Record<string, unknown>;
    const savedVal = saved?.[key];
    const savedCategory =
      typeof savedVal === 'object' && savedVal !== null
        ? (savedVal as Record<string, unknown>)
        : {};

    result[key] = { ...defaultCategory, ...savedCategory };
  }

  return result as unknown as UserSettings;
}

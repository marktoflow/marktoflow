import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { useSettingsStore } from '../../src/client/stores/settingsStore';
import { useThemeStore } from '../../src/client/stores/themeStore';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('settingsStore', () => {
  beforeEach(() => {
    // Reset stores
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      loaded: false,
      settingsOpen: false,
    });
    useThemeStore.setState({
      theme: 'dark',
      resolvedTheme: 'dark',
    });
    mockFetch.mockReset();
  });

  describe('initial state', () => {
    it('should have default settings', () => {
      const state = useSettingsStore.getState();
      expect(state.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should not be loaded initially', () => {
      const state = useSettingsStore.getState();
      expect(state.loaded).toBe(false);
    });

    it('should have settings closed initially', () => {
      const state = useSettingsStore.getState();
      expect(state.settingsOpen).toBe(false);
    });
  });

  describe('openSettings / closeSettings', () => {
    it('should open settings', () => {
      useSettingsStore.getState().openSettings();
      expect(useSettingsStore.getState().settingsOpen).toBe(true);
    });

    it('should close settings', () => {
      useSettingsStore.setState({ settingsOpen: true });
      useSettingsStore.getState().closeSettings();
      expect(useSettingsStore.getState().settingsOpen).toBe(false);
    });
  });

  describe('loadSettings', () => {
    it('should load settings from API and mark as loaded', async () => {
      const serverSettings = {
        ...DEFAULT_SETTINGS,
        general: { theme: 'light' as const },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverSettings,
      });

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.settings.general.theme).toBe('light');
      expect(mockFetch).toHaveBeenCalledWith('/api/settings');
    });

    it('should sync theme to themeStore after loading', async () => {
      const serverSettings = {
        ...DEFAULT_SETTINGS,
        general: { theme: 'light' as const },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serverSettings,
      });

      await useSettingsStore.getState().loadSettings();

      expect(useThemeStore.getState().theme).toBe('light');
    });

    it('should mark as loaded even on API failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should keep defaults when API returns non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await useSettingsStore.getState().loadSettings();

      expect(useSettingsStore.getState().loaded).toBe(false);
      expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('updateSetting', () => {
    it('should update a single setting optimistically', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateSetting('canvas', 'showGrid', false);

      expect(useSettingsStore.getState().settings.canvas.showGrid).toBe(false);
    });

    it('should PATCH the correct category to the server', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateSetting('editor', 'autoSaveEnabled', true);

      expect(mockFetch).toHaveBeenCalledWith('/api/settings/editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSaveEnabled: true }),
      });
    });

    it('should sync theme when updating general.theme', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateSetting('general', 'theme', 'light');

      expect(useThemeStore.getState().theme).toBe('light');
    });

    it('should not sync theme when updating non-theme settings', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateSetting('canvas', 'gridSize', 40);

      // Theme should remain unchanged
      expect(useThemeStore.getState().theme).toBe('dark');
    });

    it('should preserve other settings in the same category', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateSetting('canvas', 'showGrid', false);

      const canvas = useSettingsStore.getState().settings.canvas;
      expect(canvas.showGrid).toBe(false);
      expect(canvas.snapToGrid).toBe(true);
      expect(canvas.gridSize).toBe(20);
      expect(canvas.showMinimap).toBe(true);
    });
  });

  describe('updateCategory', () => {
    it('should update multiple settings in a category at once', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateCategory('editor', {
        autoSaveEnabled: true,
        autoSaveIntervalMs: 10000,
      });

      const editor = useSettingsStore.getState().settings.editor;
      expect(editor.autoSaveEnabled).toBe(true);
      expect(editor.autoSaveIntervalMs).toBe(10000);
      expect(editor.autoValidateOnChange).toBe(true); // untouched
    });

    it('should PATCH the category with all provided values', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateCategory('notifications', {
        workflowSaved: true,
        connectionStatus: false,
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowSaved: true, connectionStatus: false }),
      });
    });

    it('should sync theme when updating general category with theme', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateCategory('general', { theme: 'system' });

      expect(useThemeStore.getState().theme).toBe('system');
    });
  });

  describe('resetCategory', () => {
    it('should reset a category to defaults', () => {
      mockFetch.mockResolvedValueOnce({ ok: true }); // for updateSetting
      mockFetch.mockResolvedValueOnce({ ok: true }); // for resetCategory

      // First change a setting
      useSettingsStore.getState().updateSetting('canvas', 'showGrid', false);
      expect(useSettingsStore.getState().settings.canvas.showGrid).toBe(false);

      // Then reset
      useSettingsStore.getState().resetCategory('canvas');
      expect(useSettingsStore.getState().settings.canvas).toEqual(DEFAULT_SETTINGS.canvas);
    });

    it('should sync theme when resetting general category', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().updateSetting('general', 'theme', 'light');
      useSettingsStore.getState().resetCategory('general');

      expect(useThemeStore.getState().theme).toBe('dark');
    });

    it('should PATCH defaults to the server', () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      useSettingsStore.getState().resetCategory('editor');

      expect(mockFetch).toHaveBeenCalledWith('/api/settings/editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_SETTINGS.editor),
      });
    });

    it('should not affect other categories', () => {
      mockFetch.mockResolvedValue({ ok: true });

      useSettingsStore.getState().updateSetting('canvas', 'showGrid', false);
      useSettingsStore.getState().updateSetting('editor', 'autoSaveEnabled', true);

      useSettingsStore.getState().resetCategory('canvas');

      expect(useSettingsStore.getState().settings.canvas).toEqual(DEFAULT_SETTINGS.canvas);
      expect(useSettingsStore.getState().settings.editor.autoSaveEnabled).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should reset all settings to defaults', () => {
      mockFetch.mockResolvedValue({ ok: true });

      // Change several settings
      useSettingsStore.getState().updateSetting('canvas', 'showGrid', false);
      useSettingsStore.getState().updateSetting('editor', 'autoSaveEnabled', true);
      useSettingsStore.getState().updateSetting('general', 'theme', 'light');

      // Reset all
      useSettingsStore.getState().resetAll();

      expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should sync theme back to default', () => {
      mockFetch.mockResolvedValue({ ok: true });

      useSettingsStore.getState().updateSetting('general', 'theme', 'light');
      useSettingsStore.getState().resetAll();

      expect(useThemeStore.getState().theme).toBe('dark');
    });

    it('should PUT defaults to the server', () => {
      mockFetch.mockResolvedValue({ ok: true });

      useSettingsStore.getState().resetAll();

      // Find the PUT call (may have other calls from previous operations)
      const putCall = mockFetch.mock.calls.find(
        (call) => call[0] === '/api/settings' && call[1]?.method === 'PUT'
      );
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall![1].body)).toEqual(DEFAULT_SETTINGS);
    });
  });
});

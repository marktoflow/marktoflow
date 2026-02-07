import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  deepMergeSettings,
  type UserSettings,
} from '../../src/shared/settings';

describe('DEFAULT_SETTINGS', () => {
  it('should have all required categories', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('general');
    expect(DEFAULT_SETTINGS).toHaveProperty('canvas');
    expect(DEFAULT_SETTINGS).toHaveProperty('editor');
    expect(DEFAULT_SETTINGS).toHaveProperty('execution');
    expect(DEFAULT_SETTINGS).toHaveProperty('ai');
    expect(DEFAULT_SETTINGS).toHaveProperty('notifications');
  });

  it('should default to dark theme', () => {
    expect(DEFAULT_SETTINGS.general.theme).toBe('dark');
  });

  it('should default canvas settings to reasonable values', () => {
    expect(DEFAULT_SETTINGS.canvas.showGrid).toBe(true);
    expect(DEFAULT_SETTINGS.canvas.snapToGrid).toBe(true);
    expect(DEFAULT_SETTINGS.canvas.gridSize).toBe(20);
    expect(DEFAULT_SETTINGS.canvas.showMinimap).toBe(true);
    expect(DEFAULT_SETTINGS.canvas.animateEdges).toBe(true);
  });

  it('should default editor with no auto-save', () => {
    expect(DEFAULT_SETTINGS.editor.autoSaveEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.editor.autoSaveIntervalMs).toBe(30000);
    expect(DEFAULT_SETTINGS.editor.autoValidateOnChange).toBe(true);
    expect(DEFAULT_SETTINGS.editor.confirmBeforeDelete).toBe(true);
  });

  it('should default execution with confirmations enabled', () => {
    expect(DEFAULT_SETTINGS.execution.confirmBeforeExecute).toBe(true);
    expect(DEFAULT_SETTINGS.execution.autoScrollLogs).toBe(true);
    expect(DEFAULT_SETTINGS.execution.showExecutionNotifications).toBe(true);
  });

  it('should default AI features to visible', () => {
    expect(DEFAULT_SETTINGS.ai.showPromptBar).toBe(true);
    expect(DEFAULT_SETTINGS.ai.showAISuggestions).toBe(true);
  });

  it('should default notifications with workflowSaved off', () => {
    expect(DEFAULT_SETTINGS.notifications.executionComplete).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.executionFailed).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.workflowSaved).toBe(false);
    expect(DEFAULT_SETTINGS.notifications.connectionStatus).toBe(true);
  });
});

describe('deepMergeSettings', () => {
  it('should return defaults when saved is empty', () => {
    const result = deepMergeSettings(DEFAULT_SETTINGS, {});
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('should override individual values from saved', () => {
    const saved = {
      general: { theme: 'light' },
    };
    const result = deepMergeSettings(DEFAULT_SETTINGS, saved);
    expect(result.general.theme).toBe('light');
    // Other categories should retain defaults
    expect(result.canvas).toEqual(DEFAULT_SETTINGS.canvas);
    expect(result.editor).toEqual(DEFAULT_SETTINGS.editor);
  });

  it('should merge partial category with defaults', () => {
    const saved = {
      canvas: { showGrid: false },
    };
    const result = deepMergeSettings(DEFAULT_SETTINGS, saved);
    expect(result.canvas.showGrid).toBe(false);
    // Other canvas settings should have defaults
    expect(result.canvas.snapToGrid).toBe(true);
    expect(result.canvas.gridSize).toBe(20);
    expect(result.canvas.showMinimap).toBe(true);
    expect(result.canvas.animateEdges).toBe(true);
  });

  it('should merge multiple categories simultaneously', () => {
    const saved = {
      general: { theme: 'system' as const },
      editor: { autoSaveEnabled: true, autoSaveIntervalMs: 10000 },
      notifications: { workflowSaved: true },
    };
    const result = deepMergeSettings(DEFAULT_SETTINGS, saved);
    expect(result.general.theme).toBe('system');
    expect(result.editor.autoSaveEnabled).toBe(true);
    expect(result.editor.autoSaveIntervalMs).toBe(10000);
    expect(result.editor.autoValidateOnChange).toBe(true); // default preserved
    expect(result.notifications.workflowSaved).toBe(true);
    expect(result.notifications.executionComplete).toBe(true); // default preserved
  });

  it('should handle null saved values gracefully', () => {
    const saved = {
      general: null,
      canvas: undefined,
    };
    const result = deepMergeSettings(DEFAULT_SETTINGS, saved as any);
    expect(result.general).toEqual(DEFAULT_SETTINGS.general);
    expect(result.canvas).toEqual(DEFAULT_SETTINGS.canvas);
  });

  it('should handle non-object saved values gracefully', () => {
    const saved = {
      general: 'invalid',
      canvas: 42,
    };
    const result = deepMergeSettings(DEFAULT_SETTINGS, saved as any);
    expect(result.general).toEqual(DEFAULT_SETTINGS.general);
    expect(result.canvas).toEqual(DEFAULT_SETTINGS.canvas);
  });

  it('should ignore extra unknown categories in saved', () => {
    const saved = {
      general: { theme: 'light' },
      unknownCategory: { foo: 'bar' },
    };
    const result = deepMergeSettings(DEFAULT_SETTINGS, saved as any);
    expect(result.general.theme).toBe('light');
    expect((result as any).unknownCategory).toBeUndefined();
  });

  it('should handle completely empty saved object', () => {
    const result = deepMergeSettings(DEFAULT_SETTINGS, {});
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('should produce a new object, not mutate defaults', () => {
    const saved = { general: { theme: 'light' } };
    const result = deepMergeSettings(DEFAULT_SETTINGS, saved);
    expect(result).not.toBe(DEFAULT_SETTINGS);
    expect(result.general).not.toBe(DEFAULT_SETTINGS.general);
    expect(DEFAULT_SETTINGS.general.theme).toBe('dark'); // unchanged
  });
});

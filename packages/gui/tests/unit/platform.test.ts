/**
 * Tests for platform detection utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isMac, getModKey, getShortcutDisplay, isModKeyPressed } from '../../src/client/utils/platform';

describe('Platform Utilities', () => {
  describe('isMac', () => {
    beforeEach(() => {
      // Reset navigator mock
      vi.stubGlobal('navigator', {
        platform: 'MacIntel',
      });
    });

    it('should return true for Mac platforms', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(isMac()).toBe(true);

      vi.stubGlobal('navigator', { platform: 'MacPPC' });
      expect(isMac()).toBe(true);

      vi.stubGlobal('navigator', { platform: 'Mac68K' });
      expect(isMac()).toBe(true);
    });

    it('should return false for non-Mac platforms', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(isMac()).toBe(false);

      vi.stubGlobal('navigator', { platform: 'Linux x86_64' });
      expect(isMac()).toBe(false);

      vi.stubGlobal('navigator', { platform: 'Linux' });
      expect(isMac()).toBe(false);
    });

    it('should return false when navigator is undefined', () => {
      vi.stubGlobal('navigator', undefined);
      expect(isMac()).toBe(false);
    });
  });

  describe('getModKey', () => {
    it('should return ⌘ on Mac', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(getModKey()).toBe('⌘');
    });

    it('should return Ctrl on Windows', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(getModKey()).toBe('Ctrl');
    });

    it('should return Ctrl on Linux', () => {
      vi.stubGlobal('navigator', { platform: 'Linux x86_64' });
      expect(getModKey()).toBe('Ctrl');
    });
  });

  describe('getShortcutDisplay', () => {
    it('should convert ⌘ to Ctrl on Windows', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(getShortcutDisplay('⌘+S')).toBe('Ctrl+S');
      expect(getShortcutDisplay('⌘+Z')).toBe('Ctrl+Z');
      expect(getShortcutDisplay('⌘+⇧+Z')).toBe('Ctrl+⇧+Z');
    });

    it('should keep ⌘ on Mac', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(getShortcutDisplay('⌘+S')).toBe('⌘+S');
      expect(getShortcutDisplay('⌘+Z')).toBe('⌘+Z');
    });

    it('should convert Cmd to appropriate modifier', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(getShortcutDisplay('Cmd+S')).toBe('Ctrl+S');

      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(getShortcutDisplay('Cmd+S')).toBe('⌘+S');
    });

    it('should handle multiple occurrences', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(getShortcutDisplay('⌘+⌘')).toBe('Ctrl+Ctrl');
    });
  });

  describe('isModKeyPressed', () => {
    it('should check metaKey on Mac', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });

      const event = { metaKey: true, ctrlKey: false } as KeyboardEvent;
      expect(isModKeyPressed(event)).toBe(true);

      const event2 = { metaKey: false, ctrlKey: true } as KeyboardEvent;
      expect(isModKeyPressed(event2)).toBe(false);
    });

    it('should check ctrlKey on Windows', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });

      const event = { metaKey: false, ctrlKey: true } as KeyboardEvent;
      expect(isModKeyPressed(event)).toBe(true);

      const event2 = { metaKey: true, ctrlKey: false } as KeyboardEvent;
      expect(isModKeyPressed(event2)).toBe(false);
    });

    it('should check ctrlKey on Linux', () => {
      vi.stubGlobal('navigator', { platform: 'Linux x86_64' });

      const event = { metaKey: false, ctrlKey: true } as KeyboardEvent;
      expect(isModKeyPressed(event)).toBe(true);
    });
  });
});

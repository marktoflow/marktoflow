import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from '../../src/client/stores/themeStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('themeStore', () => {
  beforeEach(() => {
    // Reset store state
    useThemeStore.setState({
      theme: 'dark',
      resolvedTheme: 'dark',
    });
    localStorageMock.clear();

    // Reset document classes
    document.documentElement.classList.remove('dark', 'light');
  });

  describe('initial state', () => {
    it('should default to dark theme', () => {
      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      const { setTheme } = useThemeStore.getState();

      setTheme('light');

      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
      expect(state.resolvedTheme).toBe('light');
    });

    it('should set theme to dark', () => {
      const { setTheme } = useThemeStore.getState();

      setTheme('light');
      setTheme('dark');

      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
    });

    it('should resolve system theme', () => {
      const { setTheme } = useThemeStore.getState();

      setTheme('system');

      const state = useThemeStore.getState();
      expect(state.theme).toBe('system');
      // Our mock returns dark for prefers-color-scheme: dark
      expect(state.resolvedTheme).toBe('dark');
    });

    it('should apply dark class to document', () => {
      const { setTheme } = useThemeStore.getState();

      setTheme('dark');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('should apply light class to document', () => {
      const { setTheme } = useThemeStore.getState();

      setTheme('light');

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      const { toggleTheme } = useThemeStore.getState();

      toggleTheme();

      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
      expect(state.resolvedTheme).toBe('light');
    });

    it('should toggle from light to dark', () => {
      const { setTheme, toggleTheme } = useThemeStore.getState();

      setTheme('light');
      toggleTheme();

      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
    });

    it('should apply correct classes on toggle', () => {
      const { setTheme, toggleTheme } = useThemeStore.getState();

      setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      toggleTheme();
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      toggleTheme();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });
  });
});

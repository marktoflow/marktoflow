import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  getLanguage,
  isRTL,
} from '@marktoflow/i18n';
import type { UserSettings } from '@shared/settings';
import { DEFAULT_SETTINGS } from '@shared/settings';

describe('GUI i18n settings integration', () => {
  it('default settings use English language', () => {
    expect(DEFAULT_SETTINGS.general.language).toBe('en');
  });

  it('language field exists in GeneralSettings', () => {
    const settings: UserSettings = { ...DEFAULT_SETTINGS };
    settings.general.language = 'es';
    expect(settings.general.language).toBe('es');
  });

  it('all supported languages are available for selection', () => {
    expect(SUPPORTED_LANGUAGE_CODES).toHaveLength(8);
    expect(SUPPORTED_LANGUAGE_CODES).toContain('en');
    expect(SUPPORTED_LANGUAGE_CODES).toContain('ar');
  });
});

describe('RTL support for GUI', () => {
  it('Arabic is RTL', () => {
    expect(isRTL('ar')).toBe(true);
  });

  it('all other languages are LTR', () => {
    const ltrLanguages = SUPPORTED_LANGUAGE_CODES.filter((c) => c !== 'ar');
    for (const lang of ltrLanguages) {
      expect(isRTL(lang)).toBe(false);
    }
  });

  it('language definitions include native names for display', () => {
    for (const lang of LANGUAGES) {
      expect(lang.nativeName).toBeTruthy();
      expect(lang.nativeName.length).toBeGreaterThan(0);
    }
  });
});

describe('GUI language switching', () => {
  beforeEach(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  });

  it('can set document direction to RTL for Arabic', () => {
    const lang = getLanguage('ar');
    if (lang) {
      document.documentElement.dir = lang.direction;
      document.documentElement.lang = lang.code;
    }
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('can set document direction to LTR for non-RTL languages', () => {
    const lang = getLanguage('ja');
    if (lang) {
      document.documentElement.dir = lang.direction;
      document.documentElement.lang = lang.code;
    }
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('ja');
  });

  it('switching languages updates document attributes correctly', () => {
    // Simulate switching through multiple languages
    for (const code of ['en', 'ar', 'zh', 'ar', 'fr']) {
      const lang = getLanguage(code);
      if (lang) {
        document.documentElement.dir = lang.direction;
        document.documentElement.lang = lang.code;
      }
      const expected = code === 'ar' ? 'rtl' : 'ltr';
      expect(document.documentElement.dir).toBe(expected);
    }
  });
});

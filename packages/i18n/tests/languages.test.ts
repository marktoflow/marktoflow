import { describe, it, expect } from 'vitest';
import {
  LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  getLanguage,
  isRTL,
} from '../src/languages.js';

describe('Language metadata', () => {
  it('exports 8 supported languages', () => {
    expect(LANGUAGES).toHaveLength(8);
  });

  it('has correct language codes', () => {
    expect(SUPPORTED_LANGUAGE_CODES).toEqual(
      expect.arrayContaining(['en', 'zh', 'hi', 'es', 'fr', 'ar', 'ja', 'pt'])
    );
  });

  it('defaults to English', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('every language has required fields', () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.nativeName).toBeTruthy();
      expect(['ltr', 'rtl']).toContain(lang.direction);
    }
  });

  it('language codes are 2 characters', () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toMatch(/^[a-z]{2}$/);
    }
  });

  it('has no duplicate language codes', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('getLanguage()', () => {
  it('returns language definition for valid code', () => {
    const en = getLanguage('en');
    expect(en).toBeDefined();
    expect(en!.name).toBe('English');
    expect(en!.nativeName).toBe('English');
    expect(en!.direction).toBe('ltr');
  });

  it('returns Arabic with correct native name and RTL', () => {
    const ar = getLanguage('ar');
    expect(ar).toBeDefined();
    expect(ar!.nativeName).toBe('العربية');
    expect(ar!.direction).toBe('rtl');
  });

  it('returns Chinese with correct native name', () => {
    const zh = getLanguage('zh');
    expect(zh).toBeDefined();
    expect(zh!.nativeName).toBe('中文');
  });

  it('returns undefined for unknown code', () => {
    expect(getLanguage('xx')).toBeUndefined();
    expect(getLanguage('')).toBeUndefined();
  });
});

describe('isRTL()', () => {
  it('returns true for Arabic', () => {
    expect(isRTL('ar')).toBe(true);
  });

  it('returns false for LTR languages', () => {
    expect(isRTL('en')).toBe(false);
    expect(isRTL('zh')).toBe(false);
    expect(isRTL('ja')).toBe(false);
    expect(isRTL('es')).toBe(false);
    expect(isRTL('fr')).toBe(false);
    expect(isRTL('hi')).toBe(false);
    expect(isRTL('pt')).toBe(false);
  });

  it('returns false for unknown language', () => {
    expect(isRTL('xx')).toBe(false);
  });
});

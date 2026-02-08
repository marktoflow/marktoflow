import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SUPPORTED_LANGUAGE_CODES } from '../src/languages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'locales');

const NAMESPACES = ['common', 'gui', 'cli'] as const;

/**
 * Recursively extract all keys from a nested JSON object.
 * Returns dot-separated paths like "toolbar.addStep".
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

/**
 * Extract interpolation variables like {{name}} from a string value.
 */
function extractInterpolationVars(value: string): string[] {
  const matches = value.match(/\{\{(\w+)\}\}/g) || [];
  return matches.map((m) => m.replace(/\{\{|\}\}/g, '')).sort();
}

/**
 * Recursively get a leaf value by dot path.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function loadLocale(lang: string, ns: string): Record<string, unknown> {
  const filePath = join(localesDir, lang, `${ns}.json`);
  if (!existsSync(filePath)) {
    throw new Error(`Locale file missing: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

describe('Locale files exist', () => {
  for (const lang of SUPPORTED_LANGUAGE_CODES) {
    for (const ns of NAMESPACES) {
      it(`${lang}/${ns}.json exists`, () => {
        const filePath = join(localesDir, lang, `${ns}.json`);
        expect(existsSync(filePath), `Missing: ${filePath}`).toBe(true);
      });
    }
  }
});

describe('Locale files are valid JSON', () => {
  for (const lang of SUPPORTED_LANGUAGE_CODES) {
    for (const ns of NAMESPACES) {
      it(`${lang}/${ns}.json is valid JSON`, () => {
        const filePath = join(localesDir, lang, `${ns}.json`);
        if (!existsSync(filePath)) return;
        expect(() => {
          JSON.parse(readFileSync(filePath, 'utf-8'));
        }).not.toThrow();
      });
    }
  }
});

describe('Key consistency - all languages have same keys as English', () => {
  for (const ns of NAMESPACES) {
    const enData = loadLocale('en', ns);
    const enKeys = extractKeys(enData);

    for (const lang of SUPPORTED_LANGUAGE_CODES) {
      if (lang === 'en') continue;

      it(`${lang}/${ns}.json has all English keys`, () => {
        const langData = loadLocale(lang, ns);
        const langKeys = extractKeys(langData);

        const missingKeys = enKeys.filter((k) => !langKeys.includes(k));
        expect(
          missingKeys,
          `${lang}/${ns}.json is missing keys: ${missingKeys.join(', ')}`
        ).toEqual([]);
      });

      it(`${lang}/${ns}.json has no extra keys`, () => {
        const langData = loadLocale(lang, ns);
        const langKeys = extractKeys(langData);

        const extraKeys = langKeys.filter((k) => !enKeys.includes(k));
        expect(
          extraKeys,
          `${lang}/${ns}.json has extra keys: ${extraKeys.join(', ')}`
        ).toEqual([]);
      });
    }
  }
});

describe('Interpolation variables match English', () => {
  for (const ns of NAMESPACES) {
    const enData = loadLocale('en', ns);
    const enKeys = extractKeys(enData);

    // Collect keys that have interpolation variables
    const keysWithVars = enKeys.filter((key) => {
      const value = getNestedValue(enData, key);
      return typeof value === 'string' && value.includes('{{');
    });

    for (const lang of SUPPORTED_LANGUAGE_CODES) {
      if (lang === 'en') continue;

      it(`${lang}/${ns}.json preserves interpolation variables`, () => {
        const langData = loadLocale(lang, ns);
        const mismatches: string[] = [];

        for (const key of keysWithVars) {
          const enValue = getNestedValue(enData, key) as string;
          const langValue = getNestedValue(langData, key);
          if (typeof langValue !== 'string') continue;

          const enVars = extractInterpolationVars(enValue);
          const langVars = extractInterpolationVars(langValue);

          if (JSON.stringify(enVars) !== JSON.stringify(langVars)) {
            mismatches.push(
              `${key}: en has {{${enVars.join(', ')}}}, ${lang} has {{${langVars.join(', ')}}}`
            );
          }
        }

        expect(
          mismatches,
          `Interpolation variable mismatches in ${lang}/${ns}.json:\n${mismatches.join('\n')}`
        ).toEqual([]);
      });
    }
  }
});

describe('No empty translation values', () => {
  for (const lang of SUPPORTED_LANGUAGE_CODES) {
    for (const ns of NAMESPACES) {
      it(`${lang}/${ns}.json has no empty strings`, () => {
        const data = loadLocale(lang, ns);
        const keys = extractKeys(data);
        const emptyKeys = keys.filter((key) => {
          const value = getNestedValue(data, key);
          return typeof value === 'string' && value.trim() === '';
        });

        expect(
          emptyKeys,
          `Empty translation values in ${lang}/${ns}.json: ${emptyKeys.join(', ')}`
        ).toEqual([]);
      });
    }
  }
});

describe('English is the source of truth', () => {
  it('English common.json has entries', () => {
    const data = loadLocale('en', 'common');
    const keys = extractKeys(data);
    expect(keys.length).toBeGreaterThan(10);
  });

  it('English gui.json has entries', () => {
    const data = loadLocale('en', 'gui');
    const keys = extractKeys(data);
    expect(keys.length).toBeGreaterThan(50);
  });

  it('English cli.json has entries', () => {
    const data = loadLocale('en', 'cli');
    const keys = extractKeys(data);
    expect(keys.length).toBeGreaterThan(50);
  });
});

describe('Translations differ from English', () => {
  for (const ns of NAMESPACES) {
    const enData = loadLocale('en', ns);
    const enKeys = extractKeys(enData);

    for (const lang of SUPPORTED_LANGUAGE_CODES) {
      if (lang === 'en') continue;

      it(`${lang}/${ns}.json has translated values (not all identical to English)`, () => {
        const langData = loadLocale(lang, ns);
        let translatedCount = 0;

        for (const key of enKeys) {
          const enValue = getNestedValue(enData, key);
          const langValue = getNestedValue(langData, key);
          if (typeof enValue === 'string' && typeof langValue === 'string') {
            if (enValue !== langValue) {
              translatedCount++;
            }
          }
        }

        // At least 50% of strings should differ from English
        const threshold = Math.floor(enKeys.length * 0.5);
        expect(
          translatedCount,
          `${lang}/${ns}.json: only ${translatedCount}/${enKeys.length} strings differ from English`
        ).toBeGreaterThan(threshold);
      });
    }
  }
});

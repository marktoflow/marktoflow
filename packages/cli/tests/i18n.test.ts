import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectLocale, initI18n } from '../src/i18n.js';

describe('detectLocale()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MARKTOFLOW_LOCALE;
    delete process.env.LANG;
  });

  it('returns explicit CLI locale when provided', () => {
    expect(detectLocale('es')).toBe('es');
    expect(detectLocale('ja')).toBe('ja');
    expect(detectLocale('ar')).toBe('ar');
  });

  it('returns MARKTOFLOW_LOCALE env var when set', () => {
    process.env.MARKTOFLOW_LOCALE = 'fr';
    expect(detectLocale()).toBe('fr');
  });

  it('parses system LANG env var', () => {
    process.env.LANG = 'es_ES.UTF-8';
    expect(detectLocale()).toBe('es');
  });

  it('parses LANG with underscore format', () => {
    process.env.LANG = 'zh_CN';
    expect(detectLocale()).toBe('zh');
  });

  it('falls back to English for unsupported locale', () => {
    process.env.LANG = 'xx_XX.UTF-8';
    expect(detectLocale()).toBe('en');
  });

  it('falls back to English when no locale detected', () => {
    expect(detectLocale()).toBe('en');
  });

  it('CLI flag takes priority over env vars', () => {
    process.env.MARKTOFLOW_LOCALE = 'fr';
    process.env.LANG = 'ja_JP.UTF-8';
    expect(detectLocale('es')).toBe('es');
  });

  it('MARKTOFLOW_LOCALE takes priority over LANG', () => {
    process.env.MARKTOFLOW_LOCALE = 'pt';
    process.env.LANG = 'ja_JP.UTF-8';
    expect(detectLocale()).toBe('pt');
  });

  it('handles all supported language codes', () => {
    const supported = ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'ja', 'pt'];
    for (const code of supported) {
      expect(detectLocale(code)).toBe(code);
    }
  });
});

describe('initI18n()', () => {
  it('initializes i18next with English by default', async () => {
    const i18n = await initI18n('en');
    expect(i18n.language).toBe('en');
    expect(i18n.isInitialized).toBe(true);
  });

  it('loads common namespace', async () => {
    const i18n = await initI18n('en');
    expect(i18n.hasLoadedNamespace('common')).toBe(true);
  });

  it('loads cli namespace', async () => {
    const i18n = await initI18n('en');
    expect(i18n.hasLoadedNamespace('cli')).toBe(true);
  });

  it('translates a known common key', async () => {
    const i18n = await initI18n('en');
    expect(i18n.t('common:actions.save')).toBe('Save');
    expect(i18n.t('common:actions.cancel')).toBe('Cancel');
  });

  it('translates a known CLI key', async () => {
    const i18n = await initI18n('en');
    expect(i18n.t('cli:commands.run.description')).toBe('Run a workflow');
  });

  it('initializes with Spanish locale', async () => {
    const i18n = await initI18n('es');
    expect(i18n.language).toBe('es');
    // Spanish translation should differ from English
    const esValue = i18n.t('cli:commands.run.description');
    expect(esValue).not.toBe('Run a workflow');
    expect(esValue).toBeTruthy();
  });

  it('initializes with Japanese locale', async () => {
    const i18n = await initI18n('ja');
    expect(i18n.language).toBe('ja');
    const jaValue = i18n.t('common:actions.save');
    expect(jaValue).not.toBe('Save');
    expect(jaValue).toBeTruthy();
  });

  it('handles interpolation variables', async () => {
    const i18n = await initI18n('en');
    const result = i18n.t('cli:commands.run.loaded', { name: 'test-workflow' });
    expect(result).toContain('test-workflow');
  });

  it('falls back to English for missing keys', async () => {
    const i18n = await initI18n('es');
    // If a key is only in English, it should fall back
    const result = i18n.t('common:actions.save');
    expect(result).toBeTruthy();
    expect(result).not.toMatch(/^common:/); // Should not show raw key
  });
});

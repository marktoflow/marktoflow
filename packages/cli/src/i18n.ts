import i18next from 'i18next';
import FsBackend from 'i18next-fs-backend';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { SUPPORTED_LANGUAGE_CODES, DEFAULT_LANGUAGE } from '@marktoflow/i18n';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let isI18nInitialized = false;

/**
 * Detect locale from --locale flag, env var, or system LANG.
 */
export function detectLocale(cliLocale?: string): string {
  const raw =
    cliLocale ||
    process.env.MARKTOFLOW_LOCALE ||
    process.env.LANG ||
    DEFAULT_LANGUAGE;

  // Extract language code from locale string (e.g., "en_US.UTF-8" → "en")
  const code = raw.split(/[_.-]/)[0].toLowerCase();

  if (SUPPORTED_LANGUAGE_CODES.includes(code)) {
    return code;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Initialize i18next for the CLI.
 * Must be called before any command parsing.
 */
export async function initI18n(locale?: string): Promise<typeof i18next> {
  const lng = detectLocale(locale);

  // Resolve the locales directory from @marktoflow/i18n package
  let localesPath: string;
  try {
    const require = createRequire(import.meta.url);
    const i18nPkgPath = dirname(require.resolve('@marktoflow/i18n/package.json'));
    localesPath = join(i18nPkgPath, 'locales');
  } catch {
    // Fallback: relative path from dist/
    localesPath = join(__dirname, '..', '..', 'i18n', 'locales');
  }

  await i18next.use(FsBackend).init({
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',
    ns: ['common', 'cli'],
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: join(localesPath, '{{lng}}', '{{ns}}.json'),
    },
  });

  isI18nInitialized = true;
  return i18next;
}

/**
 * Shorthand for i18next.t()
 * Returns the key itself if i18next is not initialized yet.
 */
export function t(key: string, options?: any): string {
  if (!isI18nInitialized) {
    // Return a placeholder before initialization
    // Extract the last part of the key for a reasonable fallback
    return key.split(':').pop()?.split('.').pop() || key;
  }
  return String(i18next.t(key, options));
}

export default i18next;

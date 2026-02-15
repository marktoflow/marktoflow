/**
 * Playwright SDK initializer and convenience helpers.
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { PlaywrightClient } from './client.js';
import type {
  PlaywrightConfig,
  BrowserType,
  ScreenshotOptions,
  ScreenshotResult,
  PdfOptions,
  PdfResult,
} from './types.js';

export const PlaywrightInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};

    const getOption = <T>(key1: string, key2?: string): T | undefined => {
      const value = options[key1] ?? (key2 ? options[key2] : undefined);
      return value as T | undefined;
    };

    const playwrightConfig: PlaywrightConfig = {
      browserType: getOption<BrowserType>('browser_type', 'browserType'),
      headless: getOption<boolean>('headless'),
      slowMo: getOption<number>('slow_mo', 'slowMo'),
      timeout: getOption<number>('timeout'),
      viewport: getOption<{ width: number; height: number }>('viewport'),
      userAgent: getOption<string>('user_agent', 'userAgent'),
      locale: getOption<string>('locale'),
      timezoneId: getOption<string>('timezone_id', 'timezoneId'),
      geolocation: getOption<{ latitude: number; longitude: number }>('geolocation'),
      permissions: getOption<string[]>('permissions'),
      ignoreHTTPSErrors: getOption<boolean>('ignore_https_errors', 'ignoreHTTPSErrors'),
      deviceName: getOption<string>('device_name', 'deviceName'),
      proxy: getOption<PlaywrightConfig['proxy']>('proxy'),
      extraHTTPHeaders: getOption<Record<string, string>>('extra_http_headers', 'extraHTTPHeaders'),
      recordVideo: getOption<PlaywrightConfig['recordVideo']>('record_video', 'recordVideo'),
      wsEndpoint: getOption<string>('ws_endpoint', 'wsEndpoint'),
      storageState: getOption<string>('storage_state', 'storageState'),
      sessionId: getOption<string>('session_id', 'sessionId'),
      sessionsDir: getOption<string>('sessions_dir', 'sessionsDir'),
      autoSaveSession: getOption<boolean>('auto_save_session', 'autoSaveSession'),
      enableAI: getOption<boolean>('enable_ai', 'enableAI'),
      aiBackend: getOption<'copilot' | 'openai' | 'stagehand'>('ai_backend', 'aiBackend'),
      aiClient: getOption<unknown>('ai_client', 'aiClient'),
      aiProvider: getOption<'openai' | 'anthropic'>('ai_provider', 'aiProvider'),
      aiModel: getOption<string>('ai_model', 'aiModel'),
      aiApiKey: getOption<string>('ai_api_key', 'aiApiKey'),
      aiDebug: getOption<boolean>('ai_debug', 'aiDebug'),
    };

    return new PlaywrightClient(playwrightConfig);
  },
};

/**
 * Create a Playwright client with default options
 */
export function createPlaywrightClient(config?: PlaywrightConfig): PlaywrightClient {
  return new PlaywrightClient(config);
}

/**
 * Quick web scraping helper
 */
export async function scrape(
  url: string,
  selectors: Record<string, string>,
  options?: PlaywrightConfig
): Promise<Record<string, unknown>> {
  const client = new PlaywrightClient(options);
  try {
    await client.navigate({ url });
    const result: Record<string, unknown> = {};
    for (const [key, selector] of Object.entries(selectors)) {
      const extracted = await client.extract({ selector, text: true, all: true });
      result[key] = extracted.data;
    }
    return result;
  } finally {
    await client.close();
  }
}

/**
 * Quick screenshot helper
 */
export async function screenshotUrl(
  url: string,
  options?: ScreenshotOptions & PlaywrightConfig
): Promise<ScreenshotResult> {
  const { path, type, quality, fullPage, selector, clip, omitBackground, ...config } = options || {};
  const client = new PlaywrightClient(config);
  try {
    await client.navigate({ url });
    return client.screenshot({ path, type, quality, fullPage, selector, clip, omitBackground });
  } finally {
    await client.close();
  }
}

/**
 * Quick PDF generation helper
 */
export async function pdfUrl(url: string, options?: PdfOptions & PlaywrightConfig): Promise<PdfResult> {
  const {
    path, format, scale, displayHeaderFooter, headerTemplate, footerTemplate,
    printBackground, landscape, pageRanges, width, height, margin, ...config
  } = options || {};

  const client = new PlaywrightClient({ ...config, browserType: 'chromium' });
  try {
    await client.navigate({ url });
    return client.pdf({
      path, format, scale, displayHeaderFooter, headerTemplate, footerTemplate,
      printBackground, landscape, pageRanges, width, height, margin,
    });
  } finally {
    await client.close();
  }
}

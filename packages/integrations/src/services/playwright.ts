/**
 * Playwright Integration
 *
 * Browser automation for web scraping, testing, and automation tasks.
 * Supports Chromium, Firefox, and WebKit browsers.
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

// ============================================================================
// Types
// ============================================================================

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface PlaywrightConfig {
  /** Browser type to use */
  browserType?: BrowserType;
  /** Run in headless mode */
  headless?: boolean;
  /** Slow down operations by specified milliseconds */
  slowMo?: number;
  /** Browser launch timeout in milliseconds */
  timeout?: number;
  /** Default viewport size */
  viewport?: { width: number; height: number };
  /** User agent string */
  userAgent?: string;
  /** Locale for the browser context */
  locale?: string;
  /** Timezone ID */
  timezoneId?: string;
  /** Geolocation */
  geolocation?: { latitude: number; longitude: number; accuracy?: number };
  /** Permissions to grant */
  permissions?: string[];
  /** Whether to ignore HTTPS errors */
  ignoreHTTPSErrors?: boolean;
  /** Device emulation preset */
  deviceName?: string;
  /** Proxy settings */
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  /** Extra HTTP headers */
  extraHTTPHeaders?: Record<string, string>;
  /** Record video of browser session */
  recordVideo?: {
    dir: string;
    size?: { width: number; height: number };
  };
  /** Connect to existing browser via WebSocket endpoint (e.g., Browserless) */
  wsEndpoint?: string;
}

export interface NavigateOptions {
  /** URL to navigate to */
  url: string;
  /** Wait until condition */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  /** Navigation timeout in milliseconds */
  timeout?: number;
  /** Referer URL */
  referer?: string;
}

export interface ClickOptions {
  /** Element selector */
  selector: string;
  /** Click button */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks */
  clickCount?: number;
  /** Time to wait between mousedown and mouseup in milliseconds */
  delay?: number;
  /** Modifier keys to press */
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  /** Position to click relative to element */
  position?: { x: number; y: number };
  /** Force click even if element is not visible */
  force?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface TypeOptions {
  /** Element selector */
  selector: string;
  /** Text to type */
  text: string;
  /** Time between key presses in milliseconds */
  delay?: number;
  /** Clear existing text before typing */
  clear?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface FillOptions {
  /** Element selector */
  selector: string;
  /** Value to fill */
  value: string;
  /** Force fill even if element is not visible */
  force?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface SelectOptions {
  /** Element selector */
  selector: string;
  /** Values to select */
  values: string | string[];
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface ScreenshotOptions {
  /** File path to save screenshot */
  path?: string;
  /** Screenshot type */
  type?: 'png' | 'jpeg';
  /** Quality for jpeg (0-100) */
  quality?: number;
  /** Capture full page or viewport only */
  fullPage?: boolean;
  /** Element selector to screenshot */
  selector?: string;
  /** Clip region */
  clip?: { x: number; y: number; width: number; height: number };
  /** Omit background */
  omitBackground?: boolean;
}

export interface PdfOptions {
  /** File path to save PDF */
  path?: string;
  /** Paper format */
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  /** Scale of the webpage rendering */
  scale?: number;
  /** Display header and footer */
  displayHeaderFooter?: boolean;
  /** HTML for header */
  headerTemplate?: string;
  /** HTML for footer */
  footerTemplate?: string;
  /** Print background graphics */
  printBackground?: boolean;
  /** Paper orientation */
  landscape?: boolean;
  /** Page ranges to print */
  pageRanges?: string;
  /** Paper width */
  width?: string | number;
  /** Paper height */
  height?: string | number;
  /** Margins */
  margin?: { top?: string | number; right?: string | number; bottom?: string | number; left?: string | number };
}

export interface EvaluateOptions {
  /** JavaScript expression or function to evaluate */
  expression: string;
  /** Arguments to pass to the function */
  args?: unknown[];
}

export interface WaitOptions {
  /** Selector to wait for */
  selector?: string;
  /** State to wait for */
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  /** Wait for specific time in milliseconds */
  timeout?: number;
  /** Wait for URL pattern */
  url?: string | RegExp;
  /** Wait for function to return truthy value */
  function?: string;
  /** Wait for network to be idle */
  networkIdle?: boolean;
  /** Wait for load state */
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ExtractOptions {
  /** Selector for elements to extract */
  selector: string;
  /** Properties to extract from each element */
  properties?: string[];
  /** Extract attribute values */
  attributes?: string[];
  /** Extract inner text */
  text?: boolean;
  /** Extract inner HTML */
  html?: boolean;
  /** Return all matches or just the first */
  all?: boolean;
}

export interface FormFillOptions {
  /** Form data to fill */
  fields: Record<string, string | boolean | string[]>;
  /** Submit the form after filling */
  submit?: boolean;
  /** Form selector (defaults to 'form') */
  formSelector?: string;
}

export interface CookieOptions {
  /** Cookies to set */
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  /** Get cookies for URLs */
  urls?: string[];
}

export interface NetworkOptions {
  /** Block requests matching patterns */
  blockPatterns?: string[];
  /** Intercept and modify requests */
  intercept?: boolean;
  /** Request handler function (as string for serialization) */
  requestHandler?: string;
}

export interface StorageOptions {
  /** Local storage items to set */
  localStorage?: Record<string, string>;
  /** Session storage items to set */
  sessionStorage?: Record<string, string>;
  /** Get storage items */
  getStorage?: 'local' | 'session' | 'both';
}

export interface ScreenshotResult {
  /** Base64-encoded image data */
  data: string;
  /** File path if saved */
  path?: string;
  /** Image type */
  type: 'png' | 'jpeg';
}

export interface PdfResult {
  /** Base64-encoded PDF data */
  data: string;
  /** File path if saved */
  path?: string;
}

export interface ExtractResult {
  /** Extracted data */
  data: unknown;
  /** Number of elements matched */
  count: number;
}

export interface PageInfo {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Page content (HTML) */
  content?: string;
}

// ============================================================================
// Playwright Client
// ============================================================================

/**
 * Playwright browser automation client
 */
export class PlaywrightClient {
  private playwright: typeof import('playwright') | null = null;
  private browser: import('playwright').Browser | null = null;
  private context: import('playwright').BrowserContext | null = null;
  private page: import('playwright').Page | null = null;
  private config: PlaywrightConfig;

  constructor(config: PlaywrightConfig = {}) {
    this.config = {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
      viewport: { width: 1280, height: 720 },
      ...config,
    };
  }

  /**
   * Initialize and launch the browser
   */
  async launch(): Promise<void> {
    if (this.browser) return;

    // Dynamically import playwright
    this.playwright = await import('playwright');

    const browserType = this.config.browserType || 'chromium';
    const launchOptions: import('playwright').LaunchOptions = {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      timeout: this.config.timeout,
    };

    if (this.config.proxy) {
      launchOptions.proxy = this.config.proxy;
    }

    // Connect to existing browser or launch new one
    if (this.config.wsEndpoint) {
      this.browser = await this.playwright[browserType].connect(this.config.wsEndpoint);
    } else {
      this.browser = await this.playwright[browserType].launch(launchOptions);
    }

    // Create browser context with options
    const contextOptions: import('playwright').BrowserContextOptions = {
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      locale: this.config.locale,
      timezoneId: this.config.timezoneId,
      geolocation: this.config.geolocation,
      permissions: this.config.permissions,
      ignoreHTTPSErrors: this.config.ignoreHTTPSErrors,
      extraHTTPHeaders: this.config.extraHTTPHeaders,
      recordVideo: this.config.recordVideo,
    };

    // Handle device emulation
    if (this.config.deviceName && this.playwright.devices[this.config.deviceName]) {
      Object.assign(contextOptions, this.playwright.devices[this.config.deviceName]);
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
  }

  /**
   * Ensure browser is launched
   */
  private async ensureLaunched(): Promise<import('playwright').Page> {
    if (!this.page) {
      await this.launch();
    }
    return this.page!;
  }

  /**
   * Navigate to a URL
   */
  async navigate(options: NavigateOptions): Promise<PageInfo> {
    const page = await this.ensureLaunched();

    await page.goto(options.url, {
      waitUntil: options.waitUntil || 'load',
      timeout: options.timeout,
      referer: options.referer,
    });

    return {
      url: page.url(),
      title: await page.title(),
    };
  }

  /**
   * Click an element
   */
  async click(options: ClickOptions): Promise<void> {
    const page = await this.ensureLaunched();

    await page.click(options.selector, {
      button: options.button,
      clickCount: options.clickCount,
      delay: options.delay,
      modifiers: options.modifiers,
      position: options.position,
      force: options.force,
      timeout: options.timeout,
    });
  }

  /**
   * Double click an element
   */
  async dblclick(options: Omit<ClickOptions, 'clickCount'>): Promise<void> {
    const page = await this.ensureLaunched();

    await page.dblclick(options.selector, {
      button: options.button,
      delay: options.delay,
      modifiers: options.modifiers,
      position: options.position,
      force: options.force,
      timeout: options.timeout,
    });
  }

  /**
   * Type text into an element
   */
  async type(options: TypeOptions): Promise<void> {
    const page = await this.ensureLaunched();

    if (options.clear) {
      await page.fill(options.selector, '');
    }

    await page.type(options.selector, options.text, {
      delay: options.delay,
      timeout: options.timeout,
    });
  }

  /**
   * Fill an input element with a value
   */
  async fill(options: FillOptions): Promise<void> {
    const page = await this.ensureLaunched();

    await page.fill(options.selector, options.value, {
      force: options.force,
      timeout: options.timeout,
    });
  }

  /**
   * Select options from a dropdown
   */
  async select(options: SelectOptions): Promise<string[]> {
    const page = await this.ensureLaunched();

    const values = Array.isArray(options.values) ? options.values : [options.values];
    return page.selectOption(options.selector, values, {
      timeout: options.timeout,
    });
  }

  /**
   * Check a checkbox
   */
  async check(selector: string, options?: { force?: boolean; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.check(selector, options);
  }

  /**
   * Uncheck a checkbox
   */
  async uncheck(selector: string, options?: { force?: boolean; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.uncheck(selector, options);
  }

  /**
   * Hover over an element
   */
  async hover(
    selector: string,
    options?: { position?: { x: number; y: number }; timeout?: number; force?: boolean }
  ): Promise<void> {
    const page = await this.ensureLaunched();
    await page.hover(selector, options);
  }

  /**
   * Focus an element
   */
  async focus(selector: string, options?: { timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.focus(selector, options);
  }

  /**
   * Press a key or key combination
   */
  async press(
    selector: string,
    key: string,
    options?: { delay?: number; timeout?: number }
  ): Promise<void> {
    const page = await this.ensureLaunched();
    await page.press(selector, key, options);
  }

  /**
   * Press keyboard keys without focusing an element
   */
  async keyboard(key: string, options?: { delay?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.keyboard.press(key, options);
  }

  /**
   * Take a screenshot
   */
  async screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const page = await this.ensureLaunched();

    let element: import('playwright').ElementHandle | null = null;
    if (options.selector) {
      element = await page.$(options.selector);
      if (!element) {
        throw new Error(`Element not found: ${options.selector}`);
      }
    }

    const screenshotOptions: import('playwright').PageScreenshotOptions = {
      path: options.path,
      type: options.type || 'png',
      quality: options.type === 'jpeg' ? options.quality : undefined,
      fullPage: options.fullPage,
      clip: options.clip,
      omitBackground: options.omitBackground,
    };

    const buffer = element
      ? await element.screenshot(screenshotOptions)
      : await page.screenshot(screenshotOptions);

    return {
      data: buffer.toString('base64'),
      path: options.path,
      type: options.type || 'png',
    };
  }

  /**
   * Generate a PDF of the page (Chromium only)
   */
  async pdf(options: PdfOptions = {}): Promise<PdfResult> {
    const page = await this.ensureLaunched();

    const buffer = await page.pdf({
      path: options.path,
      format: options.format,
      scale: options.scale,
      displayHeaderFooter: options.displayHeaderFooter,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
      printBackground: options.printBackground,
      landscape: options.landscape,
      pageRanges: options.pageRanges,
      width: options.width,
      height: options.height,
      margin: options.margin,
    });

    return {
      data: buffer.toString('base64'),
      path: options.path,
    };
  }

  /**
   * Evaluate JavaScript in the page context
   */
  async evaluate<T = unknown>(options: EvaluateOptions): Promise<T> {
    const page = await this.ensureLaunched();

    // For simple expressions, evaluate directly
    // For function expressions, wrap and call
    if (options.expression.trim().startsWith('(') || options.expression.trim().startsWith('function')) {
      // It's a function expression, evaluate it directly
      return page.evaluate(options.expression, options.args) as Promise<T>;
    } else {
      // Wrap expression in a function
      const wrappedExpression = `() => (${options.expression})`;
      return page.evaluate(wrappedExpression) as Promise<T>;
    }
  }

  /**
   * Wait for various conditions
   */
  async wait(options: WaitOptions): Promise<void> {
    const page = await this.ensureLaunched();

    if (options.selector) {
      await page.waitForSelector(options.selector, {
        state: options.state,
        timeout: options.timeout,
      });
    } else if (options.url) {
      await page.waitForURL(options.url, { timeout: options.timeout });
    } else if (options.function) {
      // Wrap the function expression for evaluation
      const wrappedFn = `() => (${options.function})`;
      await page.waitForFunction(wrappedFn, { timeout: options.timeout });
    } else if (options.loadState) {
      await page.waitForLoadState(options.loadState, { timeout: options.timeout });
    } else if (options.networkIdle) {
      await page.waitForLoadState('networkidle', { timeout: options.timeout });
    } else if (options.timeout) {
      await page.waitForTimeout(options.timeout);
    }
  }

  /**
   * Extract data from the page
   */
  async extract(options: ExtractOptions): Promise<ExtractResult> {
    const page = await this.ensureLaunched();

    const elements = await page.$$(options.selector);

    if (elements.length === 0) {
      return { data: options.all ? [] : null, count: 0 };
    }

    const extractElement = async (el: import('playwright').ElementHandle) => {
      const result: Record<string, unknown> = {};

      if (options.text) {
        result.text = await el.textContent();
      }

      if (options.html) {
        result.html = await el.innerHTML();
      }

      if (options.attributes) {
        for (const attr of options.attributes) {
          result[attr] = await el.getAttribute(attr);
        }
      }

      if (options.properties) {
        for (const prop of options.properties) {
          result[prop] = await el.evaluate((e, p) => (e as unknown as Record<string, unknown>)[p], prop);
        }
      }

      // If only one type of data requested, return it directly
      const keys = Object.keys(result);
      if (keys.length === 1) {
        return result[keys[0]];
      }

      return result;
    };

    if (options.all) {
      const data = await Promise.all(elements.map(extractElement));
      return { data, count: elements.length };
    } else {
      const data = await extractElement(elements[0]);
      return { data, count: 1 };
    }
  }

  /**
   * Fill a form with multiple fields
   */
  async fillForm(options: FormFillOptions): Promise<void> {
    const page = await this.ensureLaunched();
    const formSelector = options.formSelector || 'form';

    for (const [name, value] of Object.entries(options.fields)) {
      const selector = `${formSelector} [name="${name}"]`;

      if (typeof value === 'boolean') {
        if (value) {
          await page.check(selector);
        } else {
          await page.uncheck(selector);
        }
      } else if (Array.isArray(value)) {
        await page.selectOption(selector, value);
      } else {
        await page.fill(selector, value);
      }
    }

    if (options.submit) {
      await page.click(`${formSelector} [type="submit"]`);
    }
  }

  /**
   * Get or set cookies
   */
  async cookies(options: CookieOptions = {}): Promise<import('playwright').Cookie[]> {
    const context = this.context;
    if (!context) {
      await this.ensureLaunched();
    }

    if (options.cookies) {
      await this.context!.addCookies(options.cookies);
    }

    return this.context!.cookies(options.urls);
  }

  /**
   * Clear cookies
   */
  async clearCookies(): Promise<void> {
    if (this.context) {
      await this.context.clearCookies();
    }
  }

  /**
   * Manage local and session storage
   */
  async storage(options: StorageOptions): Promise<Record<string, unknown>> {
    const page = await this.ensureLaunched();
    const result: Record<string, unknown> = {};

    // Set local storage
    if (options.localStorage) {
      await page.evaluate((items) => {
        for (const [key, value] of Object.entries(items)) {
          localStorage.setItem(key, value);
        }
      }, options.localStorage);
    }

    // Set session storage
    if (options.sessionStorage) {
      await page.evaluate((items) => {
        for (const [key, value] of Object.entries(items)) {
          sessionStorage.setItem(key, value);
        }
      }, options.sessionStorage);
    }

    // Get storage
    if (options.getStorage === 'local' || options.getStorage === 'both') {
      result.localStorage = await page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) items[key] = localStorage.getItem(key) || '';
        }
        return items;
      });
    }

    if (options.getStorage === 'session' || options.getStorage === 'both') {
      result.sessionStorage = await page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) items[key] = sessionStorage.getItem(key) || '';
        }
        return items;
      });
    }

    return result;
  }

  /**
   * Block network requests matching patterns
   */
  async blockRequests(patterns: string[]): Promise<void> {
    const page = await this.ensureLaunched();

    await page.route(
      (url) => patterns.some((p) => url.href.includes(p)),
      (route) => route.abort()
    );
  }

  /**
   * Intercept and modify network requests
   */
  async interceptRequests(
    handler: (route: import('playwright').Route, request: import('playwright').Request) => Promise<void>
  ): Promise<void> {
    const page = await this.ensureLaunched();
    await page.route('**/*', handler);
  }

  /**
   * Get page content
   */
  async content(): Promise<string> {
    const page = await this.ensureLaunched();
    return page.content();
  }

  /**
   * Get page info
   */
  async pageInfo(includeContent = false): Promise<PageInfo> {
    const page = await this.ensureLaunched();
    return {
      url: page.url(),
      title: await page.title(),
      content: includeContent ? await page.content() : undefined,
    };
  }

  /**
   * Go back in browser history
   */
  async goBack(options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.goBack(options);
  }

  /**
   * Go forward in browser history
   */
  async goForward(options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.goForward(options);
  }

  /**
   * Reload the page
   */
  async reload(options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.reload(options);
  }

  /**
   * Open a new page/tab
   */
  async newPage(): Promise<void> {
    if (!this.context) {
      await this.ensureLaunched();
    }
    this.page = await this.context!.newPage();
  }

  /**
   * Get all open pages
   */
  async getPages(): Promise<PageInfo[]> {
    if (!this.context) {
      return [];
    }
    const pages = this.context.pages();
    return Promise.all(
      pages.map(async (p) => ({
        url: p.url(),
        title: await p.title(),
      }))
    );
  }

  /**
   * Switch to a page by index or URL
   */
  async switchToPage(indexOrUrl: number | string): Promise<PageInfo> {
    if (!this.context) {
      throw new Error('No browser context');
    }

    const pages = this.context.pages();
    let targetPage: import('playwright').Page | undefined;

    if (typeof indexOrUrl === 'number') {
      targetPage = pages[indexOrUrl];
    } else {
      targetPage = pages.find((p) => p.url().includes(indexOrUrl));
    }

    if (!targetPage) {
      throw new Error(`Page not found: ${indexOrUrl}`);
    }

    this.page = targetPage;
    return {
      url: this.page.url(),
      title: await this.page.title(),
    };
  }

  /**
   * Close the current page
   */
  async closePage(): Promise<void> {
    if (this.page) {
      await this.page.close();
      const pages = this.context?.pages() || [];
      this.page = pages.length > 0 ? pages[pages.length - 1] : null;
    }
  }

  /**
   * Upload a file to an input element
   */
  async uploadFile(selector: string, files: string | string[]): Promise<void> {
    const page = await this.ensureLaunched();
    await page.setInputFiles(selector, files);
  }

  /**
   * Download a file
   */
  async download(options: {
    selector?: string;
    url?: string;
    path?: string;
  }): Promise<{ path: string; suggestedFilename: string }> {
    const page = await this.ensureLaunched();

    const downloadPromise = page.waitForEvent('download');

    if (options.selector) {
      await page.click(options.selector);
    } else if (options.url) {
      await page.goto(options.url);
    }

    const download = await downloadPromise;
    const path = options.path || (await download.path());

    if (options.path) {
      await download.saveAs(options.path);
    }

    return {
      path: path || '',
      suggestedFilename: download.suggestedFilename(),
    };
  }

  /**
   * Handle dialog (alert, confirm, prompt)
   */
  async handleDialog(
    action: 'accept' | 'dismiss',
    promptText?: string
  ): Promise<void> {
    const page = await this.ensureLaunched();

    page.once('dialog', async (dialog) => {
      if (action === 'accept') {
        await dialog.accept(promptText);
      } else {
        await dialog.dismiss();
      }
    });
  }

  /**
   * Emulate media type or color scheme
   */
  async emulateMedia(options: {
    media?: 'screen' | 'print' | null;
    colorScheme?: 'light' | 'dark' | 'no-preference' | null;
    reducedMotion?: 'reduce' | 'no-preference' | null;
  }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.emulateMedia(options);
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  /**
   * Get the underlying Playwright page for advanced usage
   */
  getPage(): import('playwright').Page | null {
    return this.page;
  }

  /**
   * Get the underlying Playwright browser for advanced usage
   */
  getBrowser(): import('playwright').Browser | null {
    return this.browser;
  }

  /**
   * Get the underlying Playwright context for advanced usage
   */
  getContext(): import('playwright').BrowserContext | null {
    return this.context;
  }
}

// ============================================================================
// SDK Initializer
// ============================================================================

export const PlaywrightInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};

    // Helper to get option with fallback key
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
    };

    const client = new PlaywrightClient(playwrightConfig);
    return client;
  },
};

// ============================================================================
// Convenience Functions
// ============================================================================

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
    path,
    format,
    scale,
    displayHeaderFooter,
    headerTemplate,
    footerTemplate,
    printBackground,
    landscape,
    pageRanges,
    width,
    height,
    margin,
    ...config
  } = options || {};

  const client = new PlaywrightClient({ ...config, browserType: 'chromium' }); // PDF only works in Chromium

  try {
    await client.navigate({ url });
    return client.pdf({
      path,
      format,
      scale,
      displayHeaderFooter,
      headerTemplate,
      footerTemplate,
      printBackground,
      landscape,
      pageRanges,
      width,
      height,
      margin,
    });
  } finally {
    await client.close();
  }
}

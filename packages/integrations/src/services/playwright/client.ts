/**
 * PlaywrightClient — Core browser automation methods.
 */

import type {
  PlaywrightConfig,
  NavigateOptions,
  ClickOptions,
  TypeOptions,
  FillOptions,
  SelectOptions,
  ScreenshotOptions,
  ScreenshotResult,
  PdfOptions,
  PdfResult,
  EvaluateOptions,
  WaitOptions,
  ExtractOptions,
  ExtractResult,
  FormFillOptions,
  CookieOptions,
  StorageOptions,
  PageInfo,
  SessionInfo,
  ActOptions,
  ActResult,
  AIExtractOptions,
  ObserveOptions,
  ObserveResult,
  StagehandInstance,
} from './types.js';
import type { AIBrowserClient } from '../ai-browser.js';
import type { GitHubCopilotClient } from '../../adapters/github-copilot.js';
import type { OpenAIClient } from '../../adapters/openai.js';

export class PlaywrightClient {
  private playwright: typeof import('playwright') | null = null;
  private browser: import('playwright').Browser | null = null;
  private context: import('playwright').BrowserContext | null = null;
  private page: import('playwright').Page | null = null;
  private config: PlaywrightConfig;
  private stagehand: unknown = null;
  private aiBrowser: AIBrowserClient | null = null;
  private sessionPath: string | null = null;

  constructor(config: PlaywrightConfig = {}) {
    this.config = {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
      viewport: { width: 1280, height: 720 },
      sessionsDir: './sessions',
      autoSaveSession: false,
      ...config,
    };
  }

  private getSessionPath(sessionId: string): string {
    const fs = require('fs');
    const path = require('path');
    const sessionsDir = this.config.sessionsDir || './sessions';
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
    return path.join(sessionsDir, `${sessionId}.json`);
  }

  async launch(): Promise<void> {
    if (this.browser) return;

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

    if (this.config.wsEndpoint) {
      this.browser = await this.playwright[browserType].connect(this.config.wsEndpoint);
    } else {
      this.browser = await this.playwright[browserType].launch(launchOptions);
    }

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

    if (this.config.sessionId) {
      const sessionPath = this.getSessionPath(this.config.sessionId);
      const fs = require('fs');
      if (fs.existsSync(sessionPath)) {
        contextOptions.storageState = sessionPath;
        this.sessionPath = sessionPath;
      }
    } else if (this.config.storageState) {
      contextOptions.storageState = this.config.storageState;
      this.sessionPath = this.config.storageState;
    }

    if (this.config.deviceName && this.playwright.devices[this.config.deviceName]) {
      Object.assign(contextOptions, this.playwright.devices[this.config.deviceName]);
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
  }

  private async ensureLaunched(): Promise<import('playwright').Page> {
    if (!this.page) await this.launch();
    return this.page!;
  }

  async navigate(options: NavigateOptions): Promise<PageInfo> {
    const page = await this.ensureLaunched();
    await page.goto(options.url, {
      waitUntil: options.waitUntil || 'load',
      timeout: options.timeout,
      referer: options.referer,
    });
    return { url: page.url(), title: await page.title() };
  }

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

  async type(options: TypeOptions): Promise<void> {
    const page = await this.ensureLaunched();
    if (options.clear) await page.fill(options.selector, '');
    await page.type(options.selector, options.text, {
      delay: options.delay,
      timeout: options.timeout,
    });
  }

  async fill(options: FillOptions): Promise<void> {
    const page = await this.ensureLaunched();
    await page.fill(options.selector, options.value, {
      force: options.force,
      timeout: options.timeout,
    });
  }

  async select(options: SelectOptions): Promise<string[]> {
    const page = await this.ensureLaunched();
    const values = Array.isArray(options.values) ? options.values : [options.values];
    return page.selectOption(options.selector, values, { timeout: options.timeout });
  }

  async check(selector: string, options?: { force?: boolean; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.check(selector, options);
  }

  async uncheck(selector: string, options?: { force?: boolean; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.uncheck(selector, options);
  }

  async hover(selector: string, options?: { position?: { x: number; y: number }; timeout?: number; force?: boolean }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.hover(selector, options);
  }

  async focus(selector: string, options?: { timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.focus(selector, options);
  }

  async press(selector: string, key: string, options?: { delay?: number; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.press(selector, key, options);
  }

  async keyboard(key: string, options?: { delay?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.keyboard.press(key, options);
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const page = await this.ensureLaunched();

    let element: import('playwright').ElementHandle | null = null;
    if (options.selector) {
      element = await page.$(options.selector);
      if (!element) throw new Error(`Element not found: ${options.selector}`);
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

    return { data: buffer.toString('base64'), path: options.path, type: options.type || 'png' };
  }

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
    return { data: buffer.toString('base64'), path: options.path };
  }

  async evaluate<T = unknown>(options: EvaluateOptions): Promise<T> {
    const page = await this.ensureLaunched();
    if (options.expression.trim().startsWith('(') || options.expression.trim().startsWith('function')) {
      return page.evaluate(options.expression, options.args) as Promise<T>;
    } else {
      const wrappedExpression = `() => (${options.expression})`;
      return page.evaluate(wrappedExpression) as Promise<T>;
    }
  }

  async wait(options: WaitOptions): Promise<void> {
    const page = await this.ensureLaunched();
    if (options.selector) {
      await page.waitForSelector(options.selector, { state: options.state, timeout: options.timeout });
    } else if (options.url) {
      await page.waitForURL(options.url, { timeout: options.timeout });
    } else if (options.function) {
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

  async extract(options: ExtractOptions): Promise<ExtractResult> {
    const page = await this.ensureLaunched();
    const elements = await page.$$(options.selector);

    if (elements.length === 0) {
      return { data: options.all ? [] : null, count: 0 };
    }

    const extractElement = async (el: import('playwright').ElementHandle) => {
      const result: Record<string, unknown> = {};
      if (options.text) result.text = await el.textContent();
      if (options.html) result.html = await el.innerHTML();
      if (options.attributes) {
        for (const attr of options.attributes) result[attr] = await el.getAttribute(attr);
      }
      if (options.properties) {
        for (const prop of options.properties) {
          result[prop] = await el.evaluate((e, p) => (e as unknown as Record<string, unknown>)[p], prop);
        }
      }
      const keys = Object.keys(result);
      if (keys.length === 1) return result[keys[0]];
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

  async fillForm(options: FormFillOptions): Promise<void> {
    const page = await this.ensureLaunched();
    const formSelector = options.formSelector || 'form';

    for (const [name, value] of Object.entries(options.fields)) {
      const selector = `${formSelector} [name="${name}"]`;
      if (typeof value === 'boolean') {
        if (value) await page.check(selector);
        else await page.uncheck(selector);
      } else if (Array.isArray(value)) {
        await page.selectOption(selector, value);
      } else {
        await page.fill(selector, value);
      }
    }

    if (options.submit) await page.click(`${formSelector} [type="submit"]`);
  }

  async cookies(options: CookieOptions = {}): Promise<import('playwright').Cookie[]> {
    if (!this.context) await this.ensureLaunched();
    if (options.cookies) await this.context!.addCookies(options.cookies);
    return this.context!.cookies(options.urls);
  }

  async clearCookies(): Promise<void> {
    if (this.context) await this.context.clearCookies();
  }

  async storage(options: StorageOptions): Promise<Record<string, unknown>> {
    const page = await this.ensureLaunched();
    const result: Record<string, unknown> = {};

    if (options.localStorage) {
      await page.evaluate((items) => {
        for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
      }, options.localStorage);
    }

    if (options.sessionStorage) {
      await page.evaluate((items) => {
        for (const [key, value] of Object.entries(items)) sessionStorage.setItem(key, value);
      }, options.sessionStorage);
    }

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

  async blockRequests(patterns: string[]): Promise<void> {
    const page = await this.ensureLaunched();
    await page.route(
      (url) => patterns.some((p) => url.href.includes(p)),
      (route) => route.abort()
    );
  }

  async interceptRequests(
    handler: (route: import('playwright').Route, request: import('playwright').Request) => Promise<void>
  ): Promise<void> {
    const page = await this.ensureLaunched();
    await page.route('**/*', handler);
  }

  async content(): Promise<string> {
    const page = await this.ensureLaunched();
    return page.content();
  }

  async pageInfo(includeContent = false): Promise<PageInfo> {
    const page = await this.ensureLaunched();
    return {
      url: page.url(),
      title: await page.title(),
      content: includeContent ? await page.content() : undefined,
    };
  }

  async goBack(options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.goBack(options);
  }

  async goForward(options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.goForward(options);
  }

  async reload(options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.reload(options);
  }

  async newPage(): Promise<void> {
    if (!this.context) await this.ensureLaunched();
    this.page = await this.context!.newPage();
  }

  async getPages(): Promise<PageInfo[]> {
    if (!this.context) return [];
    const pages = this.context.pages();
    return Promise.all(pages.map(async (p) => ({ url: p.url(), title: await p.title() })));
  }

  async switchToPage(indexOrUrl: number | string): Promise<PageInfo> {
    if (!this.context) throw new Error('No browser context');
    const pages = this.context.pages();
    let targetPage: import('playwright').Page | undefined;

    if (typeof indexOrUrl === 'number') {
      targetPage = pages[indexOrUrl];
    } else {
      targetPage = pages.find((p) => p.url().includes(indexOrUrl));
    }

    if (!targetPage) throw new Error(`Page not found: ${indexOrUrl}`);
    this.page = targetPage;
    return { url: this.page.url(), title: await this.page.title() };
  }

  async closePage(): Promise<void> {
    if (this.page) {
      await this.page.close();
      const pages = this.context?.pages() || [];
      this.page = pages.length > 0 ? pages[pages.length - 1] : null;
    }
  }

  async uploadFile(selector: string, files: string | string[]): Promise<void> {
    const page = await this.ensureLaunched();
    await page.setInputFiles(selector, files);
  }

  async download(options: { selector?: string; url?: string; path?: string }): Promise<{ path: string; suggestedFilename: string }> {
    const page = await this.ensureLaunched();
    const downloadPromise = page.waitForEvent('download');

    if (options.selector) await page.click(options.selector);
    else if (options.url) await page.goto(options.url);

    const download = await downloadPromise;
    const path = options.path || (await download.path());
    if (options.path) await download.saveAs(options.path);
    return { path: path || '', suggestedFilename: download.suggestedFilename() };
  }

  async handleDialog(action: 'accept' | 'dismiss', promptText?: string): Promise<void> {
    const page = await this.ensureLaunched();
    page.once('dialog', async (dialog) => {
      if (action === 'accept') await dialog.accept(promptText);
      else await dialog.dismiss();
    });
  }

  async emulateMedia(options: {
    media?: 'screen' | 'print' | null;
    colorScheme?: 'light' | 'dark' | 'no-preference' | null;
    reducedMotion?: 'reduce' | 'no-preference' | null;
  }): Promise<void> {
    const page = await this.ensureLaunched();
    await page.emulateMedia(options);
  }

  async close(): Promise<void> {
    if (this.config.autoSaveSession && this.config.sessionId && this.context) {
      await this.saveSession().catch(() => {});
    }
    if (this.page) { await this.page.close().catch(() => {}); this.page = null; }
    if (this.context) { await this.context.close().catch(() => {}); this.context = null; }
    if (this.browser) { await this.browser.close().catch(() => {}); this.browser = null; }
    this.stagehand = null;
  }

  getPage(): import('playwright').Page | null { return this.page; }
  getBrowser(): import('playwright').Browser | null { return this.browser; }
  getContext(): import('playwright').BrowserContext | null { return this.context; }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  async saveSession(sessionIdOrPath?: string): Promise<SessionInfo> {
    if (!this.context) throw new Error('No browser context to save session from');

    let savePath: string;
    if (sessionIdOrPath) {
      if (sessionIdOrPath.includes('/') || sessionIdOrPath.includes('\\') || sessionIdOrPath.endsWith('.json')) {
        savePath = sessionIdOrPath;
      } else {
        savePath = this.getSessionPath(sessionIdOrPath);
      }
    } else if (this.config.sessionId) {
      savePath = this.getSessionPath(this.config.sessionId);
    } else if (this.sessionPath) {
      savePath = this.sessionPath;
    } else {
      throw new Error('No session ID or path specified');
    }

    await this.context.storageState({ path: savePath });
    this.sessionPath = savePath;

    const cookies = await this.context.cookies();
    const domains = [...new Set(cookies.map(c => c.domain))];
    const sessionId = savePath.split('/').pop()?.replace('.json', '') || 'unknown';
    const now = new Date().toISOString();

    return { id: sessionId, path: savePath, createdAt: now, lastUsedAt: now, domains };
  }

  async loadSession(sessionIdOrPath: string): Promise<SessionInfo> {
    const fs = require('fs');
    let loadPath: string;

    if (sessionIdOrPath.includes('/') || sessionIdOrPath.includes('\\') || sessionIdOrPath.endsWith('.json')) {
      loadPath = sessionIdOrPath;
    } else {
      loadPath = this.getSessionPath(sessionIdOrPath);
    }

    if (!fs.existsSync(loadPath)) throw new Error(`Session file not found: ${loadPath}`);

    if (this.browser) {
      if (this.context) await this.context.close();
      const contextOptions: import('playwright').BrowserContextOptions = {
        viewport: this.config.viewport,
        userAgent: this.config.userAgent,
        locale: this.config.locale,
        timezoneId: this.config.timezoneId,
        storageState: loadPath,
      };
      this.context = await this.browser.newContext(contextOptions);
      this.page = await this.context.newPage();
    } else {
      this.config.storageState = loadPath;
    }

    this.sessionPath = loadPath;
    const sessionData = JSON.parse(fs.readFileSync(loadPath, 'utf-8'));
    const domains = [...new Set((sessionData.cookies || []).map((c: { domain: string }) => c.domain))];
    const sessionId = loadPath.split('/').pop()?.replace('.json', '') || 'unknown';

    return { id: sessionId, path: loadPath, createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), domains: domains as string[] };
  }

  async listSessions(): Promise<SessionInfo[]> {
    const fs = require('fs');
    const path = require('path');
    const sessionsDir = this.config.sessionsDir || './sessions';

    if (!fs.existsSync(sessionsDir)) return [];

    const files = fs.readdirSync(sessionsDir).filter((f: string) => f.endsWith('.json'));
    const sessions: SessionInfo[] = [];

    for (const file of files) {
      const filePath = path.join(sessionsDir, file);
      try {
        const stat = fs.statSync(filePath);
        const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const domains = [...new Set((sessionData.cookies || []).map((c: { domain: string }) => c.domain))];
        sessions.push({
          id: file.replace('.json', ''),
          path: filePath,
          createdAt: stat.birthtime.toISOString(),
          lastUsedAt: stat.mtime.toISOString(),
          domains: domains as string[],
        });
      } catch { /* Skip invalid files */ }
    }

    return sessions;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const fs = require('fs');
    const sessionPath = this.getSessionPath(sessionId);
    if (fs.existsSync(sessionPath)) { fs.unlinkSync(sessionPath); return true; }
    return false;
  }

  hasSession(sessionId: string): boolean {
    const fs = require('fs');
    return fs.existsSync(this.getSessionPath(sessionId));
  }

  // ==========================================================================
  // AI-Powered Automation
  // ==========================================================================

  private async initAIBrowser(): Promise<AIBrowserClient> {
    if (this.aiBrowser) return this.aiBrowser;

    if (!this.config.enableAI) throw new Error('AI automation is not enabled. Set enableAI: true in config.');
    if (!this.config.aiBackend || this.config.aiBackend === 'stagehand') {
      throw new Error('Custom AI backend not configured. Set aiBackend to "copilot" or "openai"');
    }
    if (!this.config.aiClient) throw new Error(`AI client not provided. Initialize ${this.config.aiBackend} client first.`);

    try {
      const { AIBrowserClient } = await import('../ai-browser.js');
      this.aiBrowser = new AIBrowserClient({
        backend: this.config.aiBackend as 'copilot' | 'openai',
        aiClient: this.config.aiClient as GitHubCopilotClient | OpenAIClient,
        playwrightClient: this,
        debug: this.config.aiDebug,
      });
      return this.aiBrowser;
    } catch (error) {
      throw new Error(`Failed to initialize AI browser automation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async initStagehand(): Promise<unknown> {
    if (this.stagehand) return this.stagehand;
    if (!this.config.enableAI) throw new Error('AI automation is not enabled. Set enableAI: true in config.');

    try {
      const stagehandPackage = '@browserbasehq/stagehand';
      let stagehandModule: { Stagehand: new (config?: Record<string, unknown>) => StagehandInstance } | null = null;

      try {
        stagehandModule = await import(stagehandPackage) as any;
      } catch {
        throw new Error('Stagehand is not installed. Install it with: npm install @browserbasehq/stagehand');
      }

      const { Stagehand } = stagehandModule!;
      await this.ensureLaunched();

      const stagehandConfig: Record<string, unknown> = {
        env: 'LOCAL',
        enableCaching: true,
        debugDom: this.config.aiDebug,
      };

      if (this.config.aiProvider === 'anthropic') {
        stagehandConfig.modelName = this.config.aiModel || 'claude-3-5-sonnet-latest';
        stagehandConfig.modelClientOptions = { apiKey: this.config.aiApiKey || process.env.ANTHROPIC_API_KEY };
      } else {
        stagehandConfig.modelName = this.config.aiModel || 'gpt-4o';
        stagehandConfig.modelClientOptions = { apiKey: this.config.aiApiKey || process.env.OPENAI_API_KEY };
      }

      this.stagehand = new Stagehand(stagehandConfig);
      await (this.stagehand as StagehandInstance).init({ page: this.page });
      return this.stagehand;
    } catch (error) {
      throw new Error(
        `Failed to initialize Stagehand AI. Make sure @browserbasehq/stagehand is installed: npm install @browserbasehq/stagehand\nOriginal error: ${error}`
      );
    }
  }

  async act(options: ActOptions): Promise<ActResult> {
    if (this.config.aiBackend && this.config.aiBackend !== 'stagehand') {
      const aiBrowser = await this.initAIBrowser();
      try {
        const result = await aiBrowser.act({ action: options.instruction });
        return { success: result.success, action: result.action, element: result.message };
      } catch (error) {
        if (options.optional) return { success: false, error: String(error) };
        throw error;
      }
    }

    const stagehand = await this.initStagehand() as {
      act: (options: { action: string }) => Promise<{ success: boolean; message?: string; action?: string }>;
    };

    try {
      const result = await stagehand.act({ action: options.instruction });
      return { success: result.success !== false, action: result.action || options.instruction, element: result.message };
    } catch (error) {
      if (options.optional) return { success: false, error: String(error) };
      throw error;
    }
  }

  async observe(options: ObserveOptions = {}): Promise<ObserveResult> {
    if (this.config.aiBackend && this.config.aiBackend !== 'stagehand') {
      const aiBrowser = await this.initAIBrowser();
      const elements = await aiBrowser.observe({ instruction: options.instruction });
      return {
        elements: elements.map(el => ({
          description: el.description || '',
          selector: el.selector || '',
          tagName: el.tagName || 'unknown',
          text: el.text,
          actions: el.actions || ['click'],
        })),
      };
    }

    const stagehand = await this.initStagehand() as {
      observe: (options?: { instruction?: string }) => Promise<Array<{ description: string; selector: string; tagName?: string; actions?: string[] }>>;
    };

    const result = await stagehand.observe({ instruction: options.instruction });
    return {
      elements: (result || []).map(el => ({
        description: el.description || '',
        selector: el.selector || '',
        tagName: el.tagName || 'unknown',
        actions: el.actions || ['click'],
      })),
    };
  }

  async aiExtract(options: AIExtractOptions): Promise<unknown> {
    if (this.config.aiBackend && this.config.aiBackend !== 'stagehand') {
      const aiBrowser = await this.initAIBrowser();
      const result = await aiBrowser.aiExtract({ instruction: options.instruction, schema: options.schema });
      return result.data;
    }

    const stagehand = await this.initStagehand() as {
      extract: (options: { instruction: string; schema?: unknown }) => Promise<unknown>;
    };

    let schema: unknown = undefined;
    if (options.schema) schema = options.schema;
    return stagehand.extract({ instruction: options.instruction, schema });
  }

  isAIEnabled(): boolean {
    return this.config.enableAI === true;
  }
}

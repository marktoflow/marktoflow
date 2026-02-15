/**
 * Playwright integration types.
 */

// Stagehand types (optional dependency for AI features)
export interface StagehandClass {
  new (config?: Record<string, unknown>): StagehandInstance;
}

export interface StagehandInstance {
  init(options?: { page?: unknown }): Promise<void>;
  act(options: { action: string }): Promise<{ success?: boolean; message?: string; action?: string }>;
  observe(options?: { instruction?: string }): Promise<Array<{
    description?: string;
    selector?: string;
    tagName?: string;
    actions?: string[];
  }>>;
  extract(options: { instruction: string; schema?: unknown }): Promise<unknown>;
}

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface PlaywrightConfig {
  browserType?: BrowserType;
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  viewport?: { width: number; height: number };
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
  geolocation?: { latitude: number; longitude: number; accuracy?: number };
  permissions?: string[];
  ignoreHTTPSErrors?: boolean;
  deviceName?: string;
  proxy?: { server: string; username?: string; password?: string };
  extraHTTPHeaders?: Record<string, string>;
  recordVideo?: { dir: string; size?: { width: number; height: number } };
  wsEndpoint?: string;

  // Session Persistence
  storageState?: string;
  sessionId?: string;
  sessionsDir?: string;
  autoSaveSession?: boolean;

  // AI-Powered Automation
  enableAI?: boolean;
  aiBackend?: 'copilot' | 'openai' | 'stagehand';
  aiClient?: unknown;
  aiProvider?: 'openai' | 'anthropic';
  aiModel?: string;
  aiApiKey?: string;
  aiDebug?: boolean;
}

export interface NavigateOptions {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
  referer?: string;
}

export interface ClickOptions {
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  position?: { x: number; y: number };
  force?: boolean;
  timeout?: number;
}

export interface TypeOptions {
  selector: string;
  text: string;
  delay?: number;
  clear?: boolean;
  timeout?: number;
}

export interface FillOptions {
  selector: string;
  value: string;
  force?: boolean;
  timeout?: number;
}

export interface SelectOptions {
  selector: string;
  values: string | string[];
  timeout?: number;
}

export interface ScreenshotOptions {
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
  selector?: string;
  clip?: { x: number; y: number; width: number; height: number };
  omitBackground?: boolean;
}

export interface PdfOptions {
  path?: string;
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  scale?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  landscape?: boolean;
  pageRanges?: string;
  width?: string | number;
  height?: string | number;
  margin?: { top?: string | number; right?: string | number; bottom?: string | number; left?: string | number };
}

export interface EvaluateOptions {
  expression: string;
  args?: unknown[];
}

export interface WaitOptions {
  selector?: string;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  timeout?: number;
  url?: string | RegExp;
  function?: string;
  networkIdle?: boolean;
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ExtractOptions {
  selector: string;
  properties?: string[];
  attributes?: string[];
  text?: boolean;
  html?: boolean;
  all?: boolean;
}

export interface FormFillOptions {
  fields: Record<string, string | boolean | string[]>;
  submit?: boolean;
  formSelector?: string;
}

export interface CookieOptions {
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
  urls?: string[];
}

export interface NetworkOptions {
  blockPatterns?: string[];
  intercept?: boolean;
  requestHandler?: string;
}

export interface StorageOptions {
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  getStorage?: 'local' | 'session' | 'both';
}

export interface ScreenshotResult {
  data: string;
  path?: string;
  type: 'png' | 'jpeg';
}

export interface PdfResult {
  data: string;
  path?: string;
}

export interface ExtractResult {
  data: unknown;
  count: number;
}

export interface PageInfo {
  url: string;
  title: string;
  content?: string;
}

// Session Management Types
export interface SessionInfo {
  id: string;
  path: string;
  createdAt: string;
  lastUsedAt: string;
  domains: string[];
}

export interface SessionState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

// AI-Powered Automation Types
export interface ActOptions {
  instruction: string;
  optional?: boolean;
  timeout?: number;
}

export interface ActResult {
  success: boolean;
  action?: string;
  element?: string;
  error?: string;
}

export interface AIExtractOptions {
  instruction: string;
  schema?: Record<string, string>;
  timeout?: number;
}

export interface ObserveOptions {
  instruction?: string;
  onlyActionable?: boolean;
  timeout?: number;
}

export interface ObserveResult {
  elements: Array<{
    description: string;
    selector: string;
    tagName: string;
    actions: string[];
  }>;
}

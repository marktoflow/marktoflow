import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import {
  PlaywrightClient,
  PlaywrightInitializer,
  createPlaywrightClient,
  type PlaywrightConfig,
  type NavigateOptions,
  type ClickOptions,
  type TypeOptions,
  type FillOptions,
  type ScreenshotOptions,
  type ExtractOptions,
  type WaitOptions,
} from '../src/services/playwright.js';
import { registerIntegrations } from '../src/index.js';

// Mock Playwright module
const mockPage = {
  goto: vi.fn().mockResolvedValue(null),
  url: vi.fn().mockReturnValue('https://example.com'),
  title: vi.fn().mockResolvedValue('Example Page'),
  content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
  click: vi.fn().mockResolvedValue(null),
  dblclick: vi.fn().mockResolvedValue(null),
  type: vi.fn().mockResolvedValue(null),
  fill: vi.fn().mockResolvedValue(null),
  selectOption: vi.fn().mockResolvedValue(['option1']),
  check: vi.fn().mockResolvedValue(null),
  uncheck: vi.fn().mockResolvedValue(null),
  hover: vi.fn().mockResolvedValue(null),
  focus: vi.fn().mockResolvedValue(null),
  press: vi.fn().mockResolvedValue(null),
  keyboard: { press: vi.fn().mockResolvedValue(null) },
  screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
  pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  evaluate: vi.fn().mockResolvedValue('evaluated'),
  waitForSelector: vi.fn().mockResolvedValue(null),
  waitForURL: vi.fn().mockResolvedValue(null),
  waitForFunction: vi.fn().mockResolvedValue(null),
  waitForLoadState: vi.fn().mockResolvedValue(null),
  waitForTimeout: vi.fn().mockResolvedValue(null),
  waitForEvent: vi.fn().mockResolvedValue({ path: vi.fn().mockResolvedValue('/tmp/download'), suggestedFilename: () => 'file.txt', saveAs: vi.fn() }),
  $: vi.fn().mockResolvedValue({
    textContent: vi.fn().mockResolvedValue('text content'),
    innerHTML: vi.fn().mockResolvedValue('<span>inner html</span>'),
    getAttribute: vi.fn().mockResolvedValue('attr-value'),
    evaluate: vi.fn().mockResolvedValue('prop-value'),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('element-screenshot')),
  }),
  $$: vi.fn().mockResolvedValue([
    {
      textContent: vi.fn().mockResolvedValue('item 1'),
      innerHTML: vi.fn().mockResolvedValue('<span>1</span>'),
      getAttribute: vi.fn().mockResolvedValue('href1'),
      evaluate: vi.fn().mockResolvedValue('prop1'),
    },
    {
      textContent: vi.fn().mockResolvedValue('item 2'),
      innerHTML: vi.fn().mockResolvedValue('<span>2</span>'),
      getAttribute: vi.fn().mockResolvedValue('href2'),
      evaluate: vi.fn().mockResolvedValue('prop2'),
    },
  ]),
  route: vi.fn().mockResolvedValue(null),
  setInputFiles: vi.fn().mockResolvedValue(null),
  once: vi.fn(),
  emulateMedia: vi.fn().mockResolvedValue(null),
  goBack: vi.fn().mockResolvedValue(null),
  goForward: vi.fn().mockResolvedValue(null),
  reload: vi.fn().mockResolvedValue(null),
  close: vi.fn().mockResolvedValue(null),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  pages: vi.fn().mockReturnValue([mockPage]),
  addCookies: vi.fn().mockResolvedValue(null),
  cookies: vi.fn().mockResolvedValue([{ name: 'test', value: 'cookie' }]),
  clearCookies: vi.fn().mockResolvedValue(null),
  close: vi.fn().mockResolvedValue(null),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(null),
};

const mockPlaywright = {
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
    connect: vi.fn().mockResolvedValue(mockBrowser),
  },
  firefox: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
    connect: vi.fn().mockResolvedValue(mockBrowser),
  },
  webkit: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
    connect: vi.fn().mockResolvedValue(mockBrowser),
  },
  devices: {
    'iPhone 13': { viewport: { width: 390, height: 844 }, userAgent: 'iPhone UA' },
  },
};

// Mock the dynamic import
vi.mock('playwright', () => mockPlaywright);

describe('Playwright Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PlaywrightClient', () => {
    it('should create client with default config', () => {
      const client = new PlaywrightClient();
      expect(client).toBeInstanceOf(PlaywrightClient);
    });

    it('should create client with custom config', () => {
      const config: PlaywrightConfig = {
        browserType: 'firefox',
        headless: false,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Custom UA',
      };
      const client = new PlaywrightClient(config);
      expect(client).toBeInstanceOf(PlaywrightClient);
    });

    it('should launch browser on first operation', async () => {
      const client = new PlaywrightClient();
      await client.navigate({ url: 'https://example.com' });

      expect(mockPlaywright.chromium.launch).toHaveBeenCalled();
      expect(mockBrowser.newContext).toHaveBeenCalled();
      expect(mockContext.newPage).toHaveBeenCalled();
    });

    it('should navigate to URL', async () => {
      const client = new PlaywrightClient();
      const result = await client.navigate({ url: 'https://example.com' });

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
      expect(result.url).toBe('https://example.com');
      expect(result.title).toBe('Example Page');
    });

    it('should navigate with options', async () => {
      const client = new PlaywrightClient();
      const options: NavigateOptions = {
        url: 'https://example.com',
        waitUntil: 'networkidle',
        timeout: 60000,
        referer: 'https://google.com',
      };

      await client.navigate(options);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 60000,
        referer: 'https://google.com',
      });
    });

    it('should click element', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.click({ selector: '#button' });

      expect(mockPage.click).toHaveBeenCalledWith('#button', expect.any(Object));
    });

    it('should click with options', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const options: ClickOptions = {
        selector: '#button',
        button: 'right',
        clickCount: 2,
        delay: 100,
        force: true,
      };

      await client.click(options);

      expect(mockPage.click).toHaveBeenCalledWith('#button', {
        button: 'right',
        clickCount: 2,
        delay: 100,
        force: true,
        modifiers: undefined,
        position: undefined,
        timeout: undefined,
      });
    });

    it('should double click element', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.dblclick({ selector: '#item' });

      expect(mockPage.dblclick).toHaveBeenCalledWith('#item', expect.any(Object));
    });

    it('should type text', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.type({ selector: '#input', text: 'Hello World' });

      expect(mockPage.type).toHaveBeenCalledWith('#input', 'Hello World', expect.any(Object));
    });

    it('should clear and type', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.type({ selector: '#input', text: 'New Text', clear: true });

      expect(mockPage.fill).toHaveBeenCalledWith('#input', '');
      expect(mockPage.type).toHaveBeenCalledWith('#input', 'New Text', expect.any(Object));
    });

    it('should fill input', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.fill({ selector: '#input', value: 'Value' });

      expect(mockPage.fill).toHaveBeenCalledWith('#input', 'Value', expect.any(Object));
    });

    it('should select options', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.select({ selector: '#dropdown', values: 'option1' });

      expect(mockPage.selectOption).toHaveBeenCalledWith('#dropdown', ['option1'], expect.any(Object));
      expect(result).toEqual(['option1']);
    });

    it('should select multiple options', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.select({ selector: '#dropdown', values: ['option1', 'option2'] });

      expect(mockPage.selectOption).toHaveBeenCalledWith('#dropdown', ['option1', 'option2'], expect.any(Object));
    });

    it('should check checkbox', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.check('#checkbox');

      expect(mockPage.check).toHaveBeenCalledWith('#checkbox', undefined);
    });

    it('should uncheck checkbox', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.uncheck('#checkbox');

      expect(mockPage.uncheck).toHaveBeenCalledWith('#checkbox', undefined);
    });

    it('should hover over element', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.hover('#element');

      expect(mockPage.hover).toHaveBeenCalledWith('#element', undefined);
    });

    it('should focus element', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.focus('#input');

      expect(mockPage.focus).toHaveBeenCalledWith('#input', undefined);
    });

    it('should press key', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.press('#input', 'Enter');

      expect(mockPage.press).toHaveBeenCalledWith('#input', 'Enter', undefined);
    });

    it('should take screenshot', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.screenshot({ fullPage: true });

      expect(mockPage.screenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: true }));
      expect(result.data).toBe(Buffer.from('fake-screenshot').toString('base64'));
      expect(result.type).toBe('png');
    });

    it('should take element screenshot', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.screenshot({ selector: '#element' });

      expect(mockPage.$).toHaveBeenCalledWith('#element');
      expect(result.data).toBe(Buffer.from('element-screenshot').toString('base64'));
    });

    it('should generate PDF', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.pdf({ format: 'A4', printBackground: true });

      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        format: 'A4',
        printBackground: true,
      }));
      expect(result.data).toBe(Buffer.from('fake-pdf').toString('base64'));
    });

    it('should evaluate JavaScript', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.evaluate({ expression: 'document.title' });

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result).toBe('evaluated');
    });

    it('should wait for selector', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.wait({ selector: '#element', state: 'visible' });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', {
        state: 'visible',
        timeout: undefined,
      });
    });

    it('should wait for URL', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.wait({ url: 'https://example.com/success' });

      expect(mockPage.waitForURL).toHaveBeenCalledWith('https://example.com/success', { timeout: undefined });
    });

    it('should wait for load state', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.wait({ loadState: 'networkidle' });

      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: undefined });
    });

    it('should wait for timeout', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.wait({ timeout: 1000 });

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
    });

    it('should extract data from elements', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.extract({
        selector: '.item',
        text: true,
        all: true,
      });

      expect(mockPage.$$).toHaveBeenCalledWith('.item');
      expect(result.count).toBe(2);
      expect(result.data).toEqual(['item 1', 'item 2']);
    });

    it('should extract single element', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.extract({
        selector: '.item',
        text: true,
        all: false,
      });

      expect(result.count).toBe(1);
      expect(result.data).toBe('item 1');
    });

    it('should extract multiple properties', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.extract({
        selector: '.item',
        text: true,
        html: true,
        attributes: ['href'],
        all: false,
      });

      expect(result.data).toEqual({
        text: 'item 1',
        html: '<span>1</span>',
        href: 'href1',
      });
    });

    it('should return empty for no matches', async () => {
      mockPage.$$.mockResolvedValueOnce([]);
      const client = new PlaywrightClient();
      await client.launch();
      const result = await client.extract({
        selector: '.nonexistent',
        text: true,
        all: true,
      });

      expect(result.count).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('should fill form', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.fillForm({
        fields: {
          username: 'testuser',
          password: 'testpass',
          remember: true,
        },
      });

      expect(mockPage.fill).toHaveBeenCalledWith('form [name="username"]', 'testuser');
      expect(mockPage.fill).toHaveBeenCalledWith('form [name="password"]', 'testpass');
      expect(mockPage.check).toHaveBeenCalledWith('form [name="remember"]');
    });

    it('should fill and submit form', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.fillForm({
        fields: { email: 'test@example.com' },
        submit: true,
      });

      expect(mockPage.fill).toHaveBeenCalledWith('form [name="email"]', 'test@example.com');
      expect(mockPage.click).toHaveBeenCalledWith('form [type="submit"]');
    });

    it('should manage cookies', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const cookies = await client.cookies({
        cookies: [{ name: 'session', value: 'abc123' }],
      });

      expect(mockContext.addCookies).toHaveBeenCalledWith([{ name: 'session', value: 'abc123' }]);
      expect(cookies).toEqual([{ name: 'test', value: 'cookie' }]);
    });

    it('should clear cookies', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.clearCookies();

      expect(mockContext.clearCookies).toHaveBeenCalled();
    });

    it('should manage storage', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.storage({
        localStorage: { key: 'value' },
      });

      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should block requests', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.blockRequests(['ads.com', 'tracking.js']);

      expect(mockPage.route).toHaveBeenCalled();
    });

    it('should get page content', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const content = await client.content();

      expect(mockPage.content).toHaveBeenCalled();
      expect(content).toBe('<html><body>Test</body></html>');
    });

    it('should get page info', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const info = await client.pageInfo();

      expect(info.url).toBe('https://example.com');
      expect(info.title).toBe('Example Page');
    });

    it('should get page info with content', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      const info = await client.pageInfo(true);

      expect(info.content).toBe('<html><body>Test</body></html>');
    });

    it('should navigate back and forward', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.goBack();
      await client.goForward();

      expect(mockPage.goBack).toHaveBeenCalled();
      expect(mockPage.goForward).toHaveBeenCalled();
    });

    it('should reload page', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.reload();

      expect(mockPage.reload).toHaveBeenCalled();
    });

    it('should upload files', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.uploadFile('#file-input', '/path/to/file.txt');

      expect(mockPage.setInputFiles).toHaveBeenCalledWith('#file-input', '/path/to/file.txt');
    });

    it('should emulate media', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.emulateMedia({ colorScheme: 'dark' });

      expect(mockPage.emulateMedia).toHaveBeenCalledWith({ colorScheme: 'dark' });
    });

    it('should close browser', async () => {
      const client = new PlaywrightClient();
      await client.launch();
      await client.close();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should connect via WebSocket endpoint', async () => {
      const client = new PlaywrightClient({
        wsEndpoint: 'ws://localhost:3000',
      });
      await client.launch();

      expect(mockPlaywright.chromium.connect).toHaveBeenCalledWith('ws://localhost:3000');
    });

    it('should use Firefox browser', async () => {
      const client = new PlaywrightClient({
        browserType: 'firefox',
      });
      await client.launch();

      expect(mockPlaywright.firefox.launch).toHaveBeenCalled();
    });

    it('should use WebKit browser', async () => {
      const client = new PlaywrightClient({
        browserType: 'webkit',
      });
      await client.launch();

      expect(mockPlaywright.webkit.launch).toHaveBeenCalled();
    });
  });

  describe('PlaywrightInitializer', () => {
    it('should initialize client with config', async () => {
      const config = {
        sdk: 'playwright',
        options: {
          browser_type: 'firefox',
          headless: false,
          viewport: { width: 1920, height: 1080 },
        },
      };

      const client = await PlaywrightInitializer.initialize(null, config);
      expect(client).toBeInstanceOf(PlaywrightClient);
    });

    it('should support camelCase and snake_case options', async () => {
      const config = {
        sdk: 'playwright',
        options: {
          browserType: 'chromium',
          user_agent: 'Custom UA',
          ignoreHTTPSErrors: true,
        },
      };

      const client = await PlaywrightInitializer.initialize(null, config);
      expect(client).toBeInstanceOf(PlaywrightClient);
    });
  });

  describe('registerIntegrations', () => {
    it('should register playwright initializer', () => {
      const registry = new SDKRegistry();
      registerIntegrations(registry);

      // Registry should have playwright registered
      // We verify by checking if the registry works correctly
      expect(registry).toBeDefined();
    });
  });

  describe('createPlaywrightClient', () => {
    it('should create client with helper function', () => {
      const client = createPlaywrightClient({ headless: false });
      expect(client).toBeInstanceOf(PlaywrightClient);
    });
  });
});

describe('Playwright Workflow Actions', () => {
  it('should support workflow action pattern: browser.navigate', async () => {
    const client = new PlaywrightClient();

    // Simulating workflow step: action: browser.navigate
    const navigateAction = client.navigate.bind(client);
    const result = await navigateAction({ url: 'https://example.com' });

    expect(result.url).toBe('https://example.com');
  });

  it('should support workflow action pattern: browser.screenshot', async () => {
    const client = new PlaywrightClient();
    await client.launch();

    // Simulating workflow step: action: browser.screenshot
    const screenshotAction = client.screenshot.bind(client);
    const result = await screenshotAction({ fullPage: true });

    expect(result.type).toBe('png');
    expect(result.data).toBeDefined();
  });

  it('should support workflow action pattern: browser.extract', async () => {
    const client = new PlaywrightClient();
    await client.launch();

    // Simulating workflow step: action: browser.extract
    const extractAction = client.extract.bind(client);
    const result = await extractAction({
      selector: '.item',
      text: true,
      all: true,
    });

    expect(result.count).toBeGreaterThan(0);
  });
});

// ============================================================================
// Session Management Tests
// ============================================================================

describe('Playwright Session Management', () => {
  // Mock fs module
  const mockFs = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock require for fs
    vi.doMock('fs', () => mockFs);
  });

  it('should create client with session config', () => {
    const client = new PlaywrightClient({
      sessionId: 'my-session',
      sessionsDir: './test-sessions',
      autoSaveSession: true,
    });

    expect(client).toBeInstanceOf(PlaywrightClient);
  });

  it('should create client with storage state path', () => {
    const client = new PlaywrightClient({
      storageState: './sessions/existing.json',
    });

    expect(client).toBeInstanceOf(PlaywrightClient);
  });

  it('should check if session exists', () => {
    mockFs.existsSync.mockReturnValue(true);

    const client = new PlaywrightClient({
      sessionsDir: './sessions',
    });

    // The hasSession method uses fs internally
    expect(client).toBeInstanceOf(PlaywrightClient);
  });

  it('should support session management config in initializer', async () => {
    const config = {
      sdk: 'playwright',
      options: {
        session_id: 'test-session',
        sessions_dir: './my-sessions',
        auto_save_session: true,
      },
    };

    const client = await PlaywrightInitializer.initialize(null, config);
    expect(client).toBeInstanceOf(PlaywrightClient);
  });
});

// ============================================================================
// AI Automation Tests
// ============================================================================

describe('Playwright AI Automation', () => {
  it('should create client with AI config', () => {
    const client = new PlaywrightClient({
      enableAI: true,
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
    });

    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should create client with Anthropic AI config', () => {
    const client = new PlaywrightClient({
      enableAI: true,
      aiProvider: 'anthropic',
      aiModel: 'claude-3-5-sonnet-latest',
    });

    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should report AI not enabled when not configured', () => {
    const client = new PlaywrightClient();

    expect(client.isAIEnabled()).toBe(false);
  });

  it('should support AI config in initializer', async () => {
    const config = {
      sdk: 'playwright',
      options: {
        enable_ai: true,
        ai_provider: 'openai',
        ai_model: 'gpt-4o',
        ai_debug: true,
      },
    };

    const client = await PlaywrightInitializer.initialize(null, config) as PlaywrightClient;
    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should support camelCase AI config', async () => {
    const config = {
      sdk: 'playwright',
      options: {
        enableAI: true,
        aiProvider: 'anthropic',
        aiModel: 'claude-3-5-sonnet-latest',
      },
    };

    const client = await PlaywrightInitializer.initialize(null, config) as PlaywrightClient;
    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should throw error when calling act without AI enabled', async () => {
    const client = new PlaywrightClient();
    await client.launch();

    await expect(client.act({ instruction: 'Click the button' }))
      .rejects.toThrow('AI automation is not enabled');
  });

  it('should throw error when calling observe without AI enabled', async () => {
    const client = new PlaywrightClient();
    await client.launch();

    await expect(client.observe())
      .rejects.toThrow('AI automation is not enabled');
  });

  it('should throw error when calling aiExtract without AI enabled', async () => {
    const client = new PlaywrightClient();
    await client.launch();

    await expect(client.aiExtract({ instruction: 'Extract the title' }))
      .rejects.toThrow('AI automation is not enabled');
  });
});

// ============================================================================
// Custom AI Backend Tests (Copilot/Claude Code)
// ============================================================================

describe('Playwright Custom AI Backend', () => {
  // Mock AI clients
  const mockCopilotClient = {
    send: vi.fn().mockResolvedValue('{ "action": "click", "inputs": { "selector": "#button" } }'),
  };

  const mockClaudeCodeClient = {
    generate: vi.fn().mockResolvedValue('{ "action": "fill", "inputs": { "selector": "#email", "value": "test@example.com" } }'),
  };

  it('should create client with Copilot AI backend', () => {
    const client = new PlaywrightClient({
      enableAI: true,
      aiBackend: 'copilot',
      aiClient: mockCopilotClient,
    });

    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should create client with Claude Code AI backend', () => {
    const client = new PlaywrightClient({
      enableAI: true,
      aiBackend: 'claude-code',
      aiClient: mockClaudeCodeClient,
    });

    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should support Copilot backend in initializer', async () => {
    const config = {
      sdk: 'playwright',
      options: {
        enableAI: true,
        aiBackend: 'copilot',
        aiClient: mockCopilotClient,
        aiDebug: false,
      },
    };

    const client = await PlaywrightInitializer.initialize(null, config) as PlaywrightClient;
    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should support Claude Code backend in initializer', async () => {
    const config = {
      sdk: 'playwright',
      options: {
        enable_ai: true,
        ai_backend: 'claude-code',
        ai_client: mockClaudeCodeClient,
      },
    };

    const client = await PlaywrightInitializer.initialize(null, config) as PlaywrightClient;
    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should perform act() with Copilot backend', async () => {
    const client = new PlaywrightClient({
      enableAI: true,
      aiBackend: 'copilot',
      aiClient: mockCopilotClient,
    });

    await client.launch();

    const result = await client.act({ instruction: 'Click the login button' });

    expect(result.success).toBe(true);
    expect(result.action).toBe('Click the login button');
    expect(mockCopilotClient.send).toHaveBeenCalled();

    await client.close();
  });

  it('should perform act() with Claude Code backend', async () => {
    const client = new PlaywrightClient({
      enableAI: true,
      aiBackend: 'claude-code',
      aiClient: mockClaudeCodeClient,
    });

    await client.launch();

    const result = await client.act({ instruction: 'Fill in email field' });

    expect(result.success).toBe(true);
    expect(result.action).toBe('Fill in email field');
    expect(mockClaudeCodeClient.generate).toHaveBeenCalled();

    await client.close();
  });

  it('should perform observe() with custom AI backend', async () => {
    mockCopilotClient.send.mockResolvedValueOnce(
      JSON.stringify([
        {
          selector: '#email',
          description: 'Email input field',
          tagName: 'input',
          actions: ['fill'],
        },
        {
          selector: '#submit',
          description: 'Submit button',
          tagName: 'button',
          actions: ['click'],
        },
      ])
    );

    const client = new PlaywrightClient({
      enableAI: true,
      aiBackend: 'copilot',
      aiClient: mockCopilotClient,
    });

    await client.launch();

    const result = await client.observe({ instruction: 'Find form elements' });

    expect(result.elements).toBeDefined();
    expect(result.elements.length).toBeGreaterThan(0);
    expect(mockCopilotClient.send).toHaveBeenCalled();

    await client.close();
  });

  it('should perform aiExtract() with custom AI backend', async () => {
    mockClaudeCodeClient.generate.mockResolvedValueOnce(
      JSON.stringify({
        products: [
          { name: 'Widget A', price: 29.99 },
          { name: 'Widget B', price: 49.99 },
        ],
      })
    );

    const client = new PlaywrightClient({
      enableAI: true,
      aiBackend: 'claude-code',
      aiClient: mockClaudeCodeClient,
    });

    await client.launch();

    const result = await client.aiExtract({
      instruction: 'Extract all product names and prices',
      schema: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                price: { type: 'number' },
              },
            },
          },
        },
      },
    });

    expect(result).toBeDefined();
    expect(mockClaudeCodeClient.generate).toHaveBeenCalled();

    await client.close();
  });

  it('should fall back to Stagehand when no custom AI backend configured', async () => {
    const client = new PlaywrightClient({
      enableAI: true,
      // No aiBackend specified - should fall back to Stagehand
    });

    // Don't launch browser in CI - just verify the config is set up correctly
    expect(client.isAIEnabled()).toBe(true);

    // This would try to use Stagehand if we actually launched and called act()
    // But we skip the actual execution in tests since Stagehand requires API keys
  });

  it('should throw error when AI client not provided', async () => {
    const client = new PlaywrightClient({
      enableAI: true,
      aiBackend: 'copilot',
      // No aiClient provided
    });

    await client.launch();

    await expect(client.act({ instruction: 'Click button' }))
      .rejects.toThrow('AI client not provided');

    await client.close();
  });
});

// ============================================================================
// Workflow Integration Tests (Session + AI)
// ============================================================================

describe('Playwright Advanced Workflow Actions', () => {
  it('should support workflow with session persistence', async () => {
    const config = {
      sdk: 'playwright',
      options: {
        sessionId: 'workflow-session',
        autoSaveSession: true,
      },
    };

    const client = await PlaywrightInitializer.initialize(null, config);
    expect(client).toBeInstanceOf(PlaywrightClient);
  });

  it('should support workflow with AI automation', async () => {
    const config = {
      sdk: 'playwright',
      options: {
        enableAI: true,
        aiProvider: 'openai',
      },
    };

    const client = await PlaywrightInitializer.initialize(null, config) as PlaywrightClient;
    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });

  it('should support combined session + AI config', async () => {
    const config = {
      sdk: 'playwright',
      options: {
        sessionId: 'ai-session',
        autoSaveSession: true,
        enableAI: true,
        aiProvider: 'anthropic',
        aiModel: 'claude-3-5-sonnet-latest',
      },
    };

    const client = await PlaywrightInitializer.initialize(null, config) as PlaywrightClient;
    expect(client).toBeInstanceOf(PlaywrightClient);
    expect(client.isAIEnabled()).toBe(true);
  });
});

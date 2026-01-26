/**
 * AI Browser Automation Client
 *
 * Provides AI-powered browser automation using GitHub Copilot or Claude Code SDK
 * as backends instead of relying on external API services.
 *
 * This integrates with marktoflow's existing AI adapters to provide natural language
 * browser control without additional API costs.
 */

import type { PlaywrightClient } from './playwright.js';
import type { GitHubCopilotClient } from '../adapters/github-copilot.js';
import type { ClaudeCodeClient } from '../adapters/claude-code.js';

// ============================================================================
// Types
// ============================================================================

export type AIBackend = 'copilot' | 'claude-code';

export interface AIBrowserConfig {
  /** AI backend to use */
  backend: AIBackend;
  /** AI client instance */
  aiClient: GitHubCopilotClient | ClaudeCodeClient;
  /** Playwright client instance */
  playwrightClient: PlaywrightClient;
  /** Enable debug logging */
  debug?: boolean;
}

export interface ActOptions {
  /** Natural language action to perform */
  action: string;
}

export interface ActResult {
  success: boolean;
  message: string;
  action: string;
}

export interface ObserveOptions {
  /** Optional instruction to filter observations */
  instruction?: string;
}

export interface ObservedElement {
  selector?: string;
  description?: string;
  tagName?: string;
  text?: string;
  actions?: string[];
}

export interface AIExtractOptions {
  /** Natural language instruction for what to extract */
  instruction: string;
  /** JSON schema for structured extraction */
  schema?: Record<string, unknown>;
}

// ============================================================================
// AI Browser Client
// ============================================================================

/**
 * AI-powered browser automation client
 *
 * Uses GitHub Copilot or Claude Code SDK for AI reasoning instead of
 * external API services like OpenAI or Anthropic.
 */
export class AIBrowserClient {
  private backend: AIBackend;
  private aiClient: GitHubCopilotClient | ClaudeCodeClient;
  private playwrightClient: PlaywrightClient;
  private debug: boolean;

  constructor(config: AIBrowserConfig) {
    this.backend = config.backend;
    this.aiClient = config.aiClient;
    this.playwrightClient = config.playwrightClient;
    this.debug = config.debug ?? false;
  }

  /**
   * Perform an action described in natural language
   *
   * @example
   * await client.act({ action: 'Click the login button' });
   * await client.act({ action: 'Type "john@example.com" into the email field' });
   */
  async act(options: ActOptions): Promise<ActResult> {
    try {
      // Get current page context
      const pageInfo = await this.playwrightClient.pageInfo(false);

      const prompt = this.buildActPrompt(options.action, pageInfo.url, pageInfo.title);

      if (this.debug) {
        console.log('[AI Browser] Act prompt:', prompt);
      }

      // Query AI backend
      const response = await this.queryAI(prompt);

      if (this.debug) {
        console.log('[AI Browser] AI response:', response);
      }

      // Parse AI response
      const parsedAction = this.parseActionResponse(response);

      if (!parsedAction) {
        throw new Error('Failed to parse AI response');
      }

      // Execute the action via Playwright
      await this.executeAction(parsedAction);

      return {
        success: true,
        message: `Executed: ${options.action}`,
        action: options.action,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        action: options.action,
      };
    }
  }

  /**
   * Observe the current page and identify available actions
   *
   * @example
   * const elements = await client.observe({ instruction: 'Find all form inputs' });
   */
  async observe(options?: ObserveOptions): Promise<ObservedElement[]> {
    try {
      // Get page content
      const pageInfo = await this.playwrightClient.pageInfo(true);

      const prompt = this.buildObservePrompt(
        pageInfo.content || '',
        pageInfo.url,
        options?.instruction
      );

      if (this.debug) {
        console.log('[AI Browser] Observe prompt:', prompt.slice(0, 500) + '...');
      }

      const response = await this.queryAI(prompt);

      if (this.debug) {
        console.log('[AI Browser] AI response:', response);
      }

      // Parse elements from AI response
      return this.parseObserveResponse(response);
    } catch (error) {
      console.error('[AI Browser] Observe error:', error);
      return [];
    }
  }

  /**
   * Extract structured data using AI
   *
   * @example
   * const data = await client.aiExtract({
   *   instruction: 'Extract all product names and prices',
   *   schema: {
   *     type: 'object',
   *     properties: {
   *       products: {
   *         type: 'array',
   *         items: {
   *           type: 'object',
   *           properties: {
   *             name: { type: 'string' },
   *             price: { type: 'number' }
   *           }
   *         }
   *       }
   *     }
   *   }
   * });
   */
  async aiExtract(options: AIExtractOptions): Promise<{ data: unknown }> {
    try {
      // Get page content
      const pageInfo = await this.playwrightClient.pageInfo(true);

      const prompt = this.buildExtractPrompt(
        pageInfo.content || '',
        pageInfo.url,
        options.instruction,
        options.schema
      );

      if (this.debug) {
        console.log('[AI Browser] Extract prompt:', prompt.slice(0, 500) + '...');
      }

      const response = await this.queryAI(prompt);

      if (this.debug) {
        console.log('[AI Browser] AI response:', response);
      }

      // Parse extracted data
      const data = this.parseExtractResponse(response);

      return { data };
    } catch (error) {
      throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // Private Methods - AI Communication
  // ============================================================================

  private async queryAI(prompt: string): Promise<string> {
    if (this.backend === 'copilot') {
      const client = this.aiClient as GitHubCopilotClient;
      return await client.send({ prompt });
    } else {
      const client = this.aiClient as ClaudeCodeClient;
      return await client.generate({ prompt });
    }
  }

  // ============================================================================
  // Private Methods - Prompt Building
  // ============================================================================

  private buildActPrompt(action: string, url: string, title: string): string {
    return `You are an AI browser automation assistant. Convert natural language actions to Playwright commands.

Current Page:
- URL: ${url}
- Title: ${title}

User Action: "${action}"

Available Playwright Actions:
- navigate: { url, waitUntil? }
- click: { selector, button?, force? }
- type: { selector, text, delay?, clear? }
- fill: { selector, value }
- select: { selector, values }
- check: { selector }
- uncheck: { selector }
- hover: { selector }
- press: { selector, key }
- wait: { selector?, url?, loadState?, timeout? }

IMPORTANT:
1. Return ONLY valid JSON in this exact format:
   { "action": "click", "inputs": { "selector": "#button" } }
2. Choose the most appropriate selector (id, class, text, or CSS selector)
3. For typing text, use "fill" for instant input or "type" for keyboard simulation
4. For navigation, use "navigate"
5. NO explanatory text, ONLY the JSON object

Example Responses:
- "Click the login button" -> { "action": "click", "inputs": { "selector": "button:has-text('Login')" } }
- "Type email@example.com in the email field" -> { "action": "fill", "inputs": { "selector": "input[type='email']", "value": "email@example.com" } }
- "Select 'United States' from country dropdown" -> { "action": "select", "inputs": { "selector": "#country", "values": "United States" } }

Now convert this action to JSON:
"${action}"

JSON:`;
  }

  private buildObservePrompt(htmlContent: string, url: string, instruction?: string): string {
    // Limit HTML content to avoid token limits
    const maxLength = 15000;
    const truncatedHtml = htmlContent.length > maxLength
      ? htmlContent.slice(0, maxLength) + '\n... (truncated)'
      : htmlContent;

    return `You are analyzing a web page to identify interactive elements.

Current Page URL: ${url}

${instruction ? `Focus: ${instruction}\n` : ''}
HTML Content:
${truncatedHtml}

Analyze the page and identify interactive elements (buttons, links, inputs, forms, etc.).

Return a JSON array of elements in this exact format:
[
  {
    "selector": "CSS selector for the element",
    "description": "What this element does",
    "tagName": "HTML tag name",
    "text": "visible text if any",
    "actions": ["click", "fill", "select", etc.]
  }
]

IMPORTANT:
1. Return ONLY valid JSON array, no explanatory text
2. Provide actionable CSS selectors (id, class, or text-based)
3. Include only interactive elements that can be automated
4. Limit to the 10 most important elements
5. For forms, identify input fields, buttons, and selects

JSON Array:`;
  }

  private buildExtractPrompt(
    htmlContent: string,
    url: string,
    instruction: string,
    schema?: Record<string, unknown>
  ): string {
    const maxLength = 15000;
    const truncatedHtml = htmlContent.length > maxLength
      ? htmlContent.slice(0, maxLength) + '\n... (truncated)'
      : htmlContent;

    return `You are extracting structured data from a web page.

Current Page URL: ${url}

Extraction Task: ${instruction}

${schema ? `Expected JSON Schema:\n${JSON.stringify(schema, null, 2)}\n` : ''}
HTML Content:
${truncatedHtml}

Extract the requested data and return it as valid JSON.

IMPORTANT:
1. Return ONLY valid JSON, no explanatory text
2. Follow the provided schema if given
3. Extract accurate data from the HTML
4. Use null for missing values
5. Ensure all property names match the schema

JSON:`;
  }

  // ============================================================================
  // Private Methods - Response Parsing
  // ============================================================================

  private parseActionResponse(response: string): { action: string; inputs: Record<string, unknown> } | null {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[AI Browser] No JSON found in response:', response);
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.action || !parsed.inputs) {
        console.error('[AI Browser] Invalid action format:', parsed);
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('[AI Browser] Failed to parse action:', error, response);
      return null;
    }
  }

  private parseObserveResponse(response: string): ObservedElement[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[AI Browser] No JSON array found in response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed)) {
        console.error('[AI Browser] Response is not an array');
        return [];
      }

      return parsed;
    } catch (error) {
      console.error('[AI Browser] Failed to parse observe response:', error);
      return [];
    }
  }

  private parseExtractResponse(response: string): unknown {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse extraction response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // Private Methods - Action Execution
  // ============================================================================

  private async executeAction(action: { action: string; inputs: Record<string, unknown> }): Promise<void> {
    const { action: actionName, inputs } = action;

    // Map action names to Playwright client methods
    switch (actionName) {
      case 'navigate':
        await this.playwrightClient.navigate(inputs as { url: string });
        break;
      case 'click':
        await this.playwrightClient.click(inputs as { selector: string });
        break;
      case 'type':
        await this.playwrightClient.type(inputs as { selector: string; text: string });
        break;
      case 'fill':
        await this.playwrightClient.fill(inputs as { selector: string; value: string });
        break;
      case 'select':
        await this.playwrightClient.select(inputs as { selector: string; values: string | string[] });
        break;
      case 'check': {
        const checkInputs = inputs as { selector: string };
        await this.playwrightClient.check(checkInputs.selector);
        break;
      }
      case 'uncheck': {
        const uncheckInputs = inputs as { selector: string };
        await this.playwrightClient.uncheck(uncheckInputs.selector);
        break;
      }
      case 'hover': {
        const hoverInputs = inputs as { selector: string };
        await this.playwrightClient.hover(hoverInputs.selector);
        break;
      }
      case 'press': {
        const pressInputs = inputs as { selector: string; key: string };
        await this.playwrightClient.press(pressInputs.selector, pressInputs.key);
        break;
      }
      case 'wait':
        await this.playwrightClient.wait(inputs as Record<string, unknown>);
        break;
      default:
        throw new Error(`Unsupported action: ${actionName}`);
    }
  }
}

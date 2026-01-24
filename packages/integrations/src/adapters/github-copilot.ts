import { CopilotClient, SessionEvent } from '@github/copilot-sdk';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

type LogLevel = 'info' | 'none' | 'error' | 'warning' | 'debug' | 'all';

/**
 * GitHub Copilot adapter client that wraps CopilotClient
 * and provides a simplified interface for marktoflow workflows.
 */
export class GitHubCopilotClient {
  private client: CopilotClient;
  private defaultModel: string;

  constructor(
    options: {
      cliPath?: string;
      model?: string;
      cliUrl?: string;
      autoStart?: boolean;
      logLevel?: LogLevel;
    } = {}
  ) {
    // cliUrl and cliPath are mutually exclusive
    const clientConfig: {
      cliPath?: string;
      cliUrl?: string;
      autoStart?: boolean;
      logLevel?: LogLevel;
    } = {
      autoStart: options.autoStart ?? true,
      logLevel: options.logLevel || 'info',
    };

    if (options.cliUrl) {
      // When connecting to external server, don't set cliPath
      clientConfig.cliUrl = options.cliUrl;
    } else {
      // When spawning CLI, set cliPath
      clientConfig.cliPath = options.cliPath || 'copilot';
    }

    this.client = new CopilotClient(clientConfig);
    this.defaultModel = options.model || 'gpt-4.1';
  }

  /**
   * Send a message to Copilot and wait for the complete response.
   */
  async send(inputs: {
    prompt: string;
    model?: string;
    attachments?: Array<{
      type: 'file' | 'directory';
      path: string;
      displayName?: string;
    }>;
    systemMessage?: string;
  }): Promise<string> {
    const session = await this.client.createSession({
      model: inputs.model || this.defaultModel,
      systemMessage: inputs.systemMessage
        ? {
            content: inputs.systemMessage,
          }
        : undefined,
    });

    try {
      const response = await session.sendAndWait({
        prompt: inputs.prompt,
        attachments: inputs.attachments,
      });

      return response?.data.content || '';
    } finally {
      await session.destroy();
    }
  }

  /**
   * Send a message to Copilot and stream the response.
   * Returns the full response after streaming completes.
   */
  async stream(inputs: {
    prompt: string;
    model?: string;
    attachments?: Array<{
      type: 'file' | 'directory';
      path: string;
      displayName?: string;
    }>;
    systemMessage?: string;
    onChunk?: (chunk: string) => void;
    onComplete?: (fullResponse: string) => void;
  }): Promise<string> {
    const session = await this.client.createSession({
      model: inputs.model || this.defaultModel,
      streaming: true,
      systemMessage: inputs.systemMessage
        ? {
            content: inputs.systemMessage,
          }
        : undefined,
    });

    let fullResponse = '';

    return new Promise((resolve, reject) => {
      session.on((event: SessionEvent) => {
        if (event.type === 'assistant.message_delta') {
          const chunk = event.data.deltaContent;
          fullResponse += chunk;
          if (inputs.onChunk) {
            inputs.onChunk(chunk);
          }
        } else if (event.type === 'assistant.message') {
          // Final message received
          fullResponse = event.data.content || fullResponse;
        } else if (event.type === 'session.idle') {
          // Session finished processing
          if (inputs.onComplete) {
            inputs.onComplete(fullResponse);
          }
          session
            .destroy()
            .then(() => resolve(fullResponse))
            .catch(reject);
        } else if (event.type === 'session.error') {
          reject(new Error(event.data.message || 'Session error occurred'));
        }
      });

      // Send the message
      session
        .send({
          prompt: inputs.prompt,
          attachments: inputs.attachments,
        })
        .catch(reject);
    });
  }

  /**
   * Create a persistent session for multi-turn conversations.
   * Caller is responsible for managing session lifecycle.
   */
  async createSession(
    options: {
      model?: string;
      sessionId?: string;
      systemMessage?: string;
    } = {}
  ) {
    return this.client.createSession({
      model: options.model || this.defaultModel,
      sessionId: options.sessionId,
      systemMessage: options.systemMessage
        ? {
            content: options.systemMessage,
          }
        : undefined,
    });
  }

  /**
   * Stop the Copilot CLI client.
   */
  async stop(): Promise<void> {
    const errors = await this.client.stop();
    if (errors.length > 0) {
      throw new Error(`Errors during stop: ${errors.map((e) => e.message).join(', ')}`);
    }
  }

  /**
   * Ping the Copilot CLI to check connectivity.
   */
  async ping(): Promise<{ message: string; timestamp: number }> {
    return this.client.ping();
  }
}

/**
 * SDK Initializer for GitHub Copilot.
 * Supports both authentication via CLI path and external CLI server URL.
 */
export const GitHubCopilotInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};
    const auth = config.auth || {};

    return new GitHubCopilotClient({
      cliPath: (auth['cli_path'] as string) || (options['cliPath'] as string),
      cliUrl: (auth['cli_url'] as string) || (options['cliUrl'] as string),
      model: (options['model'] as string) || 'gpt-4.1',
      autoStart: (options['autoStart'] as boolean) ?? true,
      logLevel: (options['logLevel'] as LogLevel) || 'info',
    });
  },
};

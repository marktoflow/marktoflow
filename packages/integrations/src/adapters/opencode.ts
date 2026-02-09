import { spawn } from 'node:child_process';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { createOpencodeClient, OpencodeClient } from '@opencode-ai/sdk';

export class OpenCodeClient {
  private mode: 'cli' | 'server' | 'auto';
  private serverUrl: string;
  private cliPath: string;
  private model: string | undefined;
  // @ts-ignore - Stored for future SDK support
  private excludeFiles: string[] | undefined;
  private sdkClient: OpencodeClient | null = null;
  private currentSessionId: string | null = null;

  constructor(options: {
    mode?: 'cli' | 'server' | 'auto';
    serverUrl?: string;
    cliPath?: string;
    model?: string;
    excludeFiles?: string[];
    sessionId?: string;
  } = {}) {
    this.mode = options.mode || 'auto';
    this.serverUrl = options.serverUrl || 'http://localhost:4096';
    this.cliPath = options.cliPath || 'opencode';
    this.model = options.model;
    this.excludeFiles = options.excludeFiles;
    this.currentSessionId = options.sessionId || null;

    if (this.mode === 'server' || this.mode === 'auto') {
      this.sdkClient = createOpencodeClient({
        baseUrl: this.serverUrl,
      });
    }
  }

  async generate(inputs: { prompt: string } | string): Promise<string> {
    const prompt = typeof inputs === 'string' ? inputs : inputs.prompt;

    if (this.mode === 'server') {
      return this.generateViaServer(prompt);
    } else if (this.mode === 'cli') {
      return this.generateViaCli(prompt);
    } else {
      // Auto mode: try server, fall back to CLI
      try {
        return await this.generateViaServer(prompt);
      } catch (e) {
        return this.generateViaCli(prompt);
      }
    }
  }

  private async getOrCreateSession(): Promise<string> {
    if (!this.sdkClient) {
      throw new Error('OpenCode SDK client not initialized');
    }

    if (this.currentSessionId) {
      return this.currentSessionId;
    }

    const sessionRes = await this.sdkClient.session.create();
    if (sessionRes.error) {
      throw new Error(`Failed to create OpenCode session: ${JSON.stringify(sessionRes.error)}`);
    }
    const session = sessionRes.data;
    if (!session || !session.id) {
      throw new Error('Failed to create OpenCode session: No session ID returned');
    }

    this.currentSessionId = session.id;
    return session.id;
  }

  private async generateViaServer(prompt: string): Promise<string> {
    if (!this.sdkClient) {
      throw new Error('OpenCode SDK client not initialized');
    }

    const sessionId = await this.getOrCreateSession();

    // Use session.prompt() with SDK v1.1.53 API
    const response = await this.sdkClient.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text' as const, text: prompt }],
      },
    });

    if (response.error) {
      throw new Error(`Failed to generate response: ${JSON.stringify(response.error)}`);
    }

    const data = response.data as any;

    // Extract text from parts
    if (data.parts) {
      return data.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text || '')
        .join('');
    }
    if (data.text) {
      return data.text;
    }
    return JSON.stringify(data);
  }

  private async generateViaCli(prompt: string): Promise<string> {
    const args = ['run'];
    if (this.model) {
      args.push('--model', this.model);
    }
    args.push(prompt);

    return new Promise((resolve, reject) => {
      const process = spawn(this.cliPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', d => {
        stdout += d.toString();
      });
      process.stderr.on('data', d => {
        stderr += d.toString();
      });

      process.on('close', code => {
        if (code === 0) {
           let output = stdout.trim();
           // Strip <output> tags if present
           if (output.startsWith('<output>') && output.endsWith('</output>')) {
             output = output.slice(8, -9).trim();
           }
           resolve(output);
        } else {
           reject(new Error(`OpenCode CLI failed (exit code ${code})\nSTDERR: ${stderr}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------

  async listSessions(): Promise<any[]> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const res = await this.sdkClient.session.list();
    if (res.error) throw new Error(`Failed to list sessions: ${JSON.stringify(res.error)}`);
    return (res.data as any) || [];
  }

  async getSession(sessionId: string): Promise<any> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const res = await this.sdkClient.session.get({ path: { id: sessionId } });
    if (res.error) throw new Error(`Failed to get session: ${JSON.stringify(res.error)}`);
    return res.data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const res = await this.sdkClient.session.delete({ path: { id: sessionId } });
    if (res.error) throw new Error(`Failed to delete session: ${JSON.stringify(res.error)}`);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  async abort(sessionId?: string): Promise<void> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const id = sessionId || this.currentSessionId;
    if (!id) throw new Error('No session ID provided or available');
    const res = await this.sdkClient.session.abort({ path: { id } });
    if (res.error) throw new Error(`Failed to abort session: ${JSON.stringify(res.error)}`);
  }

  async getMessages(sessionId?: string): Promise<any[]> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const id = sessionId || this.currentSessionId;
    if (!id) throw new Error('No session ID provided or available');
    const res = await this.sdkClient.session.messages({ path: { id } });
    if (res.error) throw new Error(`Failed to get messages: ${JSON.stringify(res.error)}`);
    return (res.data as any) || [];
  }

  async share(sessionId?: string): Promise<any> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const id = sessionId || this.currentSessionId;
    if (!id) throw new Error('No session ID provided or available');
    const res = await this.sdkClient.session.share({ path: { id } });
    if (res.error) throw new Error(`Failed to share session: ${JSON.stringify(res.error)}`);
    return res.data;
  }

  async unshare(sessionId?: string): Promise<void> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const id = sessionId || this.currentSessionId;
    if (!id) throw new Error('No session ID provided or available');
    const res = await this.sdkClient.session.unshare({ path: { id } });
    if (res.error) throw new Error(`Failed to unshare session: ${JSON.stringify(res.error)}`);
  }

  async summarize(sessionId?: string): Promise<any> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const id = sessionId || this.currentSessionId;
    if (!id) throw new Error('No session ID provided or available');
    const res = await this.sdkClient.session.summarize({ path: { id } });
    if (res.error) throw new Error(`Failed to summarize session: ${JSON.stringify(res.error)}`);
    return res.data;
  }

  // --------------------------------------------------------------------------
  // App Info
  // --------------------------------------------------------------------------

  async listProviders(): Promise<any> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const res = await this.sdkClient.config.providers();
    if (res.error) throw new Error(`Failed to list providers: ${JSON.stringify(res.error)}`);
    return res.data;
  }

  async listAgents(): Promise<any> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const res = await this.sdkClient.app.agents();
    if (res.error) throw new Error(`Failed to list agents: ${JSON.stringify(res.error)}`);
    return res.data;
  }

  async getConfig(): Promise<any> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    const res = await this.sdkClient.config.get();
    if (res.error) throw new Error(`Failed to get config: ${JSON.stringify(res.error)}`);
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Code Search
  // --------------------------------------------------------------------------

  search = {
    text: async (pattern: string): Promise<any> => {
      if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
      const res = await this.sdkClient.find.text({ query: { pattern } });
      if (res.error) throw new Error(`Failed to search text: ${JSON.stringify(res.error)}`);
      return res.data;
    },
    files: async (query: string): Promise<any> => {
      if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
      const res = await this.sdkClient.find.files({ query: { query } });
      if (res.error) throw new Error(`Failed to search files: ${JSON.stringify(res.error)}`);
      return res.data;
    },
    symbols: async (query: string): Promise<any> => {
      if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
      const res = await this.sdkClient.find.symbols({ query: { query } });
      if (res.error) throw new Error(`Failed to search symbols: ${JSON.stringify(res.error)}`);
      return res.data;
    },
  };

  // --------------------------------------------------------------------------
  // File Operations
  // --------------------------------------------------------------------------

  file = {
    read: async (path: string): Promise<any> => {
      if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
      const res = await this.sdkClient.file.read({ query: { path } });
      if (res.error) throw new Error(`Failed to read file: ${JSON.stringify(res.error)}`);
      return res.data;
    },
    status: async (): Promise<any> => {
      if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
      const res = await this.sdkClient.file.status();
      if (res.error) throw new Error(`Failed to get file status: ${JSON.stringify(res.error)}`);
      return res.data;
    },
  };

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  async streamEvents(): Promise<any> {
    if (!this.sdkClient) throw new Error('OpenCode SDK client not initialized');
    return this.sdkClient.event.subscribe();
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * OpenAI-compatible chat interface for workflow compatibility
   */
  chat = {
    completions: async (inputs: {
      model?: string;
      messages: Array<{ role: string; content: string }>;
    }): Promise<{ choices: Array<{ message: { content: string } }> }> => {
      // Combine system + user messages
      let combinedPrompt = '';
      for (const msg of inputs.messages) {
        if (msg.role === 'system') {
          combinedPrompt += msg.content + '\n\n';
        } else if (msg.role === 'user') {
          combinedPrompt += msg.content;
        }
      }

      const response = await this.generate({
        prompt: combinedPrompt,
      });

      return {
        choices: [
          {
            message: {
              content: response,
            },
          },
        ],
      };
    },
  };
}

export const OpenCodeInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};
    return new OpenCodeClient({
      mode: options['mode'] as 'cli' | 'server' | 'auto',
      serverUrl: options['serverUrl'] as string,
      cliPath: options['cliPath'] as string,
      model: options['model'] as string,
      excludeFiles: options['excludeFiles'] as string[],
      sessionId: options['sessionId'] as string,
    });
  },
};

import { spawn } from 'node:child_process';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { createOpencodeClient, OpencodeClient } from '@opencode-ai/sdk';

export class OpenCodeClient {
  private mode: 'cli' | 'server' | 'auto';
  private serverUrl: string;
  private cliPath: string;
  private sdkClient: OpencodeClient | null = null;

  constructor(options: {
    mode?: 'cli' | 'server' | 'auto';
    serverUrl?: string;
    cliPath?: string;
  } = {}) {
    this.mode = options.mode || 'auto';
    this.serverUrl = options.serverUrl || 'http://localhost:4096';
    this.cliPath = options.cliPath || 'opencode';
    
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

  private async generateViaServer(prompt: string): Promise<string> {
    if (!this.sdkClient) {
      throw new Error('OpenCode SDK client not initialized');
    }

    // Create session
    const sessionRes = await this.sdkClient.session.create();
    if (sessionRes.error) {
      throw new Error(`Failed to create OpenCode session: ${JSON.stringify(sessionRes.error)}`);
    }
    const session = sessionRes.data;
    if (!session || !session.id) {
       throw new Error('Failed to create OpenCode session: No session ID returned');
    }
     
    // Send message
    const response = await this.sdkClient.session.prompt({
      path: { id: session.id },
      body: {
        parts: [{ type: 'text', text: prompt }]
      }
    });
     
    if (response.error) {
      throw new Error(`Failed to generate response: ${JSON.stringify(response.error)}`);
    }
     
    const data = response.data as any;
     
    // Extract text
    if (data.parts) {
      return data.parts.map((p: any) => p.text || '').join('');
    }
    if (data.text) {
      return data.text;
    }
    return JSON.stringify(data);
  }

  private async generateViaCli(prompt: string): Promise<string> {
    const args = ['run', prompt];
    
    return new Promise((resolve, reject) => {
      const process = spawn(this.cliPath, args);
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', d => stdout += d.toString());
      process.stderr.on('data', d => stderr += d.toString());
      
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
      
      process.on('error', reject);
    });
  }
}

export const OpenCodeInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};
    return new OpenCodeClient({
      mode: options['mode'] as 'cli' | 'server' | 'auto',
      serverUrl: options['serverUrl'] as string,
      cliPath: options['cliPath'] as string,
    });
  },
};

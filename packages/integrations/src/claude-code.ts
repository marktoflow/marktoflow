import { spawn } from 'node:child_process';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export class ClaudeCodeClient {
  constructor(private options: {
    cliPath?: string;
    model?: string;
    cwd?: string;
    timeout?: number;
  } = {}) {}

  async generate(inputs: { prompt: string; model?: string } | string): Promise<string> {
    const prompt = typeof inputs === 'string' ? inputs : inputs.prompt;
    const modelOverride = typeof inputs === 'string' ? undefined : inputs.model;

    const cliPath = this.options.cliPath || 'claude';
    const cwd = this.options.cwd || process.cwd();
    const timeout = this.options.timeout || 120000;
    
    const args = ['-p', prompt];
    const model = modelOverride || this.options.model;
    if (model) {
      args.push('--model', model);
    }

    return new Promise((resolve, reject) => {
      const process = spawn(cliPath, args, { cwd });
      
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => { stdout += data.toString(); });
      process.stderr.on('data', (data) => { stderr += data.toString(); });

      const timeoutId = setTimeout(() => {
        process.kill();
        reject(new Error(`Claude Code CLI timed out after ${timeout}ms`));
      }, timeout);

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          // Check if stderr contains useful info even if code != 0
          reject(new Error(`Claude Code CLI failed (exit code ${code})\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
        }
      });

      process.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }
}

export const ClaudeCodeInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};
    return new ClaudeCodeClient({
      cliPath: options['cliPath'] as string,
      model: options['model'] as string,
      cwd: options['cwd'] as string,
      timeout: options['timeout'] as number,
    });
  },
};

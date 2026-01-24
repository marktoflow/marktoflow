import { spawn } from 'node:child_process';
import { join, isAbsolute } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

export interface ScriptOperation {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  timeout?: number;
}

export interface ScriptToolConfig {
  script: string;
  description?: string;
  operations?: Record<string, ScriptOperation>;
  timeout?: number;
  env?: Record<string, string>;
}

export class ScriptTool {
  private scriptPath: string;
  private config: ScriptToolConfig;
  private isMultiOperation: boolean = false;

  constructor(scriptPath: string, toolsDir?: string) {
    this.scriptPath = isAbsolute(scriptPath) ? scriptPath : (toolsDir ? join(toolsDir, scriptPath) : scriptPath);
    this.config = this.loadMetadata();
  }

  private loadMetadata(): ScriptToolConfig {
    const yamlPath = this.scriptPath.replace(/\.[^/.]+$/, "") + ".yaml";
    let config: ScriptToolConfig = { script: this.scriptPath };

    if (existsSync(yamlPath)) {
      try {
        const content = readFileSync(yamlPath, 'utf-8');
        const data = parse(content);
        config = { ...config, ...data };
        if (config.operations && Object.keys(config.operations).length > 0) {
          this.isMultiOperation = true;
        }
      } catch (e) {
        console.warn(`Failed to parse script metadata at ${yamlPath}: ${e}`);
      }
    }

    return config;
  }

  async execute(operation: string, params: Record<string, any>): Promise<any> {
    const args: string[] = [];

    if (this.isMultiOperation) {
      args.push(operation);
    }

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'boolean') {
        if (value) args.push(`--${key}`);
      } else if (typeof value === 'object') {
        args.push(`--${key}=${JSON.stringify(value)}`);
      } else {
        args.push(`--${key}=${value}`);
      }
    }

    const timeout = (this.config.operations?.[operation]?.timeout || this.config.timeout || 300) * 1000;
    const env = { ...process.env, ...this.config.env };

    return new Promise((resolve, reject) => {
      const proc = spawn(this.scriptPath, args, {
        env
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Script timed out after ${timeout}ms\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
      }, timeout);

      proc.on('close', code => {
        clearTimeout(timer);
        if (code === 0) {
          const output = stdout.trim();
          if (!output) {
            resolve({ success: true, stderr: stderr.trim() });
            return;
          }
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            resolve(output);
          }
        } else {
          reject(new Error(`Script failed with exit code ${code}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
        }
      });

      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}

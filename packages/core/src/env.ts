/**
 * Environment variable management for marktoflow.
 *
 * Loads environment variables from .env files with support for multiple locations
 * and provides utilities for accessing configuration values.
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import dotenv from 'dotenv';

let envLoaded = false;

export function findEnvFiles(cwd: string = process.cwd()): string[] {
  const envFiles: string[] = [];

  // 1. Home directory
  const homeEnv = join(homedir(), '.marktoflow', '.env');
  if (existsSync(homeEnv)) {
    envFiles.push(homeEnv);
  }

  // 2. Project root
  const projectRoot = findProjectRoot(cwd);
  if (projectRoot) {
    const rootEnv = join(projectRoot, '.env');
    if (existsSync(rootEnv)) {
      envFiles.push(rootEnv);
    }

    const marktoflowEnv = join(projectRoot, '.marktoflow', '.env');
    if (existsSync(marktoflowEnv)) {
      envFiles.push(marktoflowEnv);
    }
  } else {
    const cwdEnv = join(cwd, '.env');
    if (existsSync(cwdEnv)) {
      envFiles.push(cwdEnv);
    }
  }

  return envFiles;
}

export function findProjectRoot(startPath: string): string | null {
  let current = resolve(startPath);
  const home = homedir();

  while (true) {
    if (existsSync(join(current, 'marktoflow.yaml'))) return current;
    if (existsSync(join(current, '.marktoflow'))) return current;
    if (existsSync(join(current, 'package.json'))) return current;
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    if (existsSync(join(current, 'pyproject.toml'))) return current;
    if (existsSync(join(current, '.git'))) return current;

    const parent = dirname(current);
    if (parent === current || current === home) break;
    current = parent;
  }

  return null;
}

export function loadEnv(envFiles?: string[], override: boolean = false): Record<string, string> {
  const files = envFiles ?? findEnvFiles();
  const loaded: Record<string, string> = {};

  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    const contents = readFileSync(filePath, 'utf8');
    const parsed = dotenv.parse(contents);

    for (const [key, value] of Object.entries(parsed)) {
      loaded[key] = value;
      if (override || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  envLoaded = true;
  return loaded;
}

export function ensureEnvLoaded(): void {
  if (!envLoaded) {
    loadEnv();
  }
}

export function getEnv(
  key: string,
  defaultValue: string | null = null,
  required: boolean = false
): string | null {
  ensureEnvLoaded();
  const value = process.env[key];
  if (value === undefined) {
    if (required) {
      throw new Error(
        `Required environment variable '${key}' is not set. Please set it in your .env file or environment.`
      );
    }
    return defaultValue;
  }
  return value;
}

export function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = getEnv(key);
  if (value === null) return defaultValue;
  const normalized = value.toLowerCase();
  if (normalized === '') return false;
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

export function getEnvInt(key: string, defaultValue: number = 0): number {
  const value = getEnv(key);
  if (value === null) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function getEnvFloat(key: string, defaultValue: number = 0): number {
  const value = getEnv(key);
  if (value === null) return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function getEnvList(
  key: string,
  defaultValue: string[] = [],
  separator: string = ','
): string[] {
  const value = getEnv(key);
  if (value === null) return defaultValue;
  return value.split(separator).map((item) => item.trim()).filter(Boolean);
}

export class EnvConfig {
  // AI Provider API Keys
  static anthropicApiKey(): string | null {
    return getEnv('ANTHROPIC_API_KEY');
  }
  static openaiApiKey(): string | null {
    return getEnv('OPENAI_API_KEY');
  }
  static googleApiKey(): string | null {
    return getEnv('GOOGLE_API_KEY') || getEnv('GEMINI_API_KEY');
  }
  static cohereApiKey(): string | null {
    return getEnv('COHERE_API_KEY');
  }
  static mistralApiKey(): string | null {
    return getEnv('MISTRAL_API_KEY');
  }
  static groqApiKey(): string | null {
    return getEnv('GROQ_API_KEY');
  }
  static togetherApiKey(): string | null {
    return getEnv('TOGETHER_API_KEY');
  }
  static fireworksApiKey(): string | null {
    return getEnv('FIREWORKS_API_KEY');
  }
  static replicateApiKey(): string | null {
    return getEnv('REPLICATE_API_TOKEN');
  }
  static huggingfaceApiKey(): string | null {
    return getEnv('HUGGINGFACE_API_KEY') || getEnv('HF_TOKEN');
  }

  // Local LLM Configuration
  static ollamaHost(): string {
    return getEnv('OLLAMA_HOST', 'http://localhost:11434') ?? 'http://localhost:11434';
  }
  static ollamaModel(): string {
    return getEnv('OLLAMA_MODEL', 'llama3') ?? 'llama3';
  }
  static lmstudioHost(): string {
    return getEnv('LMSTUDIO_HOST', 'http://localhost:1234') ?? 'http://localhost:1234';
  }

  // Claude Code CLI Configuration
  static claudeCodeMode(): string {
    return getEnv('CLAUDE_CODE_MODE', 'cli') ?? 'cli';
  }
  static claudeCodeCliPath(): string {
    return getEnv('CLAUDE_CODE_CLI_PATH', 'claude') ?? 'claude';
  }
  static claudeCodeModel(): string {
    return getEnv('CLAUDE_CODE_MODEL', 'sonnet') ?? 'sonnet';
  }
  static claudeCodeTimeout(): number {
    return getEnvInt('CLAUDE_CODE_TIMEOUT', 300);
  }

  // OpenCode Configuration
  static opencodeServerUrl(): string {
    return getEnv('OPENCODE_SERVER_URL', 'http://localhost:4096') ?? 'http://localhost:4096';
  }
  static opencodeMode(): string {
    return getEnv('OPENCODE_MODE', 'auto') ?? 'auto';
  }

  // MCP Server Configuration
  static mcpServerUrl(): string | null {
    return getEnv('MCP_SERVER_URL');
  }

  // External Service Integrations
  static githubToken(): string | null {
    return getEnv('GITHUB_TOKEN') || getEnv('GH_TOKEN');
  }
  static gitlabToken(): string | null {
    return getEnv('GITLAB_TOKEN');
  }
  static jiraApiToken(): string | null {
    return getEnv('JIRA_API_TOKEN');
  }
  static jiraBaseUrl(): string | null {
    return getEnv('JIRA_BASE_URL');
  }
  static jiraEmail(): string | null {
    return getEnv('JIRA_EMAIL');
  }
  static slackToken(): string | null {
    return getEnv('SLACK_TOKEN') || getEnv('SLACK_BOT_TOKEN');
  }
  static slackWebhookUrl(): string | null {
    return getEnv('SLACK_WEBHOOK_URL');
  }
  static discordWebhookUrl(): string | null {
    return getEnv('DISCORD_WEBHOOK_URL');
  }
  static linearApiKey(): string | null {
    return getEnv('LINEAR_API_KEY');
  }
  static notionApiKey(): string | null {
    return getEnv('NOTION_API_KEY');
  }

  // Database and Queue Configuration
  static redisUrl(): string {
    return getEnv('REDIS_URL', 'redis://localhost:6379') ?? 'redis://localhost:6379';
  }
  static rabbitmqUrl(): string {
    return getEnv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672') ?? 'amqp://guest:guest@localhost:5672';
  }
  static databaseUrl(): string | null {
    return getEnv('DATABASE_URL');
  }

  // Application Configuration
  static logLevel(): string {
    return getEnv('MARKTOFLOW_LOG_LEVEL', 'INFO') ?? 'INFO';
  }
  static debug(): boolean {
    return getEnvBool('MARKTOFLOW_DEBUG', false);
  }
  static metricsPort(): number {
    return getEnvInt('MARKTOFLOW_METRICS_PORT', 9090);
  }
  static webhookPort(): number {
    return getEnvInt('MARKTOFLOW_WEBHOOK_PORT', 8080);
  }
  static stateDir(): string {
    return getEnv('MARKTOFLOW_STATE_DIR', '.marktoflow/state') ?? '.marktoflow/state';
  }
  static encryptionKey(): string | null {
    return getEnv('MARKTOFLOW_ENCRYPTION_KEY');
  }
  static maxConcurrentWorkflows(): number {
    return getEnvInt('MARKTOFLOW_MAX_CONCURRENT', 5);
  }
}

export const config = EnvConfig;

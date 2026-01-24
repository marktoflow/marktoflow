import { SDKRegistry } from '@marktoflow/core';
import { SlackInitializer } from './services/slack.js';
import { GitHubInitializer } from './services/github.js';
import { JiraInitializer } from './services/jira.js';
import { GmailInitializer } from './services/gmail.js';
import { OutlookInitializer } from './services/outlook.js';
import { OllamaInitializer } from './adapters/ollama.js';
import { ClaudeCodeInitializer } from './adapters/claude-code.js';
import { OpenCodeInitializer } from './adapters/opencode.js';
import { ScriptInitializer } from './tools/script.js';

export function registerIntegrations(registry: SDKRegistry) {
  registry.registerInitializer('@slack/web-api', SlackInitializer);
  registry.registerInitializer('@octokit/rest', GitHubInitializer);
  registry.registerInitializer('jira.js', JiraInitializer);
  registry.registerInitializer('googleapis', GmailInitializer);
  registry.registerInitializer('@microsoft/microsoft-graph-client', OutlookInitializer);
  registry.registerInitializer('ollama', OllamaInitializer);
  registry.registerInitializer('claude-code', ClaudeCodeInitializer);
  registry.registerInitializer('opencode', OpenCodeInitializer);
  registry.registerInitializer('script', ScriptInitializer);
}

export * from './services/slack.js';
export * from './services/github.js';
export * from './services/jira.js';
export * from './services/gmail.js';
export * from './services/outlook.js';
export * from './adapters/ollama.js';
export * from './adapters/claude-code.js';
export * from './adapters/opencode.js';
export * from './tools/script.js';

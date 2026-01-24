import { SDKRegistry } from '@marktoflow/core';
import { SlackInitializer } from './slack.js';
import { GitHubInitializer } from './github.js';
import { JiraInitializer } from './jira.js';
import { OllamaInitializer } from './ollama.js';
import { ClaudeCodeInitializer } from './claude-code.js';
import { OpenCodeInitializer } from './opencode.js';
import { ScriptInitializer } from './script.js';

export function registerIntegrations(registry: SDKRegistry) {
  registry.registerInitializer('@slack/web-api', SlackInitializer);
  registry.registerInitializer('@octokit/rest', GitHubInitializer);
  registry.registerInitializer('jira.js', JiraInitializer);
  registry.registerInitializer('ollama', OllamaInitializer);
  registry.registerInitializer('claude-code', ClaudeCodeInitializer);
  registry.registerInitializer('opencode', OpenCodeInitializer);
  registry.registerInitializer('script', ScriptInitializer);
}

export * from './slack.js';
export * from './github.js';
export * from './jira.js';
export * from './ollama.js';
export * from './claude-code.js';
export * from './opencode.js';
export * from './script.js';

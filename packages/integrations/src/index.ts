import { SDKRegistry } from '@marktoflow/core';

// Services
import { SlackInitializer } from './services/slack.js';
import { GitHubInitializer } from './services/github.js';
import { JiraInitializer } from './services/jira.js';
import { GmailInitializer } from './services/gmail.js';
import { OutlookInitializer } from './services/outlook.js';
import { LinearInitializer } from './services/linear.js';
import { NotionInitializer } from './services/notion.js';
import { DiscordInitializer } from './services/discord.js';
import { AirtableInitializer } from './services/airtable.js';
import { ConfluenceInitializer } from './services/confluence.js';
import { HttpInitializer } from './services/http.js';

// AI Adapters
import { OllamaInitializer } from './adapters/ollama.js';
import { ClaudeCodeInitializer } from './adapters/claude-code.js';
import { OpenCodeInitializer } from './adapters/opencode.js';

// Tools
import { ScriptInitializer } from './tools/script.js';

export function registerIntegrations(registry: SDKRegistry) {
  // Communication & Collaboration
  registry.registerInitializer('@slack/web-api', SlackInitializer);
  registry.registerInitializer('discord', DiscordInitializer);

  // Email
  registry.registerInitializer('googleapis', GmailInitializer);
  registry.registerInitializer('@microsoft/microsoft-graph-client', OutlookInitializer);

  // Project Management & Issue Tracking
  registry.registerInitializer('jira.js', JiraInitializer);
  registry.registerInitializer('linear', LinearInitializer);

  // Documentation & Knowledge
  registry.registerInitializer('notion', NotionInitializer);
  registry.registerInitializer('confluence', ConfluenceInitializer);

  // Developer Tools
  registry.registerInitializer('@octokit/rest', GitHubInitializer);

  // Data & Databases
  registry.registerInitializer('airtable', AirtableInitializer);

  // Generic HTTP
  registry.registerInitializer('http', HttpInitializer);

  // AI Adapters
  registry.registerInitializer('ollama', OllamaInitializer);
  registry.registerInitializer('claude-code', ClaudeCodeInitializer);
  registry.registerInitializer('opencode', OpenCodeInitializer);

  // Tools
  registry.registerInitializer('script', ScriptInitializer);
}

// Export all services
export * from './services/slack.js';
export * from './services/github.js';
export * from './services/jira.js';
export {
  GmailActions,
  GmailInitializer,
  GmailEmail,
  type GetEmailsOptions as GmailGetEmailsOptions,
  type GetEmailsResult as GmailGetEmailsResult,
  type SendEmailOptions as GmailSendEmailOptions,
  type CreateDraftOptions as GmailCreateDraftOptions,
} from './services/gmail.js';
export {
  GmailTrigger,
  type GmailTriggerConfig,
  type GmailTriggerPayload,
  type GmailPubSubMessage,
  createGmailWebhookHandler,
} from './services/gmail-trigger.js';
export {
  OutlookActions,
  OutlookInitializer,
  OutlookEmail,
  CalendarEvent,
  type GetEmailsOptions as OutlookGetEmailsOptions,
  type GetEmailsResult as OutlookGetEmailsResult,
  type SendEmailOptions as OutlookSendEmailOptions,
  type CreateDraftOptions as OutlookCreateDraftOptions,
} from './services/outlook.js';
export {
  OutlookTrigger,
  type OutlookTriggerConfig,
  type OutlookTriggerPayload,
  type GraphSubscription,
  type GraphNotification,
  createOutlookWebhookHandler,
} from './services/outlook-trigger.js';
export * from './services/linear.js';
export {
  NotionClient,
  NotionInitializer,
  NotionPage,
  NotionDatabase,
  NotionBlock,
  type CreatePageOptions as NotionCreatePageOptions,
  type QueryDatabaseOptions,
  type SearchOptions as NotionSearchOptions,
} from './services/notion.js';
export * from './services/discord.js';
export * from './services/airtable.js';
export * from './services/confluence.js';
export * from './services/http.js';

// Export triggers
export { SlackSocketTrigger } from './services/slack-socket.js';

// Export AI adapters
export * from './adapters/ollama.js';
export * from './adapters/claude-code.js';
export * from './adapters/opencode.js';

// Export tools
export * from './tools/script.js';

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
import { PlaywrightInitializer } from './services/playwright.js';
import { GoogleSheetsInitializer } from './services/google-sheets.js';
import { GoogleCalendarInitializer } from './services/google-calendar.js';
import { GoogleDriveInitializer } from './services/google-drive.js';
import { GoogleDocsInitializer } from './services/google-docs.js';
import { TelegramInitializer } from './services/telegram.js';
import { WhatsAppInitializer } from './services/whatsapp.js';
import { SupabaseInitializer } from './services/supabase.js';
import { PostgresInitializer } from './services/postgres.js';
import { MySQLInitializer } from './services/mysql.js';

// AI Adapters
import { OllamaInitializer } from './adapters/ollama.js';
import { ClaudeCodeInitializer } from './adapters/claude-code.js';
import { ClaudeAgentInitializer } from './adapters/claude-agent.js';
import { OpenCodeInitializer } from './adapters/opencode.js';
import { GitHubCopilotInitializer } from './adapters/github-copilot.js';
import { CodexInitializer } from './adapters/codex.js';

// Tools
import { ScriptInitializer } from './tools/script.js';

export function registerIntegrations(registry: SDKRegistry) {
  // Communication & Collaboration
  registry.registerInitializer('@slack/web-api', SlackInitializer);
  registry.registerInitializer('discord', DiscordInitializer);
  registry.registerInitializer('telegram', TelegramInitializer);
  registry.registerInitializer('whatsapp', WhatsAppInitializer);

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
  registry.registerInitializer('supabase', SupabaseInitializer);
  registry.registerInitializer('pg', PostgresInitializer);
  registry.registerInitializer('mysql2', MySQLInitializer);

  // Google Services
  registry.registerInitializer('google-sheets', GoogleSheetsInitializer);
  registry.registerInitializer('google-calendar', GoogleCalendarInitializer);
  registry.registerInitializer('google-drive', GoogleDriveInitializer);
  registry.registerInitializer('google-docs', GoogleDocsInitializer);

  // Generic HTTP
  registry.registerInitializer('http', HttpInitializer);

  // Browser Automation
  registry.registerInitializer('playwright', PlaywrightInitializer);

  // AI Adapters
  registry.registerInitializer('ollama', OllamaInitializer);
  registry.registerInitializer('claude-code', ClaudeCodeInitializer);
  registry.registerInitializer('claude-agent', ClaudeAgentInitializer);
  registry.registerInitializer('@anthropic-ai/claude-agent-sdk', ClaudeAgentInitializer);
  registry.registerInitializer('opencode', OpenCodeInitializer);
  registry.registerInitializer('github-copilot', GitHubCopilotInitializer);
  registry.registerInitializer('@github/copilot-sdk', GitHubCopilotInitializer);
  registry.registerInitializer('codex', CodexInitializer);
  registry.registerInitializer('@openai/codex-sdk', CodexInitializer);

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
export {
  DiscordClient,
  DiscordInitializer,
  type DiscordMessage,
  type DiscordChannel,
  type DiscordGuild,
  type SendMessageOptions as DiscordSendMessageOptions,
} from './services/discord.js';
export * from './services/airtable.js';
export * from './services/confluence.js';
export * from './services/http.js';
export * from './services/playwright.js';
export { AIBrowserClient, AIBrowserConfig, AIBackend } from './services/ai-browser.js';
export * from './services/google-sheets.js';
export * from './services/google-calendar.js';
export * from './services/google-drive.js';
export * from './services/google-docs.js';
export {
  TelegramClient,
  TelegramInitializer,
  type TelegramMessage,
  type TelegramUser,
  type SendMessageOptions as TelegramSendMessageOptions,
} from './services/telegram.js';
export {
  WhatsAppClient,
  WhatsAppInitializer,
  type WhatsAppMessage,
  type WhatsAppTemplate,
  type SendTextOptions as WhatsAppSendTextOptions,
  type SendTemplateOptions as WhatsAppSendTemplateOptions,
  type SendMediaOptions as WhatsAppSendMediaOptions,
  type SendLocationOptions as WhatsAppSendLocationOptions,
  type SendInteractiveOptions as WhatsAppSendInteractiveOptions,
} from './services/whatsapp.js';
export * from './services/supabase.js';
export {
  PostgresClient,
  PostgresInitializer,
  type PostgresConfig,
  type QueryResult as PostgresQueryResult,
  type PostgresTransaction,
} from './services/postgres.js';
export {
  MySQLClient,
  MySQLInitializer,
  type MySQLConfig,
  type QueryResult as MySQLQueryResult,
  type MySQLTransaction,
} from './services/mysql.js';

// Export triggers
export { SlackSocketTrigger } from './services/slack-socket.js';

// Export AI adapters
export * from './adapters/ollama.js';
export * from './adapters/claude-code.js';
export * from './adapters/claude-agent.js';
export * from './adapters/claude-agent-types.js';
export * from './adapters/claude-agent-workflow.js';
export * from './adapters/claude-agent-hooks.js';
export * from './adapters/opencode.js';
export * from './adapters/github-copilot.js';
export * from './adapters/github-copilot-workflow.js';
export * from './adapters/codex.js';
export * from './adapters/codex-types.js';
export * from './adapters/codex-workflow.js';

// Export tools
export * from './tools/script.js';

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
import { StripeInitializer } from './services/stripe.js';
import { TeamsInitializer } from './services/teams.js';
import { TwilioInitializer } from './services/twilio.js';
import { SendGridInitializer } from './services/sendgrid.js';
import { ShopifyInitializer } from './services/shopify.js';
import { ZendeskInitializer } from './services/zendesk.js';
import { MailchimpInitializer } from './services/mailchimp.js';
import { AsanaInitializer } from './services/asana.js';
import { TrelloInitializer } from './services/trello.js';
import { DropboxInitializer } from './services/dropbox.js';
import { AWSS3Initializer } from './services/aws-s3.js';

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

  // Collaboration
  registry.registerInitializer('teams', TeamsInitializer);

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

  // Payments & E-commerce
  registry.registerInitializer('stripe', StripeInitializer);
  registry.registerInitializer('@shopify/shopify-api', ShopifyInitializer);

  // Communications
  registry.registerInitializer('twilio', TwilioInitializer);
  registry.registerInitializer('@sendgrid/mail', SendGridInitializer);
  registry.registerInitializer('@mailchimp/mailchimp_marketing', MailchimpInitializer);

  // Customer Support
  registry.registerInitializer('node-zendesk', ZendeskInitializer);

  // Project Management
  registry.registerInitializer('asana', AsanaInitializer);
  registry.registerInitializer('trello', TrelloInitializer);

  // File Storage
  registry.registerInitializer('dropbox', DropboxInitializer);
  registry.registerInitializer('@aws-sdk/client-s3', AWSS3Initializer);

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
export {
  StripeClient,
  StripeInitializer,
  type StripeCustomer,
  type StripePaymentIntent,
  type StripeSubscription,
  type StripeInvoice,
  type CreateCustomerOptions,
  type CreatePaymentIntentOptions,
  type CreateSubscriptionOptions,
  type CreateInvoiceOptions,
} from './services/stripe.js';
export {
  TeamsClient,
  TeamsInitializer,
  type TeamsTeam,
  type TeamsChannel,
  type TeamsMessage,
  type TeamsChatMessage,
  type TeamsOnlineMeeting,
  type SendMessageOptions as TeamsSendMessageOptions,
  type SendChatMessageOptions,
  type CreateChannelOptions as TeamsCreateChannelOptions,
  type CreateMeetingOptions as TeamsCreateMeetingOptions,
  type ListTeamsOptions,
  type ListChannelsOptions,
  type ListMessagesOptions,
} from './services/teams.js';
export {
  TwilioClientWrapper,
  TwilioInitializer,
  type TwilioClient,
  type SendMessageOptions as TwilioSendMessageOptions,
  type MakeCallOptions,
  type SendWhatsAppOptions,
} from './services/twilio.js';
export {
  SendGridClient,
  SendGridInitializer,
  type SendEmailOptions as SendGridSendEmailOptions,
} from './services/sendgrid.js';
export {
  ShopifyClient,
  ShopifyInitializer,
  type ShopifyProduct,
  type ShopifyOrder,
  type ShopifyCustomer,
} from './services/shopify.js';
export {
  ZendeskClient,
  ZendeskInitializer,
  type ZendeskTicket,
  type ZendeskUser,
  type SearchOptions as ZendeskSearchOptions,
} from './services/zendesk.js';
export {
  MailchimpClient,
  MailchimpInitializer,
  type MailchimpMember,
  type MailchimpCampaign,
  type SendCampaignOptions,
} from './services/mailchimp.js';
export {
  AsanaClient,
  AsanaInitializer,
  type AsanaTask,
  type AsanaProject,
  type AsanaSection,
} from './services/asana.js';
export {
  TrelloClient,
  TrelloInitializer,
  type TrelloCard,
  type TrelloList,
  type TrelloBoard,
  type TrelloLabel,
} from './services/trello.js';
export {
  DropboxClient,
  DropboxInitializer,
  type DropboxFileMetadata,
  type DropboxFolderMetadata,
  type UploadOptions as DropboxUploadOptions,
  type DownloadOptions as DropboxDownloadOptions,
  type ShareOptions as DropboxShareOptions,
} from './services/dropbox.js';
export {
  AWSS3Client,
  AWSS3Initializer,
  type UploadObjectOptions,
  type GetObjectOptions,
  type DeleteObjectOptions,
  type ListObjectsOptions,
  type CopyObjectOptions,
} from './services/aws-s3.js';

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

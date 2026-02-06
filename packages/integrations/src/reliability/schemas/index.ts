/**
 * Input validation schemas for all integrations.
 *
 * Each schema map is keyed by action path (e.g., 'chat.postMessage')
 * and maps to a Zod schema for the action's input parameters.
 */

export { slackSchemas } from './slack.js';
export { githubSchemas } from './github.js';
export { gmailSchemas } from './gmail.js';
export { notionSchemas } from './notion.js';
export { jiraSchemas } from './jira.js';
export { discordSchemas } from './discord.js';
export { linearSchemas } from './linear.js';
export { telegramSchemas } from './telegram.js';
export { whatsappSchemas } from './whatsapp.js';
export { twilioSchemas } from './twilio.js';
export { trelloSchemas } from './trello.js';
export { asanaSchemas } from './asana.js';
export { zendeskSchemas } from './zendesk.js';
export { airtableSchemas } from './airtable.js';
export { confluenceSchemas } from './confluence.js';
export { googleSheetsSchemas } from './google-sheets.js';
export { googleCalendarSchemas } from './google-calendar.js';
export { googleDriveSchemas } from './google-drive.js';
export { googleDocsSchemas } from './google-docs.js';
export { outlookSchemas } from './outlook.js';
export { teamsSchemas } from './teams.js';
export { stripeSchemas } from './stripe.js';
export { shopifySchemas } from './shopify.js';
export { sendgridSchemas } from './sendgrid.js';
export { mailchimpSchemas } from './mailchimp.js';
export { awsS3Schemas } from './aws-s3.js';
export { dropboxSchemas } from './dropbox.js';
export { supabaseSchemas } from './supabase.js';
export { postgresSchemas } from './postgres.js';
export { mysqlSchemas } from './mysql.js';
export { hubspotSchemas } from './hubspot.js';
export { salesforceSchemas } from './salesforce.js';
export { pagerdutySchemas } from './pagerduty.js';
export { sentrySchemas } from './sentry.js';
export { gitlabSchemas } from './gitlab.js';
export { calendlySchemas } from './calendly.js';
export { intercomSchemas } from './intercom.js';
export { mondaySchemas } from './monday.js';

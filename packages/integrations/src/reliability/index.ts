/**
 * Integration Reliability Layer
 *
 * Provides input validation, retry, timeout, rate limiting,
 * and error normalization for all integrations.
 */

export {
  wrapIntegration,
  type WrapperOptions,
  type ActionCallOptions,
} from './wrapper.js';

export {
  IntegrationRequestError,
  normalizeError,
  type IntegrationError,
} from './errors.js';

export {
  slackSchemas,
  githubSchemas,
  gmailSchemas,
  notionSchemas,
  jiraSchemas,
  discordSchemas,
  linearSchemas,
} from './schemas/index.js';

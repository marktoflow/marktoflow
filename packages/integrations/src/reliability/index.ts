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
  RateLimiterRegistry,
  getRateLimiterRegistry,
  resetRateLimiterRegistry,
  KNOWN_RATE_LIMITS,
  type RateLimitConfig,
} from './rate-limiter.js';

export {
  slackSchemas,
  githubSchemas,
  gmailSchemas,
  notionSchemas,
  jiraSchemas,
  discordSchemas,
  linearSchemas,
} from './schemas/index.js';

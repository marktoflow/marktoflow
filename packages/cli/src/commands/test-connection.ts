/**
 * Test Connection Command
 *
 * Validates service credentials and makes minimal API calls to verify
 * that configured services are reachable and properly authenticated.
 */

import chalk from 'chalk';
import ora from 'ora';

// ============================================================================
// Types
// ============================================================================

interface ServiceDefinition {
  /** Display name for the service */
  name: string;
  /** Environment variables required for this service */
  envVars: EnvVarDef[];
  /** Function to test the connection */
  testConnection: (creds: Record<string, string>) => Promise<TestResult>;
}

interface EnvVarDef {
  /** Environment variable name */
  name: string;
  /** Human-readable label */
  label: string;
  /** Whether this variable is required */
  required: boolean;
  /** Prefix/pattern the value should match (for validation) */
  prefix?: string;
  /** Help URL for getting this credential */
  helpUrl?: string;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

interface ServiceTestResult {
  service: string;
  name: string;
  result: TestResult;
  credentialStatus: 'present' | 'missing' | 'malformed';
  duration: number;
}

// ============================================================================
// Credential Validation
// ============================================================================

function validateCredentialFormat(value: string, def: EnvVarDef): { valid: boolean; issue?: string } {
  if (!def.prefix) return { valid: true };

  if (!value.startsWith(def.prefix)) {
    return {
      valid: false,
      issue: `Expected value to start with "${def.prefix}" but got "${value.substring(0, Math.min(8, value.length))}..."`,
    };
  }

  return { valid: true };
}

function resolveEnvVar(name: string): string | undefined {
  return process.env[name];
}

// ============================================================================
// Service Definitions
// ============================================================================

const SERVICES: Record<string, ServiceDefinition> = {
  slack: {
    name: 'Slack',
    envVars: [
      {
        name: 'SLACK_BOT_TOKEN',
        label: 'Bot Token',
        required: true,
        prefix: 'xoxb-',
        helpUrl: 'https://api.slack.com/apps',
      },
    ],
    testConnection: async (creds) => {
      const token = creds['SLACK_BOT_TOKEN'];
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const data = (await response.json()) as { ok: boolean; user?: string; team?: string; error?: string };
      if (data.ok) {
        return {
          success: true,
          message: `Authenticated as ${data.user} in workspace ${data.team}`,
        };
      }
      return {
        success: false,
        message: `Auth failed: ${data.error}`,
        details: getSlackErrorHelp(data.error ?? 'unknown'),
      };
    },
  },

  github: {
    name: 'GitHub',
    envVars: [
      {
        name: 'GITHUB_TOKEN',
        label: 'Personal Access Token',
        required: true,
        prefix: 'gh',
        helpUrl: 'https://github.com/settings/tokens',
      },
    ],
    testConnection: async (creds) => {
      const token = creds['GITHUB_TOKEN'];
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'marktoflow-cli',
        },
      });
      if (response.ok) {
        const data = (await response.json()) as { login: string; name?: string };
        return {
          success: true,
          message: `Authenticated as ${data.login}${data.name ? ` (${data.name})` : ''}`,
        };
      }
      if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid or expired token',
          details: 'Create a new token at https://github.com/settings/tokens',
        };
      }
      return {
        success: false,
        message: `API returned ${response.status} ${response.statusText}`,
      };
    },
  },

  gmail: {
    name: 'Gmail',
    envVars: [
      {
        name: 'GOOGLE_CLIENT_ID',
        label: 'Client ID',
        required: true,
        helpUrl: 'https://console.cloud.google.com/',
      },
      {
        name: 'GOOGLE_CLIENT_SECRET',
        label: 'Client Secret',
        required: true,
      },
      {
        name: 'GMAIL_REFRESH_TOKEN',
        label: 'Refresh Token',
        required: true,
      },
    ],
    testConnection: async (creds) => {
      // First, exchange refresh token for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: creds['GOOGLE_CLIENT_ID'],
          client_secret: creds['GOOGLE_CLIENT_SECRET'],
          refresh_token: creds['GMAIL_REFRESH_TOKEN'],
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        const error = (await tokenResponse.json()) as { error_description?: string };
        return {
          success: false,
          message: `Token refresh failed: ${error.error_description ?? 'unknown error'}`,
          details: 'Run "marktoflow connect gmail" to re-authenticate',
        };
      }

      const tokens = (await tokenResponse.json()) as { access_token: string };

      // Test with profile endpoint
      const profileResponse = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );

      if (profileResponse.ok) {
        const profile = (await profileResponse.json()) as { emailAddress: string; messagesTotal?: number };
        return {
          success: true,
          message: `Authenticated as ${profile.emailAddress}`,
          details: profile.messagesTotal ? `${profile.messagesTotal} total messages` : undefined,
        };
      }

      return {
        success: false,
        message: `Profile request failed: ${profileResponse.status}`,
        details: 'Ensure Gmail API is enabled in Google Cloud Console',
      };
    },
  },

  notion: {
    name: 'Notion',
    envVars: [
      {
        name: 'NOTION_TOKEN',
        label: 'Integration Token',
        required: true,
        prefix: 'secret_',
        helpUrl: 'https://www.notion.so/my-integrations',
      },
    ],
    testConnection: async (creds) => {
      const token = creds['NOTION_TOKEN'];
      const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({ query: '', page_size: 1 }),
      });

      if (response.ok) {
        const data = (await response.json()) as { results: unknown[] };
        return {
          success: true,
          message: `Connected to Notion`,
          details: `Found ${data.results.length} accessible page(s) in test query`,
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid integration token',
          details: 'Create a new integration at https://www.notion.so/my-integrations',
        };
      }

      return {
        success: false,
        message: `API returned ${response.status} ${response.statusText}`,
      };
    },
  },

  jira: {
    name: 'Jira',
    envVars: [
      {
        name: 'JIRA_HOST',
        label: 'Jira Host URL',
        required: true,
        helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
      },
      {
        name: 'JIRA_EMAIL',
        label: 'Email Address',
        required: true,
      },
      {
        name: 'JIRA_API_TOKEN',
        label: 'API Token',
        required: true,
      },
    ],
    testConnection: async (creds) => {
      const host = creds['JIRA_HOST'].replace(/\/$/, '');
      const email = creds['JIRA_EMAIL'];
      const apiToken = creds['JIRA_API_TOKEN'];
      const encoded = Buffer.from(`${email}:${apiToken}`).toString('base64');

      const response = await fetch(`${host}/rest/api/3/myself`, {
        headers: {
          Authorization: `Basic ${encoded}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { displayName: string; emailAddress: string };
        return {
          success: true,
          message: `Authenticated as ${data.displayName} (${data.emailAddress})`,
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid email or API token',
          details: 'Create a new API token at https://id.atlassian.com/manage-profile/security/api-tokens',
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          message: 'Access denied - check that your API token has sufficient permissions',
        };
      }

      return {
        success: false,
        message: `API returned ${response.status} ${response.statusText}`,
      };
    },
  },

  linear: {
    name: 'Linear',
    envVars: [
      {
        name: 'LINEAR_API_KEY',
        label: 'API Key',
        required: true,
        prefix: 'lin_api_',
        helpUrl: 'https://linear.app/settings/api',
      },
    ],
    testConnection: async (creds) => {
      const apiKey = creds['LINEAR_API_KEY'];
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: '{ viewer { id name email } }',
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          data?: { viewer?: { name: string; email: string } };
          errors?: { message: string }[];
        };
        if (data.data?.viewer) {
          return {
            success: true,
            message: `Authenticated as ${data.data.viewer.name} (${data.data.viewer.email})`,
          };
        }
        if (data.errors && data.errors.length > 0) {
          return {
            success: false,
            message: `GraphQL error: ${data.errors[0].message}`,
          };
        }
      }

      if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid API key',
          details: 'Create a new API key at https://linear.app/settings/api',
        };
      }

      return {
        success: false,
        message: `API returned ${response.status} ${response.statusText}`,
      };
    },
  },

  discord: {
    name: 'Discord',
    envVars: [
      {
        name: 'DISCORD_BOT_TOKEN',
        label: 'Bot Token',
        required: true,
        helpUrl: 'https://discord.com/developers/applications',
      },
    ],
    testConnection: async (creds) => {
      const token = creds['DISCORD_BOT_TOKEN'];
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${token}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { username: string; discriminator: string; id: string };
        return {
          success: true,
          message: `Authenticated as ${data.username}#${data.discriminator} (ID: ${data.id})`,
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid bot token',
          details: 'Get your bot token from https://discord.com/developers/applications',
        };
      }

      return {
        success: false,
        message: `API returned ${response.status} ${response.statusText}`,
      };
    },
  },

  telegram: {
    name: 'Telegram',
    envVars: [
      {
        name: 'TELEGRAM_BOT_TOKEN',
        label: 'Bot Token',
        required: true,
        helpUrl: 'https://core.telegram.org/bots#botfather',
      },
    ],
    testConnection: async (creds) => {
      const token = creds['TELEGRAM_BOT_TOKEN'];
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);

      if (response.ok) {
        const data = (await response.json()) as {
          ok: boolean;
          result?: { username: string; first_name: string; id: number };
        };
        if (data.ok && data.result) {
          return {
            success: true,
            message: `Authenticated as @${data.result.username} (${data.result.first_name})`,
          };
        }
      }

      if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid bot token',
          details: 'Get a bot token from @BotFather on Telegram: https://core.telegram.org/bots#botfather',
        };
      }

      return {
        success: false,
        message: `API returned ${response.status} ${response.statusText}`,
      };
    },
  },
};

// ============================================================================
// Error Help
// ============================================================================

function getSlackErrorHelp(error: string): string {
  switch (error) {
    case 'invalid_auth':
    case 'not_authed':
      return 'The token is invalid or has been revoked. Get a new token at https://api.slack.com/apps';
    case 'account_inactive':
      return 'The token belongs to a deactivated user or workspace.';
    case 'token_revoked':
      return 'The token has been revoked. Generate a new token at https://api.slack.com/apps';
    case 'token_expired':
      return 'The token has expired. If using OAuth, refresh the token.';
    default:
      return `See Slack API docs: https://api.slack.com/methods/auth.test`;
  }
}

// ============================================================================
// Test Executor
// ============================================================================

async function testService(serviceKey: string): Promise<ServiceTestResult> {
  const definition = SERVICES[serviceKey];
  if (!definition) {
    return {
      service: serviceKey,
      name: serviceKey,
      result: {
        success: false,
        message: `Unknown service: ${serviceKey}`,
        details: `Available services: ${Object.keys(SERVICES).join(', ')}`,
      },
      credentialStatus: 'missing',
      duration: 0,
    };
  }

  // Check credentials
  const creds: Record<string, string> = {};
  const missingVars: EnvVarDef[] = [];
  const malformedVars: { def: EnvVarDef; issue: string }[] = [];

  for (const envDef of definition.envVars) {
    const value = resolveEnvVar(envDef.name);
    if (!value) {
      if (envDef.required) {
        missingVars.push(envDef);
      }
    } else {
      const formatCheck = validateCredentialFormat(value, envDef);
      if (!formatCheck.valid) {
        malformedVars.push({ def: envDef, issue: formatCheck.issue ?? 'Invalid format' });
      }
      creds[envDef.name] = value;
    }
  }

  // Report missing credentials
  if (missingVars.length > 0) {
    const missingNames = missingVars.map((v) => v.name);
    const helpUrls = missingVars
      .filter((v) => v.helpUrl)
      .map((v) => v.helpUrl);
    const helpText = helpUrls.length > 0 ? `\nGet credentials: ${helpUrls[0]}` : '';

    return {
      service: serviceKey,
      name: definition.name,
      result: {
        success: false,
        message: `Missing required environment variable(s): ${missingNames.join(', ')}`,
        details: `Set these in your .env file or environment.${helpText}\nRun "marktoflow connect ${serviceKey}" for setup instructions.`,
      },
      credentialStatus: 'missing',
      duration: 0,
    };
  }

  // Report malformed credentials
  if (malformedVars.length > 0) {
    const issues = malformedVars.map((v) => `${v.def.name}: ${v.issue}`);
    return {
      service: serviceKey,
      name: definition.name,
      result: {
        success: false,
        message: `Credential format issue(s):\n  ${issues.join('\n  ')}`,
        details: 'Check that your credentials are correctly copied.',
      },
      credentialStatus: 'malformed',
      duration: 0,
    };
  }

  // Run the actual connection test
  const startTime = Date.now();
  try {
    const result = await definition.testConnection(creds);
    const duration = Date.now() - startTime;
    return {
      service: serviceKey,
      name: definition.name,
      result,
      credentialStatus: 'present',
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide actionable messages for common network errors
    let details: string | undefined;
    if (errorMessage.includes('ENOTFOUND')) {
      details = 'DNS resolution failed. Check your network connection and the service URL.';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      details = 'Connection refused. The service may be down or the URL may be incorrect.';
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      details = 'Connection timed out. Check your network connection or try again later.';
    } else if (errorMessage.includes('CERT') || errorMessage.includes('certificate')) {
      details = 'SSL/TLS certificate error. Check your system clock and network configuration.';
    }

    return {
      service: serviceKey,
      name: definition.name,
      result: {
        success: false,
        message: `Connection error: ${errorMessage}`,
        details,
      },
      credentialStatus: 'present',
      duration,
    };
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

function displayResult(result: ServiceTestResult): void {
  const icon = result.result.success ? chalk.green('PASS') : chalk.red('FAIL');
  const serviceName = chalk.bold(result.name);
  const durationStr = result.duration > 0 ? chalk.dim(` (${result.duration}ms)`) : '';

  console.log(`\n  ${icon}  ${serviceName}${durationStr}`);
  console.log(`       ${result.result.message}`);

  if (result.result.details) {
    const detailLines = result.result.details.split('\n');
    for (const line of detailLines) {
      console.log(chalk.dim(`       ${line}`));
    }
  }
}

function displaySummary(results: ServiceTestResult[]): void {
  const passed = results.filter((r) => r.result.success).length;
  const failed = results.filter((r) => !r.result.success).length;

  console.log('\n' + chalk.bold('  Summary'));
  console.log(`  ${chalk.green(`${passed} passed`)}, ${chalk.red(`${failed} failed`)}, ${results.length} total`);

  if (failed > 0) {
    console.log(
      chalk.dim('\n  Run "marktoflow connect <service>" to configure missing services.')
    );
  }

  console.log('');
}

// ============================================================================
// Public API
// ============================================================================

export function getAvailableServices(): string[] {
  return Object.keys(SERVICES);
}

export async function runTestConnection(service: string): Promise<ServiceTestResult> {
  return testService(service);
}

export async function runTestAllConnections(): Promise<ServiceTestResult[]> {
  const results: ServiceTestResult[] = [];

  for (const serviceKey of Object.keys(SERVICES)) {
    const result = await testService(serviceKey);
    results.push(result);
    displayResult(result);
  }

  return results;
}

export async function executeTestConnection(
  service: string | undefined,
  options: { all?: boolean }
): Promise<void> {
  console.log(chalk.bold('\n  marktoflow Connection Test\n'));

  if (options.all) {
    const spinner = ora('Testing all service connections...').start();
    spinner.stop();

    const results = await runTestAllConnections();
    displaySummary(results);

    const hasFailed = results.some((r) => !r.result.success);
    if (hasFailed) {
      process.exit(1);
    }
    return;
  }

  if (!service) {
    console.log(chalk.red('  Error: specify a service name or use --all\n'));
    console.log('  Usage:');
    console.log('    marktoflow test-connection <service>');
    console.log('    marktoflow test-connection --all\n');
    console.log('  Available services:');
    for (const [key, def] of Object.entries(SERVICES)) {
      console.log(`    ${chalk.cyan(key.padEnd(12))} ${def.name}`);
    }
    console.log('');
    process.exit(1);
  }

  const serviceLower = service.toLowerCase();
  const spinner = ora(`Testing ${SERVICES[serviceLower]?.name ?? service} connection...`).start();

  const result = await testService(serviceLower);
  spinner.stop();

  displayResult(result);
  console.log('');

  if (!result.result.success) {
    process.exit(1);
  }
}

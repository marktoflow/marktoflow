/**
 * `marktoflow connect` command — Connect services via OAuth or manual setup.
 */

import chalk from 'chalk';

export interface ConnectOptions {
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  port: string;
}

export async function executeConnect(service: string, options: ConnectOptions): Promise<void> {
  const serviceLower = service.toLowerCase();
  console.log(chalk.bold(`Connecting ${service}...`));

  if (serviceLower === 'gmail') {
    await connectGmail(options);
    return;
  }

  if (isGoogleService(serviceLower)) {
    await connectGoogleService(serviceLower, service, options);
    return;
  }

  if (serviceLower === 'gemini-cli' || serviceLower === 'google-gemini-cli') {
    await connectGeminiCli(options);
    return;
  }

  if (serviceLower === 'outlook' || serviceLower === 'microsoft') {
    await connectOutlook(options);
    return;
  }

  // Other services - show manual setup instructions
  showManualSetup(serviceLower, service);
}

function isGoogleService(service: string): boolean {
  return [
    'google-drive',
    'drive',
    'google-sheets',
    'sheets',
    'google-calendar',
    'calendar',
    'google-docs',
    'docs',
    'google-workspace',
    'workspace',
  ].includes(service);
}

async function connectGmail(options: ConnectOptions): Promise<void> {
  const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = options.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET;
  const port = parseInt(options.port, 10);

  if (!clientId || !clientSecret) {
    console.log(chalk.yellow('\nGmail OAuth requires client credentials.'));
    console.log('\nTo connect Gmail:');
    console.log('  1. Go to https://console.cloud.google.com/');
    console.log('  2. Create OAuth 2.0 credentials (Desktop app type)');
    console.log(
      '  3. Run: marktoflow connect gmail --client-id YOUR_ID --client-secret YOUR_SECRET'
    );
    console.log('\nOr set environment variables:');
    console.log('  export GOOGLE_CLIENT_ID="your-client-id"');
    console.log('  export GOOGLE_CLIENT_SECRET="your-client-secret"');
    return;
  }

  try {
    const { runGmailOAuth } = await import('../oauth.js');
    const tokens = await runGmailOAuth({ clientId, clientSecret, port });
    console.log(chalk.green('\nGmail connected successfully!'));
    console.log(
      chalk.dim(
        `Access token expires: ${tokens.expires_at ? new Date(tokens.expires_at).toISOString() : 'unknown'}`
      )
    );
    console.log('\nYou can now use Gmail in your workflows:');
    console.log(
      chalk.cyan(`  tools:
    gmail:
      sdk: "googleapis"
      auth:
        client_id: "\${GOOGLE_CLIENT_ID}"
        client_secret: "\${GOOGLE_CLIENT_SECRET}"
        redirect_uri: "http://localhost:${port}/callback"
        refresh_token: "\${GMAIL_REFRESH_TOKEN}"`)
    );
    process.exit(0);
  } catch (error) {
    console.log(chalk.red(`\nOAuth failed: ${error}`));
    process.exit(1);
  }
}

async function connectGoogleService(
  serviceLower: string,
  serviceDisplay: string,
  options: ConnectOptions
): Promise<void> {
  const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = options.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET;
  const port = parseInt(options.port, 10);

  if (!clientId || !clientSecret) {
    console.log(chalk.yellow('\nGoogle OAuth requires client credentials.'));
    console.log('\nTo connect Google services:');
    console.log('  1. Go to https://console.cloud.google.com/');
    console.log('  2. Enable the API for your service (Drive, Sheets, etc.)');
    console.log('  3. Create OAuth 2.0 credentials (Desktop app type)');
    console.log(
      `  4. Run: marktoflow connect ${serviceDisplay} --client-id YOUR_ID --client-secret YOUR_SECRET`
    );
    console.log('\nOr set environment variables:');
    console.log('  export GOOGLE_CLIENT_ID="your-client-id"');
    console.log('  export GOOGLE_CLIENT_SECRET="your-client-secret"');
    return;
  }

  try {
    const { runGoogleOAuth } = await import('../oauth.js');
    const tokens = await runGoogleOAuth(serviceLower, { clientId, clientSecret, port });
    console.log(
      chalk.dim(
        `Access token expires: ${tokens.expires_at ? new Date(tokens.expires_at).toISOString() : 'unknown'}`
      )
    );

    const normalizedService = serviceLower.startsWith('google-')
      ? serviceLower
      : `google-${serviceLower}`;

    console.log('\nYou can now use this service in your workflows:');
    console.log(
      chalk.cyan(`  tools:
    ${serviceLower.replace('google-', '')}:
      sdk: "${normalizedService}"
      auth:
        client_id: "\${GOOGLE_CLIENT_ID}"
        client_secret: "\${GOOGLE_CLIENT_SECRET}"
        redirect_uri: "http://localhost:${port}/callback"
        refresh_token: "\${GOOGLE_REFRESH_TOKEN}"
        access_token: "\${GOOGLE_ACCESS_TOKEN}"`)
    );
    process.exit(0);
  } catch (error) {
    console.log(chalk.red(`\nOAuth failed: ${error}`));
    process.exit(1);
  }
}

async function connectOutlook(options: ConnectOptions): Promise<void> {
  const clientId = options.clientId ?? process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = options.clientSecret ?? process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = options.tenantId ?? process.env.MICROSOFT_TENANT_ID;
  const port = parseInt(options.port, 10);

  if (!clientId) {
    console.log(chalk.yellow('\nOutlook OAuth requires a client ID.'));
    console.log('\nTo connect Outlook/Microsoft Graph:');
    console.log('  1. Go to https://portal.azure.com/');
    console.log('  2. Register an application in Azure AD');
    console.log(`  3. Add redirect URI: http://localhost:${port}/callback`);
    console.log('  4. Grant Mail.Read, Mail.Send, Calendars.ReadWrite permissions');
    console.log('  5. Run: marktoflow connect outlook --client-id YOUR_ID');
    console.log('\nOr set environment variables:');
    console.log('  export MICROSOFT_CLIENT_ID="your-client-id"');
    console.log('  export MICROSOFT_CLIENT_SECRET="your-client-secret"  # optional');
    console.log('  export MICROSOFT_TENANT_ID="common"  # or your tenant ID');
    return;
  }

  try {
    const { runOutlookOAuth } = await import('../oauth.js');
    const tokens = await runOutlookOAuth({ clientId, clientSecret, tenantId, port });
    console.log(chalk.green('\nOutlook connected successfully!'));
    console.log(
      chalk.dim(
        `Access token expires: ${tokens.expires_at ? new Date(tokens.expires_at).toISOString() : 'unknown'}`
      )
    );
    console.log('\nYou can now use Outlook in your workflows:');
    console.log(
      chalk.cyan(`  tools:
    outlook:
      sdk: "@microsoft/microsoft-graph-client"
      auth:
        token: "\${OUTLOOK_ACCESS_TOKEN}"`)
    );
    process.exit(0);
  } catch (error) {
    console.log(chalk.red(`\nOAuth failed: ${error}`));
    process.exit(1);
  }
}

async function connectGeminiCli(options: ConnectOptions): Promise<void> {
  try {
    const { extractGeminiCliCredentials, loginGeminiCliOAuth } =
      await import('@marktoflow/integrations');
    const { default: open } = await import('open').catch(() => ({ default: null }));

    // Try to extract credentials from installed gemini-cli
    const extracted = extractGeminiCliCredentials();
    const clientId =
      options.clientId ?? process.env.GEMINI_CLI_OAUTH_CLIENT_ID ?? extracted?.clientId;
    const clientSecret =
      options.clientSecret ?? process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET ?? extracted?.clientSecret;

    if (!clientId) {
      console.log(chalk.yellow('\nGemini CLI OAuth requires credentials.'));
      console.log('\nTo connect Gemini CLI:');
      console.log('  1. Install Gemini CLI: npm install -g @google/gemini-cli');
      console.log('  2. Run: marktoflow connect gemini-cli');
      console.log('\nOr set environment variables:');
      console.log('  export GEMINI_CLI_OAUTH_CLIENT_ID="your-client-id"');
      console.log('  export GEMINI_CLI_OAUTH_CLIENT_SECRET="your-client-secret"');
      console.log('\nAlternatively, use an API key:');
      console.log('  export GEMINI_API_KEY="your-api-key"');
      return;
    }

    // clientId is guaranteed non-null here — the early return above handles the null case
    process.env.GEMINI_CLI_OAUTH_CLIENT_ID = clientId;
    if (clientSecret) {
      process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET = clientSecret;
    }

    const credentials = await loginGeminiCliOAuth({
      isRemote: false,
      openUrl: async (url: string) => {
        if (open) {
          await (open as (url: string) => Promise<unknown>)(url);
        } else {
          throw new Error('Cannot open browser');
        }
      },
      log: (msg: string) => console.log(msg),
      note: async (message: string, title?: string) => {
        if (title) console.log(chalk.bold(`\n${title}`));
        console.log(message);
      },
      prompt: async (message: string) => {
        const readline = await import('node:readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise<string>((resolve) => {
          rl.question(message, (answer) => {
            rl.close();
            resolve(answer);
          });
        });
      },
      progress: {
        update: (msg: string) => console.log(chalk.dim(msg)),
        stop: (msg?: string) => {
          if (msg) console.log(chalk.dim(msg));
        },
      },
    });

    console.log(chalk.green('\nGemini CLI connected successfully!'));
    if (credentials.email) {
      console.log(chalk.dim(`Authenticated as: ${credentials.email}`));
    }
    console.log(chalk.dim(`Project ID: ${credentials.projectId}`));
    console.log('\nAdd these to your environment:');
    console.log(chalk.cyan(`  export GEMINI_REFRESH_TOKEN="${credentials.refresh}"`));
    console.log(chalk.cyan(`  export GEMINI_PROJECT_ID="${credentials.projectId}"`));
    console.log('\nYou can now use Gemini in your workflows:');
    console.log(
      chalk.cyan(`  tools:
    gemini:
      sdk: "google-gemini-cli"
      auth:
        refresh_token: "\${GEMINI_REFRESH_TOKEN}"
        project_id: "\${GEMINI_PROJECT_ID}"
      options:
        model: "gemini-2.5-flash"`)
    );
  } catch (error) {
    throw new Error(`Gemini CLI OAuth failed: ${error}`);
  }
}

function showManualSetup(serviceLower: string, serviceDisplay: string): void {
  console.log('\nManual setup required. Set environment variables:');

  switch (serviceLower) {
    case 'slack':
      console.log(`  export SLACK_BOT_TOKEN="xoxb-your-token"`);
      console.log(`  export SLACK_APP_TOKEN="xapp-your-token"`);
      console.log(chalk.dim('\n  Get tokens from https://api.slack.com/apps'));
      break;
    case 'github':
      console.log(`  export GITHUB_TOKEN="ghp_your-token"`);
      console.log(chalk.dim('\n  Create token at https://github.com/settings/tokens'));
      break;
    case 'jira':
      console.log(`  export JIRA_HOST="https://your-domain.atlassian.net"`);
      console.log(`  export JIRA_EMAIL="your-email@example.com"`);
      console.log(`  export JIRA_API_TOKEN="your-api-token"`);
      console.log(
        chalk.dim('\n  Create token at https://id.atlassian.com/manage-profile/security/api-tokens')
      );
      break;
    case 'confluence':
      console.log(`  export CONFLUENCE_HOST="https://your-domain.atlassian.net"`);
      console.log(`  export CONFLUENCE_EMAIL="your-email@example.com"`);
      console.log(`  export CONFLUENCE_API_TOKEN="your-api-token"`);
      console.log(
        chalk.dim('\n  Create token at https://id.atlassian.com/manage-profile/security/api-tokens')
      );
      break;
    case 'linear':
      console.log(`  export LINEAR_API_KEY="lin_api_your-key"`);
      console.log(chalk.dim('\n  Create key at https://linear.app/settings/api'));
      break;
    case 'notion':
      console.log(`  export NOTION_TOKEN="secret_your-token"`);
      console.log(chalk.dim('\n  Create integration at https://www.notion.so/my-integrations'));
      break;
    case 'discord':
      console.log(`  export DISCORD_BOT_TOKEN="your-bot-token"`);
      console.log(chalk.dim('\n  Create bot at https://discord.com/developers/applications'));
      break;
    case 'airtable':
      console.log(`  export AIRTABLE_TOKEN="pat_your-token"`);
      console.log(`  export AIRTABLE_BASE_ID="appXXXXX"  # optional default base`);
      console.log(chalk.dim('\n  Create token at https://airtable.com/create/tokens'));
      break;
    case 'anthropic':
      console.log(`  export ANTHROPIC_API_KEY="sk-ant-your-key"`);
      console.log(chalk.dim('\n  Get key at https://console.anthropic.com/'));
      break;
    case 'openai':
      console.log(`  export OPENAI_API_KEY="sk-your-key"`);
      console.log(chalk.dim('\n  Get key at https://platform.openai.com/api-keys'));
      break;
    default:
      console.log(`  See documentation for ${serviceDisplay} configuration.`);
      console.log('\n' + chalk.bold('Available services:'));
      console.log('  Communication: slack, discord');
      console.log('  Email: gmail, outlook');
      console.log(
        '  Google Workspace: google-drive, google-sheets, google-calendar, google-docs, google-workspace'
      );
      console.log('  Project management: jira, linear');
      console.log('  Documentation: notion, confluence');
      console.log('  Developer: github');
      console.log('  Data: airtable');
      console.log('  AI: anthropic, openai, gemini-cli');
  }
}

import { Command } from 'commander';
import {
  parseFile,
  WorkflowEngine,
  StateStore,
  SDKRegistry,
  createSDKStepExecutor,
  WebhookReceiver,
  parseWebhookBody,
  verifySlackSignature,
  verifyGitHubSignature,
  type WebhookEvent,
  type WebhookResponse,
  type Workflow,
} from '@marktoflow/core';
import { SlackSocketTrigger } from '@marktoflow/integrations';
import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { registerIntegrations } from '@marktoflow/integrations';

interface WebhookWorkflow {
  path: string;
  workflow: Workflow;
  webhookPath: string;
  provider?: string;
  secret?: string;
  inputMapping?: Record<string, string>;
}

/**
 * Extract input value from webhook payload using a path expression
 */
function extractFromPayload(payload: unknown, path: string): unknown {
  if (!path.startsWith('payload.')) {
    return path; // Return literal value
  }

  const parts = path.slice(8).split('.'); // Remove 'payload.' prefix
  let current: unknown = payload;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Build workflow inputs from webhook payload based on input mapping
 */
function buildInputs(
  payload: unknown,
  mapping: Record<string, string> | undefined,
  defaults: Record<string, unknown>
): Record<string, unknown> {
  const inputs: Record<string, unknown> = { ...defaults };

  if (mapping) {
    for (const [inputName, payloadPath] of Object.entries(mapping)) {
      const value = extractFromPayload(payload, payloadPath);
      if (value !== undefined) {
        inputs[inputName] = value;
      }
    }
  }

  return inputs;
}

export const serveCommand = new Command('serve')
  .description('Start webhook server to receive events and trigger workflows')
  .option('-p, --port <port>', 'Server port (for HTTP mode)', '3000')
  .option('-H, --host <host>', 'Server host (for HTTP mode)', '0.0.0.0')
  .option('-d, --dir <path>', 'Workflow directory', '.')
  .option('-w, --workflow <path>', 'Single workflow file to serve')
  .option('--agent <agent>', 'Default agent for workflows', 'claude-code')
  .option('--socket', 'Use Slack Socket Mode (no public URL needed)')
  .option('--app-token <token>', 'Slack App Token for Socket Mode (or SLACK_APP_TOKEN env)')
  .option('--bot-token <token>', 'Slack Bot Token for Socket Mode (or SLACK_BOT_TOKEN env)')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const host = options.host;
    const workflowDir = options.dir;
    const singleWorkflow = options.workflow;
    const defaultAgent = options.agent;
    const useSocketMode = options.socket;

    // Get tokens from options or environment
    const appToken = options.appToken || process.env.SLACK_APP_TOKEN;
    const botToken = options.botToken || process.env.SLACK_BOT_TOKEN;

    if (useSocketMode) {
      await startSocketMode({
        workflowDir,
        singleWorkflow,
        defaultAgent,
        appToken,
        botToken,
      });
    } else {
      await startHttpMode({
        port,
        host,
        workflowDir,
        singleWorkflow,
        defaultAgent,
      });
    }
  });

/**
 * Start Slack Socket Mode server
 */
async function startSocketMode(options: {
  workflowDir: string;
  singleWorkflow?: string;
  defaultAgent: string;
  appToken?: string;
  botToken?: string;
}): Promise<void> {
  const { workflowDir, singleWorkflow, defaultAgent, appToken, botToken } = options;

  console.log(chalk.blue('Starting marktoflow in Slack Socket Mode...'));

  if (!appToken) {
    console.error(chalk.red('Error: Slack App Token required for Socket Mode'));
    console.log(chalk.gray('Set SLACK_APP_TOKEN environment variable or use --app-token'));
    console.log(chalk.gray('\nTo get an App Token:'));
    console.log(chalk.gray('  1. Go to your Slack app settings'));
    console.log(chalk.gray('  2. Navigate to "Basic Information" > "App-Level Tokens"'));
    console.log(chalk.gray('  3. Generate a token with "connections:write" scope'));
    process.exit(1);
  }

  if (!botToken) {
    console.error(chalk.red('Error: Slack Bot Token required for Socket Mode'));
    console.log(chalk.gray('Set SLACK_BOT_TOKEN environment variable or use --bot-token'));
    process.exit(1);
  }

  const stateStore = new StateStore();
  const engine = new WorkflowEngine({ defaultAgent }, {}, stateStore);
  const registry = new SDKRegistry();
  registerIntegrations(registry);

  // Load workflows
  const workflowFiles = findWorkflowFiles(workflowDir, singleWorkflow);
  const slackWorkflows: Array<{
    path: string;
    workflow: Workflow;
    events: string[];
  }> = [];

  for (const filePath of workflowFiles) {
    try {
      const { workflow } = await parseFile(filePath);

      if (!workflow.triggers) continue;

      for (const trigger of workflow.triggers) {
        if (trigger.type !== 'webhook') continue;

        const provider = trigger.config?.['provider'] as string | undefined;
        if (provider !== 'slack') continue;

        const events = (trigger.config?.['events'] as string[]) || ['message', 'app_mention'];

        slackWorkflows.push({
          path: filePath,
          workflow,
          events,
        });

        console.log(
          chalk.cyan(`  ${workflow.metadata.name || workflow.metadata.id}`) +
            chalk.gray(` (events: ${events.join(', ')})`)
        );
      }
    } catch (e) {
      console.warn(chalk.yellow(`Failed to load ${filePath}: ${e}`));
    }
  }

  if (slackWorkflows.length === 0) {
    console.log(chalk.yellow('\nNo Slack workflows found.'));
    console.log(chalk.gray('Add a Slack webhook trigger to your workflow:'));
    console.log(
      chalk.gray(`
triggers:
  - type: webhook
    path: /slack/my-workflow
    config:
      provider: slack
`)
    );
    process.exit(1);
  }

  console.log(chalk.green(`\nLoaded ${slackWorkflows.length} Slack workflow(s)`));

  // Create trigger handlers
  const triggers: Array<{
    id: string;
    event: 'message' | 'app_mention';
    handler: (payload: Record<string, unknown>) => Promise<void>;
  }> = [];

  for (const wf of slackWorkflows) {
    for (const eventType of wf.events) {
      if (eventType !== 'message' && eventType !== 'app_mention') continue;

      triggers.push({
        id: `${wf.workflow.metadata.id}-${eventType}`,
        event: eventType as 'message' | 'app_mention',
        handler: async (payload: Record<string, unknown>) => {
          const message = payload.message as Record<string, unknown> | undefined;
          const event = payload.payload as Record<string, unknown> | undefined;

          // Skip bot messages
          if (message?.bot_id || message?.subtype === 'bot_message') {
            return;
          }

          const sourceEvent = message || event;
          if (!sourceEvent) return;

          console.log(
            chalk.green(`[${eventType}] Received event, triggering ${wf.workflow.metadata.id}...`)
          );

          const inputs = {
            channel: sourceEvent.channel,
            question: sourceEvent.text,
            instructions: sourceEvent.text,
            thread_ts: sourceEvent.thread_ts || sourceEvent.ts,
            user: sourceEvent.user,
            text: sourceEvent.text,
          };

          try {
            const { workflow } = await parseFile(wf.path);
            registry.registerTools(workflow.tools);

            console.log(chalk.blue(`[${wf.workflow.metadata.id}] Executing with inputs:`), inputs);

            await engine.execute(workflow, inputs, registry, createSDKStepExecutor());

            console.log(chalk.green(`[${wf.workflow.metadata.id}] Workflow completed successfully`));
          } catch (error) {
            console.error(chalk.red(`[${wf.workflow.metadata.id}] Workflow failed:`), error);
          }
        },
      });
    }
  }

  // Start Socket Mode
  const socketTrigger = new SlackSocketTrigger({
    appToken,
    botToken,
    triggers,
  });

  await socketTrigger.start();

  console.log(chalk.green('\n✓ Slack Socket Mode connected!'));
  console.log(chalk.gray('\nListening for events:'));
  for (const trigger of triggers) {
    console.log(chalk.cyan(`  ${trigger.event}`) + chalk.gray(` → ${trigger.id}`));
  }
  console.log(chalk.gray('\nNo public URL needed. Press Ctrl+C to stop.\n'));

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down...'));
    await socketTrigger.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await socketTrigger.stop();
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

/**
 * Start HTTP webhook server
 */
async function startHttpMode(options: {
  port: number;
  host: string;
  workflowDir: string;
  singleWorkflow?: string;
  defaultAgent: string;
}): Promise<void> {
  const { port, host, workflowDir, singleWorkflow, defaultAgent } = options;

  console.log(chalk.blue('Starting marktoflow webhook server...'));

  const stateStore = new StateStore();
  const engine = new WorkflowEngine({ defaultAgent }, {}, stateStore);
  const registry = new SDKRegistry();
  registerIntegrations(registry);

  const webhookWorkflows: Map<string, WebhookWorkflow> = new Map();
  const receiver = new WebhookReceiver({ host, port });

  // Load workflows
  const workflowFiles = findWorkflowFiles(workflowDir, singleWorkflow);

  // Parse workflows and register webhook endpoints
  for (const filePath of workflowFiles) {
    try {
      const { workflow } = await parseFile(filePath);

      if (!workflow.triggers) continue;

      for (const trigger of workflow.triggers) {
        if (trigger.type !== 'webhook') continue;

        const webhookPath = trigger.config?.['path'] as string;
        if (!webhookPath) continue;

        const provider = trigger.config?.['provider'] as string | undefined;
        const secret = trigger.config?.['secret'] as string | undefined;
        const inputMapping = trigger.config?.['inputMapping'] as Record<string, string> | undefined;

        webhookWorkflows.set(webhookPath, {
          path: filePath,
          workflow,
          webhookPath,
          provider,
          secret,
          inputMapping,
        });

        console.log(
          chalk.cyan(`  ${webhookPath}`) +
            chalk.gray(` → ${workflow.metadata.name || workflow.metadata.id}`)
        );
      }
    } catch (e) {
      console.warn(chalk.yellow(`Failed to load ${filePath}: ${e}`));
    }
  }

  if (webhookWorkflows.size === 0) {
    console.log(chalk.yellow('\nNo webhook-enabled workflows found.'));
    console.log(chalk.gray('Add a webhook trigger to your workflow:'));
    console.log(
      chalk.gray(`
triggers:
  - type: webhook
    path: /my-webhook
    config:
      provider: slack  # or github, telegram
`)
    );
    process.exit(1);
  }

  console.log(chalk.green(`\nRegistered ${webhookWorkflows.size} webhook endpoint(s)`));

  // Register all webhook endpoints
  for (const [webhookPath, wf] of webhookWorkflows) {
    receiver.registerEndpoint(
      {
        path: webhookPath,
        secret: wf.secret,
        workflowId: wf.workflow.metadata.id,
        methods: ['POST', 'GET'],
        enabled: true,
      },
      async (event: WebhookEvent): Promise<WebhookResponse> => {
        const payload = parseWebhookBody(event);

        // Handle Slack URL verification
        if (wf.provider === 'slack' && payload && typeof payload === 'object') {
          const p = payload as Record<string, unknown>;
          if (p.type === 'url_verification' && p.challenge) {
            console.log(chalk.gray(`[${webhookPath}] Slack URL verification`));
            return {
              status: 200,
              body: p.challenge as string,
              headers: { 'Content-Type': 'text/plain' },
            };
          }
        }

        // Handle Microsoft Graph validation
        if (event.method === 'GET' && event.query['validationToken']) {
          console.log(chalk.gray(`[${webhookPath}] Graph validation`));
          return {
            status: 200,
            body: event.query['validationToken'],
            headers: { 'Content-Type': 'text/plain' },
          };
        }

        // Verify signatures if secret is configured
        if (wf.secret) {
          if (wf.provider === 'slack') {
            const signature = event.headers['x-slack-signature'] || '';
            const timestamp = event.headers['x-slack-request-timestamp'] || '';
            if (!verifySlackSignature(event.body, signature, timestamp, wf.secret)) {
              console.log(chalk.red(`[${webhookPath}] Invalid Slack signature`));
              return { status: 401, body: 'Invalid signature' };
            }
          } else if (wf.provider === 'github') {
            const signature = event.headers['x-hub-signature-256'] || '';
            if (!verifyGitHubSignature(event.body, signature, wf.secret)) {
              console.log(chalk.red(`[${webhookPath}] Invalid GitHub signature`));
              return { status: 401, body: 'Invalid signature' };
            }
          }
        }

        // Skip Slack bot messages to prevent loops
        if (wf.provider === 'slack' && payload && typeof payload === 'object') {
          const p = payload as Record<string, unknown>;
          const evt = p.event as Record<string, unknown> | undefined;
          if (evt?.bot_id || evt?.subtype === 'bot_message') {
            return { status: 200, body: 'ok' };
          }
        }

        console.log(chalk.green(`[${webhookPath}] Received webhook, triggering workflow...`));

        // Build inputs from payload
        const defaultInputs = getDefaultInputsFromPayload(payload, wf.provider);
        const inputs = buildInputs(payload, wf.inputMapping, defaultInputs);

        // Execute workflow asynchronously (don't block the webhook response)
        setImmediate(async () => {
          try {
            // Re-parse to get fresh workflow instance
            const { workflow } = await parseFile(wf.path);
            registry.registerTools(workflow.tools);

            console.log(chalk.blue(`[${webhookPath}] Executing workflow with inputs:`), inputs);

            await engine.execute(workflow, inputs, registry, createSDKStepExecutor());

            console.log(chalk.green(`[${webhookPath}] Workflow completed successfully`));
          } catch (error) {
            console.error(chalk.red(`[${webhookPath}] Workflow failed:`), error);
          }
        });

        // Respond immediately to webhook
        return { status: 200, body: 'ok' };
      }
    );
  }

  // Start the server
  await receiver.start();

  console.log(chalk.green(`\n✓ Webhook server running on http://${host}:${port}`));
  console.log(chalk.gray('\nEndpoints:'));
  for (const [path] of webhookWorkflows) {
    console.log(chalk.cyan(`  http://${host}:${port}${path}`));
  }
  console.log(chalk.gray('\nPress Ctrl+C to stop.\n'));

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down...'));
    await receiver.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await receiver.stop();
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

/**
 * Find workflow files to load
 */
function findWorkflowFiles(workflowDir: string, singleWorkflow?: string): string[] {
  const workflowFilesSet = new Set<string>();

  if (singleWorkflow) {
    workflowFilesSet.add(resolve(singleWorkflow));
  } else {
    // Scan for workflow files - use only specific directories to avoid duplicates
    const resolvedDir = resolve(workflowDir);
    const scanDirs = [
      join(resolvedDir, 'examples'),
      join(resolvedDir, '.marktoflow', 'workflows'),
    ];

    // Only scan root dir if it's not going to overlap with examples/
    if (!existsSync(join(resolvedDir, 'examples'))) {
      scanDirs.unshift(resolvedDir);
    }

    for (const dir of scanDirs) {
      if (existsSync(dir)) {
        try {
          const files = readdirSync(dir, { recursive: true });
          for (const file of files) {
            const filePath = typeof file === 'string' ? file : file.toString();
            if (filePath.endsWith('.md') && filePath.includes('workflow')) {
              // Use resolved absolute path to deduplicate
              workflowFilesSet.add(resolve(join(dir, filePath)));
            }
          }
        } catch {
          // Ignore errors scanning directories
        }
      }
    }
  }

  return Array.from(workflowFilesSet);
}

/**
 * Extract default inputs based on provider-specific payload structure
 */
function getDefaultInputsFromPayload(
  payload: unknown,
  provider?: string
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const p = payload as Record<string, unknown>;

  if (provider === 'slack') {
    const event = p.event as Record<string, unknown> | undefined;
    if (event) {
      return {
        channel: event.channel,
        question: event.text,
        instructions: event.text,
        thread_ts: event.thread_ts || event.ts,
        user: event.user,
        team: p.team_id,
      };
    }
  }

  if (provider === 'telegram') {
    const message = p.message as Record<string, unknown> | undefined;
    if (message) {
      const chat = message.chat as Record<string, unknown> | undefined;
      return {
        chat_id: chat?.id,
        question: message.text,
        instructions: message.text,
        message_id: message.message_id,
        from: message.from,
      };
    }
  }

  if (provider === 'github') {
    return {
      action: p.action,
      repository: (p.repository as Record<string, unknown>)?.full_name,
      sender: (p.sender as Record<string, unknown>)?.login,
    };
  }

  // Generic: pass the whole payload
  return { payload: p };
}

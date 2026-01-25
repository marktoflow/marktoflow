/**
 * Dry-run mode for workflows
 *
 * Simulates workflow execution without actually calling external services.
 * Useful for testing workflow logic, validating steps, and debugging.
 */

import chalk from 'chalk';
import type { Workflow, ExecutionContext } from '@marktoflow/core';
import { WorkflowStatus } from '@marktoflow/core';

// ============================================================================
// Mock Response Generator
// ============================================================================

/**
 * Generate mock responses based on action type
 */
export function generateMockResponse(action: string, inputs: Record<string, unknown>): unknown {
  const [service, ...methodParts] = action.split('.');
  const method = methodParts.join('.');

  // Service-specific mock responses
  switch (service) {
    case 'slack':
      return generateSlackMock(method, inputs);
    case 'github':
      return generateGitHubMock(method, inputs);
    case 'jira':
      return generateJiraMock(method, inputs);
    case 'gmail':
      return generateGmailMock(method, inputs);
    case 'linear':
      return generateLinearMock(method, inputs);
    case 'notion':
      return generateNotionMock(method, inputs);
    case 'claude':
      return generateClaudeMock(method, inputs);
    case 'ollama':
      return generateOllamaMock(method, inputs);
    default:
      return { success: true, message: `Mock response for ${action}` };
  }
}

function generateSlackMock(method: string, inputs: Record<string, unknown>): unknown {
  switch (method) {
    case 'chat.postMessage':
      return {
        ok: true,
        ts: '1234567890.123456',
        channel: inputs.channel || 'C1234567890',
        message: {
          text: inputs.text || '',
          ts: '1234567890.123456',
        },
      };
    case 'conversations.history':
      return {
        ok: true,
        messages: [
          { type: 'message', user: 'U123', text: 'Mock message 1', ts: '1234567890.001' },
          { type: 'message', user: 'U456', text: 'Mock message 2', ts: '1234567890.002' },
        ],
      };
    case 'users.info':
      return {
        ok: true,
        user: {
          id: 'U123456',
          name: 'mockuser',
          real_name: 'Mock User',
          email: 'mock@example.com',
        },
      };
    default:
      return { ok: true, channel: inputs.channel };
  }
}

function generateGitHubMock(method: string, inputs: Record<string, unknown>): unknown {
  switch (method) {
    case 'pulls.get':
      return {
        number: inputs.pull_number || 42,
        title: 'Mock Pull Request',
        html_url: `https://github.com/${inputs.owner}/${inputs.repo}/pull/${inputs.pull_number || 42}`,
        state: 'open',
        user: { login: 'mockuser' },
        additions: 50,
        deletions: 10,
      };
    case 'pulls.listReviews':
      return [
        { id: 1, user: { login: 'reviewer1' }, state: 'APPROVED' },
        { id: 2, user: { login: 'reviewer2' }, state: 'CHANGES_REQUESTED' },
      ];
    case 'issues.create':
      return {
        number: 123,
        html_url: `https://github.com/${inputs.owner}/${inputs.repo}/issues/123`,
        title: inputs.title || 'Mock Issue',
        state: 'open',
      };
    default:
      return { id: 123, html_url: 'https://github.com/mock' };
  }
}

function generateJiraMock(method: string, inputs: Record<string, unknown>): unknown {
  switch (method) {
    case 'issues.createIssue':
    case 'issueSearch.createIssue':
      return {
        key: 'MOCK-123',
        id: '10001',
        self: 'https://jira.example.com/browse/MOCK-123',
        fields: inputs.fields || {},
      };
    case 'issueSearch.searchForIssuesUsingJql':
      return {
        issues: [
          {
            key: 'MOCK-1',
            fields: {
              summary: 'Mock Issue 1',
              status: { name: 'In Progress' },
              assignee: { displayName: 'Mock User' },
            },
          },
          {
            key: 'MOCK-2',
            fields: {
              summary: 'Mock Issue 2',
              status: { name: 'Done' },
              assignee: { displayName: 'Mock User 2' },
            },
          },
        ],
      };
    default:
      return { key: 'MOCK-123', id: '10001' };
  }
}

function generateGmailMock(method: string, _inputs: Record<string, unknown>): unknown {
  switch (method) {
    case 'users.messages.list':
      return {
        messages: [
          { id: 'msg1', threadId: 'thread1' },
          { id: 'msg2', threadId: 'thread2' },
        ],
      };
    case 'users.messages.send':
      return {
        id: 'msg123',
        threadId: 'thread123',
        labelIds: ['SENT'],
      };
    default:
      return { id: 'msg123' };
  }
}

function generateLinearMock(_method: string, inputs: Record<string, unknown>): unknown {
  return {
    id: 'issue-123',
    title: inputs.title || 'Mock Linear Issue',
    url: 'https://linear.app/team/issue/mock-123',
  };
}

function generateNotionMock(method: string, inputs: Record<string, unknown>): unknown {
  switch (method) {
    case 'pages.create':
      return {
        id: 'page-123',
        url: 'https://notion.so/page-123',
        properties: inputs.properties || {},
      };
    default:
      return { id: 'page-123', url: 'https://notion.so/page-123' };
  }
}

function generateClaudeMock(_method: string, inputs: Record<string, unknown>): unknown {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'This is a mock response from Claude. In a real execution, this would contain the actual AI-generated content based on your prompt.',
      },
    ],
    model: inputs.model || 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 50,
      output_tokens: 100,
    },
  };
}

function generateOllamaMock(_method: string, inputs: Record<string, unknown>): unknown {
  return {
    model: inputs.model || 'llama2',
    response:
      'This is a mock response from Ollama. In a real execution, this would contain the actual AI-generated content.',
    done: true,
  };
}

// ============================================================================
// Dry-Run Executor
// ============================================================================

export interface DryRunOptions {
  verbose?: boolean;
  showMockData?: boolean;
  showVariables?: boolean;
}

export interface DryRunStepResult {
  stepId: string;
  action?: string; // Optional for sub-workflows
  workflow?: string; // Path to sub-workflow
  status: 'completed' | 'skipped' | 'would-fail';
  mockOutput: unknown;
  resolvedInputs: Record<string, unknown>;
  duration: number; // simulated ms
}

export interface DryRunResult {
  workflowId: string;
  status: 'completed' | 'would-fail';
  steps: DryRunStepResult[];
  variables: Record<string, unknown>;
  duration: number;
}

/**
 * Simulate workflow execution with mock data
 */
export async function executeDryRun(
  workflow: Workflow,
  inputs: Record<string, unknown>,
  options: DryRunOptions = {}
): Promise<DryRunResult> {
  const startTime = Date.now();
  const steps: DryRunStepResult[] = [];
  const variables: Record<string, unknown> = {};
  const context: ExecutionContext = {
    workflowId: workflow.metadata.id,
    runId: 'dry-run-' + Date.now(),
    variables,
    inputs,
    startedAt: new Date(),
    currentStepIndex: 0,
    status: WorkflowStatus.RUNNING,
    stepMetadata: {},
  };

  console.log(chalk.bold.cyan('\n🧪 Dry Run Mode\n'));
  console.log(chalk.gray(`Simulating workflow: ${workflow.metadata.name}`));
  console.log(chalk.gray(`Steps: ${workflow.steps.length}\n`));

  // Simulate each step
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    context.currentStepIndex = i;

    const stepStart = Date.now();

    // Check conditions
    let stepStatus: DryRunStepResult['status'] = 'completed';
    if (step.conditions && step.conditions.length > 0) {
      const conditionMet = evaluateConditions(step.conditions, context);
      if (!conditionMet) {
        stepStatus = 'skipped';
      }
    }

    // Resolve inputs with template variables
    const resolvedInputs = resolveInputTemplates(step.inputs, context);

    // Generate mock response (skip for sub-workflows in dry-run mode)
    let mockOutput = null;
    if (stepStatus !== 'skipped') {
      if (step.action) {
        mockOutput = generateMockResponse(step.action, resolvedInputs);
      } else if (step.workflow) {
        // For sub-workflows, generate a simple mock output
        mockOutput = { subWorkflowResult: 'mock-sub-workflow-output' };
      }
    }

    // Store output variable
    if (step.outputVariable && mockOutput) {
      variables[step.outputVariable] = mockOutput;
    }

    const stepDuration = Date.now() - stepStart + Math.random() * 50; // Add small random delay

    const stepResult: DryRunStepResult = {
      stepId: step.id,
      action: step.action,
      workflow: step.workflow,
      status: stepStatus,
      mockOutput,
      resolvedInputs,
      duration: stepDuration,
    };

    steps.push(stepResult);

    // Display step result
    displayStepResult(stepResult, options);

    // Small delay for realism
    await sleep(50);
  }

  const totalDuration = Date.now() - startTime;

  return {
    workflowId: workflow.metadata.id,
    status: 'completed',
    steps,
    variables,
    duration: totalDuration,
  };
}

/**
 * Simple condition evaluation for dry-run
 */
function evaluateConditions(conditions: string[], context: ExecutionContext): boolean {
  // Very basic evaluation - just check if variables exist
  for (const condition of conditions) {
    const varName = condition.split('.')[0].trim();
    if (!(varName in context.variables)) {
      return false;
    }
  }
  return true;
}

/**
 * Resolve template variables in inputs
 */
function resolveInputTemplates(
  inputs: Record<string, unknown>,
  context: ExecutionContext
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string' && value.includes('{{')) {
      // Simple template resolution
      let resolved_value = value;
      const matches = value.matchAll(/\{\{([^}]+)\}\}/g);
      for (const match of matches) {
        const varPath = match[1].trim();
        if (varPath.startsWith('inputs.')) {
          const inputKey = varPath.slice(7);
          resolved_value = resolved_value.replace(match[0], String(context.inputs[inputKey] || ''));
        } else if (varPath in context.variables) {
          const varValue = context.variables[varPath];
          resolved_value = resolved_value.replace(match[0], String(varValue));
        }
      }
      resolved[key] = resolved_value;
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = resolveInputTemplates(value as Record<string, unknown>, context);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Display step result with formatting
 */
function displayStepResult(result: DryRunStepResult, options: DryRunOptions): void {
  const statusIcon =
    result.status === 'completed'
      ? chalk.green('✓')
      : result.status === 'skipped'
        ? chalk.yellow('○')
        : chalk.red('✗');

  const actionOrWorkflow = result.action || `workflow: ${result.workflow}` || 'unknown';

  console.log(
    `${statusIcon} ${chalk.cyan(result.stepId)} ${chalk.gray('→')} ${chalk.white(actionOrWorkflow)} ${chalk.dim(`(${result.duration.toFixed(0)}ms)`)}`
  );

  if (options.verbose) {
    if (result.status !== 'skipped' && options.showMockData) {
      console.log(
        chalk.gray('  Mock output:'),
        JSON.stringify(result.mockOutput, null, 2)
          .split('\n')
          .map((line) => `  ${chalk.dim(line)}`)
          .join('\n')
      );
    }
  }
}

/**
 * Display final summary
 */
export function displayDryRunSummary(result: DryRunResult, options: DryRunOptions): void {
  console.log(chalk.bold.cyan('\n📊 Dry Run Summary\n'));

  const completed = result.steps.filter((s) => s.status === 'completed').length;
  const skipped = result.steps.filter((s) => s.status === 'skipped').length;
  const failed = result.steps.filter((s) => s.status === 'would-fail').length;

  console.log(`  ${chalk.green('✓')} Completed: ${completed}`);
  if (skipped > 0) console.log(`  ${chalk.yellow('○')} Skipped: ${skipped}`);
  if (failed > 0) console.log(`  ${chalk.red('✗')} Would fail: ${failed}`);
  console.log(`  ${chalk.gray('⏱')}  Duration: ${result.duration.toFixed(0)}ms (simulated)`);

  if (options.showVariables && Object.keys(result.variables).length > 0) {
    console.log(chalk.bold.cyan('\n📝 Final Variables\n'));
    for (const [key, value] of Object.entries(result.variables)) {
      console.log(
        `  ${chalk.cyan(key)}: ${chalk.gray(typeof value === 'object' ? JSON.stringify(value) : String(value))}`
      );
    }
  }

  console.log(chalk.bold.green('\n✅ Dry run completed successfully\n'));
  console.log(chalk.gray('Note: No external services were called. All responses are mocked.'));
  console.log(chalk.gray('To execute for real, run without --dry-run flag.\n'));
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

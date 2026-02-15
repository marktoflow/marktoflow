/**
 * Sub-workflow execution for marktoflow workflow engine.
 *
 * Handles executing sub-workflows both directly (standard execution)
 * and via AI sub-agents.
 */

import {
  type ExecutionContext,
  type WorkflowStep,
  type SubWorkflowStep,
  WorkflowStatus,
  isSubWorkflowStep,
} from '../models.js';
import { resolveTemplates } from './variable-resolution.js';
import { parseFile } from '../parser.js';
import { resolve, dirname } from 'node:path';
import type { EngineConfig, SDKRegistryLike, StepExecutor, StepExecutorContext } from './types.js';

// Forward reference to avoid circular dependency — the engine passes itself
export type SubWorkflowExecutorFactory = (config: EngineConfig) => {
  execute: (
    workflow: import('../models.js').Workflow,
    inputs: Record<string, unknown>,
    sdkRegistry: SDKRegistryLike,
    stepExecutor: StepExecutor,
  ) => Promise<import('../models.js').WorkflowResult>;
  workflowPath?: string;
};

/**
 * Execute a sub-workflow.
 */
export async function executeSubWorkflow(
  step: WorkflowStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  workflowPath: string | undefined,
  createSubEngine: SubWorkflowExecutorFactory,
  engineConfig: EngineConfig,
): Promise<unknown> {
  if (!isSubWorkflowStep(step)) {
    throw new Error(`Step ${step.id} is not a workflow step`);
  }

  // Resolve the sub-workflow path relative to the parent workflow
  const subWorkflowPath = workflowPath
    ? resolve(dirname(workflowPath), step.workflow)
    : resolve(step.workflow);

  // Parse the sub-workflow
  const { workflow: subWorkflow } = await parseFile(subWorkflowPath);

  // Resolve inputs for the sub-workflow
  const resolvedInputs = resolveTemplates(step.inputs, context) as Record<string, unknown>;

  // Create a new engine instance for the sub-workflow
  const subEngine = createSubEngine(engineConfig);
  subEngine.workflowPath = subWorkflowPath;

  // Execute the sub-workflow
  const result = await subEngine.execute(subWorkflow, resolvedInputs, sdkRegistry, stepExecutor);

  // Check if sub-workflow failed
  if (result.status === WorkflowStatus.FAILED) {
    throw new Error(result.error || 'Sub-workflow execution failed');
  }

  // Return the sub-workflow output
  return result.output;
}

/**
 * Execute a sub-workflow using an AI sub-agent.
 * The agent interprets the workflow and executes it autonomously.
 */
export async function executeSubWorkflowWithAgent(
  step: SubWorkflowStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  stepExecutor: StepExecutor,
  workflowPath: string | undefined,
  defaultModel: string | undefined,
  defaultAgent: string | undefined,
  buildStepExecutorContext: (step: WorkflowStep) => StepExecutorContext,
): Promise<unknown> {
  // Resolve the sub-workflow path
  const subWorkflowPath = workflowPath
    ? resolve(dirname(workflowPath), step.workflow)
    : resolve(step.workflow);

  // Read the workflow file content
  const { readFile } = await import('node:fs/promises');
  const workflowContent = await readFile(subWorkflowPath, 'utf-8');

  // Resolve inputs for the sub-workflow
  const resolvedInputs = resolveTemplates(step.inputs, context) as Record<string, unknown>;

  // Get subagent configuration
  const subagentConfig = step.subagentConfig || {};
  const model = subagentConfig.model || step.model || defaultModel;
  const maxTurns = subagentConfig.maxTurns || 10;
  const systemPrompt = subagentConfig.systemPrompt || buildDefaultSubagentSystemPrompt();
  const tools = subagentConfig.tools || ['Read', 'Write', 'Bash', 'Glob', 'Grep'];

  // Build the prompt for the agent
  const agentPrompt = buildSubagentPrompt(workflowContent, resolvedInputs, tools);

  // Determine the agent action to use
  const agentName = step.agent || defaultAgent || 'agent';
  const agentAction = `${agentName}.chat.completions`;

  // Build the messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: agentPrompt },
  ];

  // Create a virtual action step to execute via the agent
  const agentStep: WorkflowStep = {
    id: `${step.id}-subagent`,
    type: 'action',
    action: agentAction,
    inputs: {
      model,
      messages,
      max_tokens: 8192,
    },
    model,
    agent: agentName,
  };

  // Build executor context
  const executorContext = buildStepExecutorContext(agentStep);

  // Execute the agent call
  let response: unknown;
  let turns = 0;
  let conversationMessages = [...messages];
  let finalOutput: Record<string, unknown> = {};

  while (turns < maxTurns) {
    turns++;

    try {
      response = await stepExecutor(
        { ...agentStep, inputs: { ...agentStep.inputs, messages: conversationMessages } },
        context,
        sdkRegistry,
        executorContext,
      );

      // Parse the response
      const parsedResponse = parseSubagentResponse(response);

      if (parsedResponse.completed) {
        finalOutput = parsedResponse.output || {};
        break;
      }

      // If agent needs to continue, add its response and continue
      if (parsedResponse.message) {
        conversationMessages.push({ role: 'assistant', content: parsedResponse.message });
        conversationMessages.push({ role: 'user', content: 'Continue with the workflow execution.' });
      } else {
        finalOutput = parsedResponse.output || {};
        break;
      }
    } catch (error) {
      throw new Error(
        `Sub-agent execution failed at turn ${turns}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (turns >= maxTurns) {
    throw new Error(`Sub-agent exceeded maximum turns (${maxTurns})`);
  }

  return finalOutput;
}

/**
 * Build the default system prompt for sub-agent execution.
 */
function buildDefaultSubagentSystemPrompt(): string {
  return `You are an AI agent executing a workflow. Your task is to interpret the workflow definition and execute each step in order.

For each step:
1. Understand what the step requires
2. Execute the action described
3. Store any outputs as specified

When you complete all steps, respond with a JSON object containing the workflow outputs.

Format your final response as:
\`\`\`json
{
  "completed": true,
  "output": { /* workflow outputs here */ }
}
\`\`\`

If you encounter an error, respond with:
\`\`\`json
{
  "completed": false,
  "error": "description of the error"
}
\`\`\``;
}

/**
 * Build the prompt for sub-agent workflow execution.
 */
function buildSubagentPrompt(
  workflowContent: string,
  inputs: Record<string, unknown>,
  tools: string[],
): string {
  return `Execute the following workflow:

## Workflow Definition
\`\`\`markdown
${workflowContent}
\`\`\`

## Inputs
\`\`\`json
${JSON.stringify(inputs, null, 2)}
\`\`\`

## Available Tools
${tools.join(', ')}

Execute the workflow steps in order and return the final outputs as JSON.`;
}

/**
 * Parse the sub-agent's response to extract completion status and output.
 */
export function parseSubagentResponse(response: unknown): {
  completed: boolean;
  output?: Record<string, unknown>;
  message?: string;
  error?: string;
} {
  // Try to extract content from various response formats
  let content: string | undefined;

  if (typeof response === 'string') {
    content = response;
  } else if (response && typeof response === 'object') {
    const resp = response as Record<string, unknown>;

    // OpenAI-style response
    if (resp.choices && Array.isArray(resp.choices)) {
      const choice = resp.choices[0] as Record<string, unknown>;
      if (choice.message && typeof choice.message === 'object') {
        const message = choice.message as Record<string, unknown>;
        content = message.content as string;
      }
    }
    // Anthropic-style response
    else if (resp.content && Array.isArray(resp.content)) {
      const textBlock = resp.content.find(
        (c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text',
      ) as Record<string, unknown> | undefined;
      content = textBlock?.text as string;
    }
    // Direct content field
    else if (typeof resp.content === 'string') {
      content = resp.content;
    }
    // Direct message field
    else if (typeof resp.message === 'string') {
      content = resp.message;
    }
  }

  if (!content) {
    return { completed: false, message: 'No content in response' };
  }

  // Try to parse JSON from the response
  const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      const output = parsed.output as Record<string, unknown> | undefined;
      const error = parsed.error as string | undefined;
      return {
        completed: parsed.completed === true,
        ...(output !== undefined ? { output } : {}),
        ...(error !== undefined ? { error } : {}),
      };
    } catch (e) {
      console.warn('[marktoflow] Failed to parse JSON block in sub-agent response:', (e as Error).message);
    }
  }

  // Try to parse raw JSON
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.completed === 'boolean') {
      const output = parsed.output as Record<string, unknown> | undefined;
      const error = parsed.error as string | undefined;
      return {
        completed: parsed.completed,
        ...(output !== undefined ? { output } : {}),
        ...(error !== undefined ? { error } : {}),
      };
    }
  } catch (e) {
    console.warn('[marktoflow] Sub-agent response is not valid JSON:', (e as Error).message);
  }

  // Return the content as a message
  return { completed: false, message: content };
}

/**
 * AI Agent override utilities for CLI commands
 */

import chalk from 'chalk';
import type { Workflow } from '@marktoflow/core';

/** List of known AI agent SDK names */
export const AI_AGENT_SDKS = [
  'claude',
  'claude-agent',
  'openai',
  'openai-compatible',
  'vllm',
  'github-copilot',
  'copilot',
  'opencode',
  'ollama',
  'codex',
] as const;

export type AIAgentSDK = (typeof AI_AGENT_SDKS)[number];

/**
 * Check if an SDK name is an AI agent
 */
export function isAIAgentSDK(sdk: string): sdk is AIAgentSDK {
  return AI_AGENT_SDKS.includes(sdk as AIAgentSDK);
}

export interface AgentOverrideOptions {
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Whether to show debug output */
  debug?: boolean;
}

export interface AgentOverrideResult {
  /** Number of tools replaced */
  replacedCount: number;
  /** Whether a new agent tool was added */
  addedNewTool: boolean;
}

/**
 * Override AI agent tools in a workflow
 *
 * Replaces existing AI agent tools with the specified agent, or adds a new
 * 'agent' tool if no AI tools exist.
 */
export function overrideAgentInWorkflow(
  workflow: Workflow,
  sdkName: string,
  authConfig: Record<string, string>,
  options?: AgentOverrideOptions
): AgentOverrideResult {
  const result: AgentOverrideResult = {
    replacedCount: 0,
    addedNewTool: false,
  };

  const toolKeys = Object.keys(workflow.tools);
  for (const toolKey of toolKeys) {
    const toolConfig = workflow.tools[toolKey];
    if (toolConfig?.sdk && isAIAgentSDK(toolConfig.sdk)) {
      // Replace SDK but keep the tool name
      workflow.tools[toolKey] = {
        sdk: sdkName,
        auth: authConfig,
      };
      result.replacedCount++;

      if (options?.verbose || options?.debug) {
        console.log(chalk.cyan(`  Replaced tool '${toolKey}' with ${sdkName}`));
      }
    }
  }

  // If no AI tools were found, add one with a common name
  if (result.replacedCount === 0) {
    workflow.tools['agent'] = {
      sdk: sdkName,
      auth: authConfig,
    };
    result.addedNewTool = true;

    if (options?.verbose || options?.debug) {
      console.log(chalk.cyan(`  Added AI agent 'agent' (${sdkName})`));
    }
  }

  return result;
}

/**
 * Debug log agent override configuration
 */
export function debugLogAgentOverride(
  agentName: string,
  sdkName: string,
  replacedCount: number,
  authConfig: Record<string, string>
): void {
  console.log(chalk.gray('\n🐛 Debug: AI Agent Override'));
  console.log(chalk.gray(`  Provider: ${agentName} -> ${sdkName}`));
  console.log(chalk.gray(`  Replaced ${replacedCount} existing AI tool(s)`));
  console.log(chalk.gray(`  Auth Config: ${JSON.stringify(authConfig, null, 2).split('\n').join('\n  ')}`));
}

export interface ModelOverrideResult {
  /** Number of tools with model override applied */
  overrideCount: number;
}

/**
 * Override the model for all AI agent tools in a workflow
 */
export function overrideModelInWorkflow(
  workflow: Workflow,
  model: string,
  _options?: AgentOverrideOptions
): ModelOverrideResult {
  const result: ModelOverrideResult = {
    overrideCount: 0,
  };

  const toolKeys = Object.keys(workflow.tools);
  for (const toolKey of toolKeys) {
    const toolConfig = workflow.tools[toolKey];
    if (toolConfig?.sdk && isAIAgentSDK(toolConfig.sdk)) {
      if (!toolConfig.options) {
        toolConfig.options = {};
      }
      toolConfig.options.model = model;
      result.overrideCount++;
    }
  }

  return result;
}

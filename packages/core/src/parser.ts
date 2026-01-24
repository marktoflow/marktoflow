/**
 * Workflow Parser for marktoflow v2.0
 *
 * Parses markdown workflow files with YAML frontmatter.
 * Extracts workflow metadata, tool configurations, and step definitions.
 */

import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import {
  Workflow,
  WorkflowSchema,
  WorkflowStep,
  WorkflowStepSchema,
  ToolConfig,
  ToolConfigSchema,
  Trigger,
} from './models.js';

// ============================================================================
// Types
// ============================================================================

export interface ParseResult {
  workflow: Workflow;
  warnings: string[];
}

export interface ParseOptions {
  /** Validate the workflow after parsing */
  validate?: boolean;
  /** Resolve environment variables in the workflow */
  resolveEnv?: boolean;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

// ============================================================================
// Parser Implementation
// ============================================================================

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
const STEP_CODE_BLOCK_REGEX = /```ya?ml\n([\s\S]*?)```/g;

/**
 * Parse a workflow from a markdown file.
 */
export async function parseFile(path: string, options: ParseOptions = {}): Promise<ParseResult> {
  const content = await readFile(path, 'utf-8');
  return parseContent(content, options);
}

/**
 * Parse a workflow from markdown content.
 */
export function parseContent(content: string, options: ParseOptions = {}): ParseResult {
  const { validate = true, resolveEnv = true } = options;
  const warnings: string[] = [];

  // Extract frontmatter
  const frontmatterMatch = content.match(FRONTMATTER_REGEX);
  if (!frontmatterMatch) {
    throw new ParseError('No YAML frontmatter found. Workflow must start with ---');
  }

  const frontmatterYaml = frontmatterMatch[1];
  let frontmatter: Record<string, unknown>;

  try {
    frontmatter = parseYaml(frontmatterYaml) as Record<string, unknown>;
  } catch (error) {
    throw new ParseError('Invalid YAML in frontmatter', undefined, error);
  }

  // Extract markdown body (after frontmatter)
  const markdownBody = content.slice(frontmatterMatch[0].length).trim();

  // Parse workflow structure
  const workflow = buildWorkflow(frontmatter, markdownBody, warnings);

  // Resolve environment variables
  if (resolveEnv) {
    resolveEnvironmentVariables(workflow);
  }

  // Validate with Zod
  if (validate) {
    const result = WorkflowSchema.safeParse(workflow);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      throw new ParseError(`Workflow validation failed:\n${issues.join('\n')}`);
    }
  }

  return { workflow, warnings };
}

/**
 * Build a Workflow object from parsed frontmatter and markdown body.
 */
function buildWorkflow(
  frontmatter: Record<string, unknown>,
  markdownBody: string,
  warnings: string[]
): Workflow {
  // Extract metadata
  const workflowMeta = (frontmatter.workflow as Record<string, unknown>) || {};
  const metadata = {
    id: (workflowMeta.id as string) || 'unnamed',
    name: (workflowMeta.name as string) || 'Unnamed Workflow',
    version: (workflowMeta.version as string) || '1.0.0',
    description: workflowMeta.description as string | undefined,
    author: workflowMeta.author as string | undefined,
    tags: workflowMeta.tags as string[] | undefined,
  };

  // Extract tools
  const toolsRaw = (frontmatter.tools as Record<string, unknown>) || {};
  const tools: Record<string, ToolConfig> = {};

  for (const [name, config] of Object.entries(toolsRaw)) {
    const toolResult = ToolConfigSchema.safeParse(config);
    if (toolResult.success) {
      tools[name] = toolResult.data;
    } else {
      warnings.push(`Invalid tool configuration for '${name}': ${toolResult.error.message}`);
    }
  }

  // Extract inputs (validated later by Zod)
  const inputsRaw = frontmatter.inputs as Record<string, unknown> | undefined;
  const inputs = inputsRaw as Workflow['inputs'];

  // Extract triggers (validated later by Zod)
  const triggersRaw = frontmatter.triggers as Array<Record<string, unknown>> | undefined;
  const triggers = triggersRaw?.map((t) => ({
    type: t.type as Trigger['type'],
    enabled: t.enabled !== false,
    config: (t.config as Record<string, unknown>) || {},
  }));

  // Extract steps from frontmatter or markdown body
  let steps: WorkflowStep[] = [];

  if (frontmatter.steps && Array.isArray(frontmatter.steps)) {
    // Steps defined in frontmatter
    steps = parseStepsFromFrontmatter(frontmatter.steps as Array<Record<string, unknown>>, warnings);
  } else {
    // Steps defined in markdown code blocks
    steps = parseStepsFromMarkdown(markdownBody, warnings);
  }

  return {
    metadata,
    tools,
    inputs,
    triggers,
    steps,
    rawContent: markdownBody,
  };
}

/**
 * Parse steps from frontmatter array.
 */
function parseStepsFromFrontmatter(
  stepsArray: Array<Record<string, unknown>>,
  warnings: string[]
): WorkflowStep[] {
  const steps: WorkflowStep[] = [];

  for (let i = 0; i < stepsArray.length; i++) {
    const stepRaw = stepsArray[i];
    const step = normalizeStep(stepRaw, i);

    const result = WorkflowStepSchema.safeParse(step);
    if (result.success) {
      steps.push(result.data);
    } else {
      warnings.push(`Invalid step at index ${i}: ${result.error.message}`);
    }
  }

  return steps;
}

/**
 * Parse steps from markdown code blocks.
 */
function parseStepsFromMarkdown(markdown: string, warnings: string[]): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  let stepIndex = 0;

  // Find all YAML code blocks
  let match;
  while ((match = STEP_CODE_BLOCK_REGEX.exec(markdown)) !== null) {
    const yamlContent = match[1];

    try {
      const stepRaw = parseYaml(yamlContent) as Record<string, unknown>;

      // Skip non-step code blocks (e.g., trigger definitions)
      if (!stepRaw.action) {
        continue;
      }

      const step = normalizeStep(stepRaw, stepIndex);
      const result = WorkflowStepSchema.safeParse(step);

      if (result.success) {
        steps.push(result.data);
        stepIndex++;
      } else {
        warnings.push(`Invalid step in markdown: ${result.error.message}`);
      }
    } catch (error) {
      warnings.push(`Failed to parse YAML code block: ${error}`);
    }
  }

  return steps;
}

/**
 * Normalize a step object, converting snake_case to camelCase.
 */
function normalizeStep(raw: Record<string, unknown>, index: number): Record<string, unknown> {
  return {
    id: raw.id || `step-${index + 1}`,
    name: raw.name,
    action: raw.action,
    inputs: raw.inputs || {},
    outputVariable: raw.output_variable || raw.outputVariable,
    conditions: raw.conditions,
    errorHandling: normalizeErrorHandling(raw.error_handling || raw.errorHandling || raw.on_error),
    timeout: raw.timeout,
  };
}

/**
 * Normalize error handling configuration.
 */
function normalizeErrorHandling(
  raw: unknown
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;
  return {
    action: obj.action,
    maxRetries: obj.max_retries || obj.maxRetries,
    retryDelaySeconds: obj.retry_delay_seconds || obj.retryDelaySeconds,
    fallbackAction: obj.fallback_action || obj.fallbackAction,
  };
}

/**
 * Resolve environment variable references in the workflow.
 * Replaces ${VAR_NAME} with process.env.VAR_NAME.
 */
function resolveEnvironmentVariables(workflow: Workflow): void {
  const resolve = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        return process.env[varName] || '';
      });
    }
    if (Array.isArray(value)) {
      return value.map(resolve);
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = resolve(v);
      }
      return result;
    }
    return value;
  };

  // Resolve in tools
  for (const toolConfig of Object.values(workflow.tools)) {
    if (toolConfig.auth) {
      toolConfig.auth = resolve(toolConfig.auth) as Record<string, string>;
    }
    if (toolConfig.options) {
      toolConfig.options = resolve(toolConfig.options) as Record<string, unknown>;
    }
  }

  // Resolve in inputs defaults
  if (workflow.inputs) {
    for (const input of Object.values(workflow.inputs)) {
      if (input.default !== undefined) {
        input.default = resolve(input.default);
      }
    }
  }
}

/**
 * Extract variable references from a template string.
 * Returns list of variable names like ["var1", "var2"].
 */
export function extractVariableReferences(template: string): string[] {
  const varRegex = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = varRegex.exec(template)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
}

/**
 * Validate that all variable references in steps are defined.
 */
export function validateVariableReferences(workflow: Workflow): string[] {
  const errors: string[] = [];
  const definedVars = new Set<string>();

  // Add input variables
  if (workflow.inputs) {
    for (const name of Object.keys(workflow.inputs)) {
      definedVars.add(`inputs.${name}`);
    }
  }

  // Check each step
  for (const step of workflow.steps) {
    // Check input values for variable references
    const inputJson = JSON.stringify(step.inputs);
    const refs = extractVariableReferences(inputJson);

    for (const ref of refs) {
      if (!definedVars.has(ref) && !ref.startsWith('inputs.')) {
        errors.push(`Step '${step.id}' references undefined variable: ${ref}`);
      }
    }

    // Add output variable to defined set
    if (step.outputVariable) {
      definedVars.add(step.outputVariable);
    }
  }

  return errors;
}

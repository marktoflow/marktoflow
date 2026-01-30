/**
 * Prompt Loader for marktoflow v2.0
 *
 * Loads external prompt files with optional YAML frontmatter for variable definitions.
 * Supports template variable resolution using {{ prompt.variable }} syntax.
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ExecutionContext } from './models.js';

// ============================================================================
// Types
// ============================================================================

export interface PromptVariable {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean | undefined;
  default: unknown;
  description: string | undefined;
}

export interface LoadedPrompt {
  name: string | undefined;
  description: string | undefined;
  variables: Record<string, PromptVariable>;
  content: string;
  rawContent: string;
  filePath: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ResolvedPrompt {
  content: string;
  variables: Record<string, unknown>;
}

// ============================================================================
// Prompt Loading
// ============================================================================

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/;

/**
 * Load a prompt file with optional YAML frontmatter.
 */
export async function loadPromptFile(
  promptPath: string,
  basePath?: string
): Promise<LoadedPrompt> {
  // Resolve path relative to base path if provided
  const resolvedPath = basePath ? resolve(dirname(basePath), promptPath) : resolve(promptPath);

  let content: string;
  try {
    content = await readFile(resolvedPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load prompt file: ${resolvedPath}. ${error}`);
  }

  // Parse frontmatter if present
  const frontmatterMatch = content.match(FRONTMATTER_REGEX);
  let frontmatter: Record<string, unknown> = {};
  let promptContent = content;

  if (frontmatterMatch) {
    try {
      frontmatter = parseYaml(frontmatterMatch[1]) as Record<string, unknown>;
      promptContent = content.slice(frontmatterMatch[0].length).trim();
    } catch (error) {
      throw new Error(`Invalid YAML frontmatter in prompt file: ${resolvedPath}. ${error}`);
    }
  }

  // Extract variables
  const variables: Record<string, PromptVariable> = {};
  const variablesRaw = frontmatter.variables as Record<string, unknown> | undefined;

  if (variablesRaw) {
    for (const [name, config] of Object.entries(variablesRaw)) {
      if (typeof config === 'object' && config !== null) {
        const varConfig = config as Record<string, unknown>;
        variables[name] = {
          type: (varConfig.type as PromptVariable['type']) || 'string',
          required: varConfig.required as boolean | undefined,
          default: varConfig.default,
          description: varConfig.description as string | undefined,
        };
      } else {
        // Simple type definition
        variables[name] = {
          type: (config as PromptVariable['type']) || 'string',
          required: undefined,
          default: undefined,
          description: undefined,
        };
      }
    }
  }

  return {
    name: frontmatter.name as string | undefined,
    description: frontmatter.description as string | undefined,
    variables,
    content: promptContent,
    rawContent: content,
    filePath: resolvedPath,
  };
}

// ============================================================================
// Template Resolution
// ============================================================================

/**
 * Resolve {{ prompt.variable }} templates in a prompt.
 */
export function resolvePromptTemplate(
  prompt: LoadedPrompt,
  inputs: Record<string, unknown>,
  context?: ExecutionContext
): ResolvedPrompt {
  // Build resolved variables with defaults
  const resolvedVars: Record<string, unknown> = {};

  // Apply defaults first
  for (const [name, config] of Object.entries(prompt.variables)) {
    if (config.default !== undefined) {
      resolvedVars[name] = config.default;
    }
  }

  // Override with provided inputs
  for (const [name, value] of Object.entries(inputs)) {
    resolvedVars[name] = value;
  }

  // Resolve templates in prompt content
  let content = prompt.content;

  // Replace {{ prompt.variable }} patterns
  content = content.replace(/\{\{\s*prompt\.([^}]+)\s*\}\}/g, (_, varPath) => {
    const trimmedPath = varPath.trim();
    const value = getNestedValue(resolvedVars, trimmedPath);
    return serializeValue(value);
  });

  // Also resolve {{ variable }} patterns (for backward compatibility)
  content = content.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, varPath) => {
    const trimmedPath = varPath.trim();

    // Skip if it doesn't look like a variable reference
    if (trimmedPath.includes('.') && !trimmedPath.startsWith('prompt.')) {
      // Try to resolve from context if available
      if (context) {
        const value = resolveFromContext(trimmedPath, context);
        if (value !== undefined) {
          return serializeValue(value);
        }
      }
    }

    // Try to resolve from prompt inputs
    const value = getNestedValue(resolvedVars, trimmedPath);
    if (value !== undefined) {
      return serializeValue(value);
    }

    // Leave unresolved templates as-is (they may be resolved later)
    return match;
  });

  return {
    content,
    variables: resolvedVars,
  };
}

/**
 * Resolve a variable path from execution context.
 */
function resolveFromContext(path: string, context: ExecutionContext): unknown {
  // Handle inputs.* prefix
  if (path.startsWith('inputs.')) {
    const inputPath = path.slice(7);
    return getNestedValue(context.inputs, inputPath);
  }

  // Check variables
  const fromVars = getNestedValue(context.variables, path);
  if (fromVars !== undefined) {
    return fromVars;
  }

  return undefined;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that all required prompt inputs are provided.
 */
export function validatePromptInputs(
  prompt: LoadedPrompt,
  inputs: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [name, config] of Object.entries(prompt.variables)) {
    const value = inputs[name];
    const hasValue = value !== undefined && value !== null;

    // Check required
    if (config.required && !hasValue && config.default === undefined) {
      errors.push(`Missing required prompt variable: ${name}`);
      continue;
    }

    // Type validation (if value is provided)
    if (hasValue) {
      const typeError = validateType(value, config.type, name);
      if (typeError) {
        errors.push(typeError);
      }
    }
  }

  // Warn about unused inputs
  for (const name of Object.keys(inputs)) {
    if (!prompt.variables[name]) {
      warnings.push(`Unused prompt input: ${name}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a value against an expected type.
 */
function validateType(value: unknown, type: PromptVariable['type'], name: string): string | null {
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Expected string for ${name}, got ${typeof value}`;
      }
      break;

    case 'number':
      if (typeof value !== 'number') {
        return `Expected number for ${name}, got ${typeof value}`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Expected boolean for ${name}, got ${typeof value}`;
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return `Expected array for ${name}, got ${typeof value}`;
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return `Expected object for ${name}, got ${Array.isArray(value) ? 'array' : typeof value}`;
      }
      break;
  }

  return null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Serialize a value for template interpolation.
 */
function serializeValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Extract all variable references from a prompt template.
 */
export function extractPromptVariables(content: string): string[] {
  const variables = new Set<string>();

  // Extract {{ prompt.variable }} patterns
  const promptVarRegex = /\{\{\s*prompt\.([^}]+)\s*\}\}/g;
  let match;
  while ((match = promptVarRegex.exec(content)) !== null) {
    variables.add(match[1].trim());
  }

  return Array.from(variables);
}

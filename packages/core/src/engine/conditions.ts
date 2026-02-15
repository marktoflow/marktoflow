/**
 * Condition evaluation for marktoflow workflow engine.
 *
 * Evaluates step conditions using simple comparison operators
 * and variable resolution from the execution context.
 */

import type { ExecutionContext } from '../models.js';
import { resolveVariablePath } from './variable-resolution.js';
import { renderTemplate } from '../template-engine.js';

/**
 * Evaluate multiple conditions (AND logic - all must be true).
 */
export function evaluateConditions(conditions: string[], context: ExecutionContext): boolean {
  for (const condition of conditions) {
    if (!evaluateCondition(condition, context)) {
      return false;
    }
  }
  return true;
}

/**
 * Evaluate a single condition.
 * Supports: ==, !=, >, <, >=, <=
 * Also supports nested property access (e.g., check_result.success)
 * and step status checks (e.g., step_id.status == 'failed')
 */
export function evaluateCondition(condition: string, context: ExecutionContext): boolean {
  // Simple expression parsing
  const operators = ['==', '!=', '>=', '<=', '>', '<'];
  let operator: string | undefined;
  let parts: string[] = [];

  for (const op of operators) {
    if (condition.includes(op)) {
      operator = op;
      parts = condition.split(op).map((s) => s.trim());
      break;
    }
  }

  if (!operator || parts.length !== 2) {
    // Treat as boolean variable reference with nested property support
    const value = resolveConditionValue(parts[0] || condition, context);
    return Boolean(value);
  }

  const left = resolveConditionValue(parts[0], context);
  const right = parseValue(parts[1]);

  switch (operator) {
    case '==':
      return left == right;
    case '!=':
      return left != right;
    case '>':
      return Number(left) > Number(right);
    case '<':
      return Number(left) < Number(right);
    case '>=':
      return Number(left) >= Number(right);
    case '<=':
      return Number(left) <= Number(right);
    default:
      return false;
  }
}

/**
 * Resolve a condition value with support for nested properties.
 * Handles direct variable references and nested paths.
 * Uses Nunjucks for template expressions with filters/regex.
 */
export function resolveConditionValue(path: string, context: ExecutionContext): unknown {
  // If it looks like a template expression, resolve it
  if (path.includes('|') || path.includes('=~') || path.includes('!~')) {
    // Build template context
    const templateContext: Record<string, unknown> = {
      inputs: context.inputs,
      ...context.variables,
    };
    return renderTemplate(`{{ ${path} }}`, templateContext);
  }

  // First try to parse as a literal value (true, false, numbers, etc.)
  const parsedValue = parseValue(path);

  // If parseValue returned the same string, try to resolve as a variable
  if (parsedValue === path) {
    const resolved = resolveVariablePath(path, context);
    return resolved;
  }

  // Return the parsed literal value
  return parsedValue;
}

/**
 * Parse a value from a condition string.
 */
export function parseValue(value: string): unknown {
  // Remove quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  // Numbers
  if (!isNaN(Number(value))) {
    return Number(value);
  }

  // Booleans
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  return value;
}

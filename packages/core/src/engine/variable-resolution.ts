/**
 * Variable and template resolution for marktoflow workflow engine.
 *
 * Handles resolving template expressions ({{ variable }}) and
 * navigating nested variable paths in the execution context.
 */

import type { ExecutionContext } from '../models.js';
import { renderTemplate } from '../template-engine.js';

/**
 * Resolve template variables in a value.
 * Supports {{variable}}, {{inputs.name}}, and Nunjucks filters.
 *
 * Uses Nunjucks as the template engine with:
 * - Legacy regex operator support (=~, !~, //) converted to filters
 * - Custom filters for string, array, object, date operations
 * - Jinja2-style control flow ({% for %}, {% if %}, etc.)
 */
export function resolveTemplates(value: unknown, context: ExecutionContext): unknown {
  if (typeof value === 'string') {
    // Build the template context with all available variables
    // Spread inputs first, then variables (variables override inputs if same key)
    // Also keep inputs accessible via inputs.* for explicit access
    const templateContext: Record<string, unknown> = {
      ...context.inputs, // Spread inputs at root level for direct access ({{ path }})
      ...context.variables, // Variables override inputs if same key
      inputs: context.inputs, // Also keep inputs accessible as inputs.*
    };

    // Use the new Nunjucks-based template engine with legacy syntax support
    return renderTemplate(value, templateContext);
  }

  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplates(v, context));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveTemplates(v, context);
    }
    return result;
  }

  return value;
}

/**
 * Resolve a variable path from context.
 * First checks inputs.*, then variables, then stepMetadata, then direct context properties.
 * Exported to allow access from condition evaluation.
 */
export function resolveVariablePath(path: string, context: ExecutionContext): unknown {
  // Handle inputs.* prefix
  if (path.startsWith('inputs.')) {
    const inputPath = path.slice(7); // Remove 'inputs.'
    return getNestedValue(context.inputs, inputPath);
  }

  // Check variables first (most common case)
  const fromVars = getNestedValue(context.variables, path);
  if (fromVars !== undefined) {
    return fromVars;
  }

  // Check inputs (for bare variable names like "value" instead of "inputs.value")
  const fromInputs = getNestedValue(context.inputs, path);
  if (fromInputs !== undefined) {
    return fromInputs;
  }

  // Check step metadata (for status checks like: step_id.status)
  const fromStepMeta = getNestedValue(context.stepMetadata, path);
  if (fromStepMeta !== undefined) {
    return fromStepMeta;
  }

  // Fall back to direct context access
  return getNestedValue(context as Record<string, unknown>, path);
}

/**
 * Get a nested value from an object using dot notation and array indexing.
 * Supports paths like: "user.name", "items[0].name", "data.users[1].email"
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  // Parse path into parts, handling both dot notation and array indexing
  // Convert "a.b[0].c[1]" into ["a", "b", "0", "c", "1"]
  const parts: string[] = [];
  let current = '';

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === '.') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (char === '[') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (char === ']') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  // Traverse the object using the parsed parts
  let result: unknown = obj;

  for (const part of parts) {
    if (result === null || result === undefined) {
      return undefined;
    }

    // Check if part is a number (array index)
    const index = Number(part);
    if (!isNaN(index) && Array.isArray(result)) {
      result = result[index];
    } else if (typeof result === 'object') {
      result = (result as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return result;
}

/**
 * Template Engine for marktoflow v2.0
 *
 * Powered by Nunjucks - a powerful templating engine with Jinja2-style syntax.
 *
 * Features:
 * - Variable interpolation: {{ variable }}, {{ obj.property }}, {{ arr[0] }}
 * - Filters: {{ value | upper }}, {{ value | split('/') | first }}
 * - Control flow: {% for item in items %}, {% if condition %}
 * - Custom filters for regex, dates, JSON, and more (see nunjucks-filters.ts)
 *
 * Type preservation:
 * - Single {{ expr }} returns the actual type (object, array, number, etc.)
 * - Multiple expressions or mixed text returns a string
 */

import nunjucks from 'nunjucks';
import { registerFilters } from './nunjucks-filters.js';

// ============================================================================
// Environment Setup
// ============================================================================

// Create Nunjucks environment with custom settings
const env = new nunjucks.Environment(null, {
  autoescape: false, // Don't HTML escape (we're not generating HTML)
  throwOnUndefined: false, // Return undefined for missing variables
  trimBlocks: true, // Remove newline after block tags
  lstripBlocks: true, // Remove whitespace before block tags
});

// Register all custom filters
registerFilters(env);

// ============================================================================
// Template Resolution
// ============================================================================

/**
 * Render a template string with context.
 *
 * If the entire template is a single {{expr}}, returns the raw value (object, array, etc.)
 * Otherwise, returns the interpolated string.
 *
 * @param template The template string with {{ }} expressions
 * @param context Variables available in the template
 * @returns The resolved value (could be any type)
 *
 * @example
 * // Single expression - preserves type
 * renderTemplate('{{ user }}', { user: { name: 'Alice' } })
 * // Returns: { name: 'Alice' }
 *
 * @example
 * // With filters
 * renderTemplate('{{ path | split("/") | first }}', { path: 'owner/repo' })
 * // Returns: 'owner'
 *
 * @example
 * // String interpolation
 * renderTemplate('Hello {{ name }}!', { name: 'World' })
 * // Returns: 'Hello World!'
 *
 * @example
 * // Control flow
 * renderTemplate('{% for i in items %}{{ i }}{% endfor %}', { items: [1, 2, 3] })
 * // Returns: '123'
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): unknown {
  // Check if the entire string is a single template expression
  const singleTemplateMatch = template.match(/^\{\{\s*([^}]+?)\s*\}\}$/);

  if (singleTemplateMatch) {
    // Single expression - return the actual value (could be object, array, etc.)
    const expression = singleTemplateMatch[1].trim();
    return evaluateExpression(expression, context);
  }

  // String with multiple expressions, control flow, or plain text - render as string
  try {
    return env.renderString(template, context);
  } catch (error) {
    // If rendering fails, return the original template
    console.error('Template render error:', error);
    return template;
  }
}

/**
 * Evaluate a single expression and return its value.
 * This is used for single {{expr}} templates where we want to preserve
 * the actual type (object, array, number, etc.) instead of stringifying.
 */
function evaluateExpression(expression: string, context: Record<string, unknown>): unknown {
  try {
    // For simple variable references (no filters or operators), use direct lookup
    // This preserves object/array types that Nunjucks would stringify
    const simpleVarMatch = expression.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\]|\['[^']+'\]|\["[^"]+"\])*$/
    );

    if (simpleVarMatch && !expression.includes('|')) {
      // Simple variable path - resolve directly for better type preservation
      const result = resolveVariablePath(expression, context);
      return result !== undefined ? result : '';
    }

    // Has filters or complex expression - use Nunjucks with JSON serialization
    // to preserve the actual type
    const wrappedTemplate = `{{ ${expression} | to_json }}`;
    const jsonResult = env.renderString(wrappedTemplate, context);

    // Parse JSON to get the actual type
    try {
      return JSON.parse(jsonResult);
    } catch {
      // Not valid JSON (e.g., undefined, function result)
      // Try direct rendering and return the string result
      const directResult = env.renderString(`{{ ${expression} }}`, context);
      return directResult || '';
    }
  } catch (error) {
    console.error('Expression evaluation error:', error);
    return '';
  }
}

/**
 * Resolve a variable path from context (supports dot notation and array indexing).
 * Example: "user.name", "items[0].id", "data['key']"
 */
function resolveVariablePath(path: string, context: Record<string, unknown>): unknown {
  const parts: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inQuote = char;
      continue;
    }

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

  // Traverse the object
  let result: unknown = context;

  for (const part of parts) {
    if (result === null || result === undefined) {
      return undefined;
    }

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

// ============================================================================
// Exports
// ============================================================================

/** The Nunjucks environment instance for advanced usage */
export { env as nunjucksEnv };

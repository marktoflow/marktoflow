/**
 * core.extract — Nested path access with defaults.
 */

import { ExecutionContext } from '../models.js';
import { resolveTemplates, resolveVariablePath } from '../engine/variable-resolution.js';

export interface ExtractOperationInputs {
  input: unknown;
  path: string;
  default?: unknown;
}

/**
 * Extract values from nested objects safely.
 *
 * Example:
 * ```yaml
 * action: core.extract
 * inputs:
 *   input: "{{ api_response }}"
 *   path: "data.users[0].email"
 *   default: "unknown@example.com"
 * ```
 */
export function executeExtract(
  inputs: ExtractOperationInputs,
  context: ExecutionContext
): unknown {
  const input = resolveTemplates(inputs.input, context);
  const path = inputs.path;
  const defaultValue = inputs.default;

  const tempContext = {
    ...context,
    variables: { ...context.variables, __extract_input: input },
  };

  const result = resolveVariablePath(`__extract_input.${path}`, tempContext);

  if (result === undefined) {
    return defaultValue !== undefined ? defaultValue : null;
  }

  return result;
}

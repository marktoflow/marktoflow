/**
 * core.set — Simple variable assignment.
 */

import { ExecutionContext } from '../models.js';
import { resolveTemplates } from '../engine/variable-resolution.js';

export interface SetOperationInputs {
  [key: string]: unknown;
}

/**
 * Set multiple variables at once with expression resolution.
 *
 * Example:
 * ```yaml
 * action: core.set
 * inputs:
 *   owner: "{{ inputs.repo =~ /^([^\/]+)\// }}"
 *   repo_name: "{{ inputs.repo =~ /\/(.+)$/ }}"
 *   timestamp: "{{ now() }}"
 * ```
 */
export function executeSet(
  inputs: SetOperationInputs,
  context: ExecutionContext
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(inputs)) {
    const resolved = resolveTemplates(value, context);
    result[key] = resolved;
  }

  return result;
}

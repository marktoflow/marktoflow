/**
 * Built-in Operations for marktoflow
 *
 * Thin dispatcher — all implementations live in ./operations/.
 */

import { ExecutionContext } from './models.js';
import { executeFileOperation, isFileOperation } from './file-operations.js';
import { isParallelOperation } from './parallel.js';

// Re-export all operations and types for backward compatibility
export {
  executeSet,
  type SetOperationInputs,
  executeTransform,
  type TransformOperationInputs,
  executeExtract,
  type ExtractOperationInputs,
  executeFormat,
  type FormatOperationInputs,
  executeAggregate,
  executeCompare,
  executeRenameKeys,
  executeLimit,
  executeSortOperation,
  executeCrypto,
  executeDatetime,
  executeParse,
  executeCompress,
  executeDecompress,
} from './operations/index.js';

import {
  executeSet,
  executeTransform,
  type TransformOperationInputs,
  type ExtractOperationInputs,
  type FormatOperationInputs,
  executeExtract,
  executeFormat,
  executeAggregate,
  executeCompare,
  executeRenameKeys,
  executeLimit,
  executeSortOperation,
  executeCrypto,
  executeDatetime,
  executeParse,
  executeCompress,
  executeDecompress,
} from './operations/index.js';

/**
 * Execute a built-in operation based on action name
 */
export function executeBuiltInOperation(
  action: string,
  rawInputs: Record<string, unknown>,
  resolvedInputs: Record<string, unknown>,
  context: ExecutionContext
): unknown | Promise<unknown> {
  switch (action) {
    case 'core.set':
      return executeSet(resolvedInputs, context);
    case 'core.transform':
      return executeTransform(rawInputs as unknown as TransformOperationInputs, resolvedInputs, context);
    case 'core.extract':
      return executeExtract(resolvedInputs as unknown as ExtractOperationInputs, context);
    case 'core.format':
      return executeFormat(resolvedInputs as unknown as FormatOperationInputs, context);
    case 'core.aggregate':
      return executeAggregate(resolvedInputs, context);
    case 'core.compare':
      return executeCompare(resolvedInputs, context);
    case 'core.rename_keys':
      return executeRenameKeys(resolvedInputs);
    case 'core.limit':
      return executeLimit(resolvedInputs);
    case 'core.sort':
      return executeSortOperation(resolvedInputs);
    case 'core.crypto':
      return executeCrypto(resolvedInputs);
    case 'core.datetime':
      return executeDatetime(resolvedInputs);
    case 'core.parse':
      return executeParse(resolvedInputs);
    case 'core.compress':
      return executeCompress(resolvedInputs);
    case 'core.decompress':
      return executeDecompress(resolvedInputs);
    default:
      if (isFileOperation(action)) {
        return executeFileOperation(action, resolvedInputs, context);
      }
      return null;
  }
}

/**
 * Check if an action is a built-in operation
 */
export function isBuiltInOperation(action: string): boolean {
  const builtInActions = [
    'core.set', 'core.transform', 'core.extract', 'core.format',
    'core.aggregate', 'core.compare', 'core.rename_keys', 'core.limit',
    'core.sort', 'core.crypto', 'core.datetime', 'core.parse',
    'core.compress', 'core.decompress',
  ];
  return builtInActions.includes(action) || isFileOperation(action) || isParallelOperation(action);
}

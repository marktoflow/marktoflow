import type { WorkflowStep } from '@shared/types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates a workflow step
 */
export function validateStep(step: WorkflowStep): ValidationResult {
  const errors: ValidationError[] = [];

  // ID is required
  if (!step.id || step.id.trim() === '') {
    errors.push({
      field: 'id',
      message: 'Step ID is required',
    });
  } else {
    // ID must be a valid identifier (letters, numbers, underscores, hyphens)
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(step.id)) {
      errors.push({
        field: 'id',
        message: 'Step ID must start with a letter and contain only letters, numbers, underscores, and hyphens',
      });
    }
  }

  // Must have either an action or a workflow reference
  if (!step.action && !step.workflow) {
    errors.push({
      field: 'action',
      message: 'Step must have either an action or a workflow reference',
    });
  }

  // Action format validation (service.method or service.namespace.method)
  if (step.action) {
    const actionParts = step.action.split('.');
    if (actionParts.length < 2) {
      errors.push({
        field: 'action',
        message: 'Action must be in format: service.method (e.g., slack.chat.postMessage)',
      });
    }
  }

  // Workflow reference validation
  if (step.workflow) {
    if (!step.workflow.endsWith('.md') && !step.workflow.endsWith('.yaml') && !step.workflow.endsWith('.yml')) {
      errors.push({
        field: 'workflow',
        message: 'Workflow reference should end with .md, .yaml, or .yml',
      });
    }
  }

  // Output variable name validation
  if (step.outputVariable) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(step.outputVariable)) {
      errors.push({
        field: 'outputVariable',
        message: 'Output variable must start with a letter and contain only letters, numbers, and underscores',
      });
    }
  }

  // Timeout validation
  if (step.timeout !== undefined) {
    if (typeof step.timeout !== 'number' || step.timeout <= 0) {
      errors.push({
        field: 'timeout',
        message: 'Timeout must be a positive number',
      });
    }
  }

  // Error handling validation
  if (step.errorHandling) {
    const validActions = ['stop', 'continue', 'retry'];
    if (!validActions.includes(step.errorHandling.action)) {
      errors.push({
        field: 'errorHandling.action',
        message: 'Error action must be one of: stop, continue, retry',
      });
    }

    if (step.errorHandling.action === 'retry') {
      if (step.errorHandling.maxRetries !== undefined) {
        if (typeof step.errorHandling.maxRetries !== 'number' || step.errorHandling.maxRetries < 1) {
          errors.push({
            field: 'errorHandling.maxRetries',
            message: 'Max retries must be at least 1',
          });
        }
      }

      if (step.errorHandling.retryDelay !== undefined) {
        if (typeof step.errorHandling.retryDelay !== 'number' || step.errorHandling.retryDelay < 0) {
          errors.push({
            field: 'errorHandling.retryDelay',
            message: 'Retry delay must be a non-negative number',
          });
        }
      }
    }

    if (step.errorHandling.fallbackStep) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(step.errorHandling.fallbackStep)) {
        errors.push({
          field: 'errorHandling.fallbackStep',
          message: 'Fallback step ID must be a valid identifier',
        });
      }
    }
  }

  // Conditions validation
  if (step.conditions && step.conditions.length > 0) {
    step.conditions.forEach((condition, index) => {
      if (!condition || condition.trim() === '') {
        errors.push({
          field: `conditions[${index}]`,
          message: `Condition ${index + 1} cannot be empty`,
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get validation errors for a specific field
 */
export function getFieldError(errors: ValidationError[], field: string): string | undefined {
  const error = errors.find((e) => e.field === field);
  return error?.message;
}

/**
 * Check if a field has validation errors
 */
export function hasFieldError(errors: ValidationError[], field: string): boolean {
  return errors.some((e) => e.field === field);
}

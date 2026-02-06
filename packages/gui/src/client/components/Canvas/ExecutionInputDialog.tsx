import { useState, useCallback } from 'react';
import { X, Play, AlertCircle } from 'lucide-react';
import type { WorkflowInput } from '@shared/types';

interface ExecutionInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputs: Record<string, WorkflowInput>;
  onExecute: (inputs: Record<string, any>) => void;
  workflowName?: string;
}

export function ExecutionInputDialog({
  open,
  onOpenChange,
  inputs,
  onExecute,
  workflowName = 'Workflow',
}: ExecutionInputDialogProps) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    // Initialize with default values
    const initial: Record<string, any> = {};
    Object.entries(inputs).forEach(([key, config]) => {
      initial[key] = config.default ?? '';
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateInputs = useCallback(() => {
    const newErrors: Record<string, string> = {};

    Object.entries(inputs).forEach(([key, config]) => {
      const value = values[key];

      // Check required fields
      if (config.required && (value === '' || value === null || value === undefined)) {
        newErrors[key] = `${config.description || key} is required`;
        return;
      }

      // Validate type
      if (value !== '' && value !== null && value !== undefined) {
        switch (config.type) {
          case 'number':
            if (isNaN(Number(value))) {
              newErrors[key] = 'Must be a valid number';
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
              newErrors[key] = 'Must be true or false';
            }
            break;
        }
      }

      // Custom validation pattern
      if (config.validation?.pattern && value) {
        try {
          const regex = new RegExp(config.validation.pattern);
          if (!regex.test(String(value))) {
            newErrors[key] = config.validation.message || 'Invalid format';
          }
        } catch (e) {
          console.warn('Invalid regex pattern:', config.validation.pattern);
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [inputs, values]);

  const handleExecute = useCallback(() => {
    if (!validateInputs()) {
      return;
    }

    // Convert values to appropriate types
    const convertedValues: Record<string, any> = {};
    Object.entries(values).forEach(([key, value]) => {
      const config = inputs[key];
      if (!config) {
        // Skip values without corresponding input config
        return;
      }
      if (value === '' && !config.required) {
        return; // Skip optional empty values
      }

      switch (config.type) {
        case 'number':
          convertedValues[key] = Number(value);
          break;
        case 'boolean':
          convertedValues[key] = value === true || value === 'true';
          break;
        default:
          convertedValues[key] = value;
      }
    });

    onExecute(convertedValues);
    onOpenChange(false);
  }, [validateInputs, values, inputs, onExecute, onOpenChange]);

  const handleChange = useCallback((key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  if (!open) return null;

  const hasRequiredInputs = Object.values(inputs).some((config) => config.required);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-modal-backdrop backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-modal p-4">
        <div className="bg-bg-elevated border border-border-default rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-subtle">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Execute Workflow</h2>
              <p className="text-sm text-text-secondary mt-1">{workflowName}</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-bg-hover transition-colors text-text-secondary"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {Object.keys(inputs).length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                This workflow has no input parameters
              </div>
            ) : (
              Object.entries(inputs).map(([key, config]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    {config.description || key}
                    {config.required && <span className="text-error ml-1">*</span>}
                  </label>

                  {config.type === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={values[key] === true || values[key] === 'true'}
                        onChange={(e) => handleChange(key, e.target.checked)}
                        className="w-4 h-4 rounded border-border-default bg-bg-surface text-accent focus:ring-2 focus:ring-accent/50"
                      />
                      <span className="text-sm text-text-secondary">
                        {config.description || 'Enable this option'}
                      </span>
                    </label>
                  ) : (
                    <input
                      type={config.type === 'number' ? 'number' : 'text'}
                      value={values[key] ?? ''}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={config.default !== undefined ? String(config.default) : ''}
                      className={`w-full px-3 py-2 bg-bg-surface border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 transition-colors ${
                        errors[key]
                          ? 'border-error focus:ring-error/50'
                          : 'border-border-default focus:ring-accent/50'
                      }`}
                    />
                  )}

                  {errors[key] && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-error">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors[key]}</span>
                    </div>
                  )}

                  {!errors[key] && config.validation?.message && (
                    <p className="text-xs text-text-muted mt-1.5">{config.validation.message}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border-subtle">
            <div className="text-xs text-text-muted">
              {hasRequiredInputs && <span>* Required field</span>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 bg-bg-surface border border-border-default hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-text-inverse rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Execute
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

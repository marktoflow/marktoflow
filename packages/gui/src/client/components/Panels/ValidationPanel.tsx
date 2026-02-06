import { CheckCircle, XCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ValidationResult {
  valid: boolean;
  workflow?: {
    id: string;
    name: string;
    version?: string;
    description?: string;
  };
  steps?: Array<{
    id: string;
    action: string;
    description?: string;
  }>;
  inputs?: Record<string, any>;
  warnings?: string[];
  error?: string;
  message?: string;
}

interface ValidationPanelProps {
  workflowPath: string | null;
  onClose: () => void;
}

export function ValidationPanel({ workflowPath, onClose }: ValidationPanelProps) {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (workflowPath) {
      validateWorkflow(workflowPath);
    }
  }, [workflowPath]);

  const validateWorkflow = async (path: string) => {
    setValidating(true);
    setResult(null);

    try {
      const response = await fetch(`/api/execute/${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setResult({
          valid: false,
          error: data.message || 'Validation failed',
        });
      }
    } catch (error) {
      setResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setValidating(false);
    }
  };

  if (!workflowPath) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-modal-backdrop backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 flex items-center justify-center z-modal p-4">
        <div className="bg-bg-elevated border border-border-default rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-subtle">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Workflow Validation</h2>
              <p className="text-sm text-text-secondary mt-1">Dry-run analysis results</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-bg-hover transition-colors text-text-secondary"
              aria-label="Close validation panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {validating ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
                <p className="text-sm text-text-secondary">Validating workflow...</p>
              </div>
            ) : result ? (
              <div className="space-y-6">
                {/* Status Banner */}
                <div
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    result.valid
                      ? 'bg-success-bg border-success/30'
                      : 'bg-error-bg border-error/30'
                  }`}
                >
                  {result.valid ? (
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3
                      className={`text-sm font-medium ${
                        result.valid ? 'text-success' : 'text-error'
                      }`}
                    >
                      {result.valid ? 'Workflow is valid' : 'Validation failed'}
                    </h3>
                    {result.error && (
                      <p className="text-sm text-text-secondary mt-1">{result.error}</p>
                    )}
                  </div>
                </div>

                {/* Workflow Info */}
                {result.workflow && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-text-primary">Workflow Details</h3>
                    <div className="bg-bg-surface border border-border-default rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Name:</span>
                        <span className="text-text-primary font-medium">
                          {result.workflow.name}
                        </span>
                      </div>
                      {result.workflow.version && (
                        <div className="flex justify-between text-sm">
                          <span className="text-text-secondary">Version:</span>
                          <span className="text-text-primary">{result.workflow.version}</span>
                        </div>
                      )}
                      {result.workflow.description && (
                        <div className="text-sm">
                          <span className="text-text-secondary">Description:</span>
                          <p className="text-text-primary mt-1">
                            {result.workflow.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Steps */}
                {result.steps && result.steps.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-text-primary">
                      Steps ({result.steps.length})
                    </h3>
                    <div className="space-y-2">
                      {result.steps.map((step, index) => (
                        <div
                          key={step.id}
                          className="bg-bg-surface border border-border-default rounded-lg p-3"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-medium flex items-center justify-center">
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary">
                                {step.action}
                              </p>
                              {step.description && (
                                <p className="text-xs text-text-secondary mt-1">
                                  {step.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {result.warnings && result.warnings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      Warnings ({result.warnings.length})
                    </h3>
                    <div className="space-y-2">
                      {result.warnings.map((warning, index) => (
                        <div
                          key={index}
                          className="bg-warning-bg border border-warning/30 rounded-lg p-3"
                        >
                          <p className="text-sm text-text-primary">{warning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inputs */}
                {result.inputs && Object.keys(result.inputs).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-text-primary">
                      Required Inputs ({Object.keys(result.inputs).length})
                    </h3>
                    <div className="bg-bg-surface border border-border-default rounded-lg p-4 space-y-2">
                      {Object.entries(result.inputs).map(([key, config]: [string, any]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-text-secondary">
                            {key}
                            {config.required && <span className="text-error ml-1">*</span>}
                          </span>
                          <span className="text-text-primary font-mono text-xs">
                            {config.type || 'string'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end p-6 border-t border-border-subtle">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-text-inverse rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

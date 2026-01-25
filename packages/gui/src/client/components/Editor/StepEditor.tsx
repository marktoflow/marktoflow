import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../common/Tabs';
import { YamlEditor } from './YamlEditor';
import { InputsEditor } from './InputsEditor';
import {
  Settings,
  FileInput,
  FileOutput,
  AlertTriangle,
  Filter,
  Code,
} from 'lucide-react';
import type { WorkflowStep } from '@shared/types';

interface StepEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: WorkflowStep | null;
  onSave: (step: WorkflowStep) => void;
  availableVariables: string[];
}

export function StepEditor({
  open,
  onOpenChange,
  step,
  onSave,
  availableVariables,
}: StepEditorProps) {
  const [editedStep, setEditedStep] = useState<WorkflowStep | null>(null);
  const [activeTab, setActiveTab] = useState('properties');

  useEffect(() => {
    if (step) {
      setEditedStep({ ...step });
      setActiveTab('properties');
    }
  }, [step]);

  if (!editedStep) return null;

  const handleSave = () => {
    if (editedStep) {
      onSave(editedStep);
      onOpenChange(false);
    }
  };

  const updateStep = (updates: Partial<WorkflowStep>) => {
    setEditedStep((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit Step: ${editedStep.name || editedStep.id}`}
      description={editedStep.action || editedStep.workflow || 'Configure step settings'}
      size="xl"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="properties">
            <Settings className="w-4 h-4 mr-1.5" />
            Properties
          </TabsTrigger>
          <TabsTrigger value="inputs">
            <FileInput className="w-4 h-4 mr-1.5" />
            Inputs
          </TabsTrigger>
          <TabsTrigger value="output">
            <FileOutput className="w-4 h-4 mr-1.5" />
            Output
          </TabsTrigger>
          <TabsTrigger value="errors">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Errors
          </TabsTrigger>
          <TabsTrigger value="conditions">
            <Filter className="w-4 h-4 mr-1.5" />
            Conditions
          </TabsTrigger>
          <TabsTrigger value="yaml">
            <Code className="w-4 h-4 mr-1.5" />
            YAML
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          <TabsContent value="properties">
            <PropertiesTab step={editedStep} onChange={updateStep} />
          </TabsContent>

          <TabsContent value="inputs">
            <InputsEditor
              inputs={editedStep.inputs}
              onChange={(inputs) => updateStep({ inputs })}
              availableVariables={availableVariables}
            />
          </TabsContent>

          <TabsContent value="output">
            <OutputTab step={editedStep} onChange={updateStep} />
          </TabsContent>

          <TabsContent value="errors">
            <ErrorHandlingTab step={editedStep} onChange={updateStep} />
          </TabsContent>

          <TabsContent value="conditions">
            <ConditionsTab
              step={editedStep}
              onChange={updateStep}
              availableVariables={availableVariables}
            />
          </TabsContent>

          <TabsContent value="yaml">
            <YamlEditor
              value={editedStep}
              onChange={(updated) => setEditedStep(updated)}
            />
          </TabsContent>
        </div>
      </Tabs>

      <ModalFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </ModalFooter>
    </Modal>
  );
}

// Properties Tab
function PropertiesTab({
  step,
  onChange,
}: {
  step: WorkflowStep;
  onChange: (updates: Partial<WorkflowStep>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Step ID
        </label>
        <input
          type="text"
          value={step.id}
          onChange={(e) => onChange({ id: e.target.value })}
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
          placeholder="unique-step-id"
        />
        <p className="mt-1 text-xs text-gray-500">
          Unique identifier for this step
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Step Name
        </label>
        <input
          type="text"
          value={step.name || ''}
          onChange={(e) => onChange({ name: e.target.value || undefined })}
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
          placeholder="Human-readable name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Action
        </label>
        <input
          type="text"
          value={step.action || ''}
          onChange={(e) => onChange({ action: e.target.value || undefined })}
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary"
          placeholder="service.method (e.g., slack.chat.postMessage)"
        />
        <p className="mt-1 text-xs text-gray-500">
          Format: service.method or service.namespace.method
        </p>
      </div>

      {step.workflow && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Sub-workflow Path
          </label>
          <input
            type="text"
            value={step.workflow}
            onChange={(e) => onChange({ workflow: e.target.value })}
            className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary"
            placeholder="./path/to/workflow.md"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Timeout (seconds)
        </label>
        <input
          type="number"
          value={step.timeout || ''}
          onChange={(e) =>
            onChange({
              timeout: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
          placeholder="30"
          min="1"
        />
      </div>
    </div>
  );
}

// Output Tab
function OutputTab({
  step,
  onChange,
}: {
  step: WorkflowStep;
  onChange: (updates: Partial<WorkflowStep>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Output Variable
        </label>
        <input
          type="text"
          value={step.outputVariable || ''}
          onChange={(e) =>
            onChange({ outputVariable: e.target.value || undefined })
          }
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary"
          placeholder="result_variable"
        />
        <p className="mt-1 text-xs text-gray-500">
          Store the step output in this variable for use in subsequent steps
        </p>
      </div>

      <div className="p-4 bg-node-bg rounded-lg border border-node-border">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Usage Example</h4>
        <code className="text-xs text-primary font-mono">
          {'{{ ' + (step.outputVariable || 'variable_name') + ' }}'}
        </code>
        <p className="mt-2 text-xs text-gray-500">
          Use this syntax in subsequent steps to reference the output
        </p>
      </div>
    </div>
  );
}

// Error Handling Tab
function ErrorHandlingTab({
  step,
  onChange,
}: {
  step: WorkflowStep;
  onChange: (updates: Partial<WorkflowStep>) => void;
}) {
  const errorHandling = step.errorHandling || { action: 'stop' };

  const updateErrorHandling = (updates: Partial<typeof errorHandling>) => {
    onChange({
      errorHandling: { ...errorHandling, ...updates },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Error Action
        </label>
        <select
          value={errorHandling.action}
          onChange={(e) =>
            updateErrorHandling({
              action: e.target.value as 'stop' | 'continue' | 'retry',
            })
          }
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
        >
          <option value="stop">Stop workflow on error</option>
          <option value="continue">Continue to next step</option>
          <option value="retry">Retry with backoff</option>
        </select>
      </div>

      {errorHandling.action === 'retry' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Max Retries
            </label>
            <input
              type="number"
              value={errorHandling.maxRetries || 3}
              onChange={(e) =>
                updateErrorHandling({
                  maxRetries: parseInt(e.target.value, 10),
                })
              }
              className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
              min="1"
              max="10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Retry Delay (ms)
            </label>
            <input
              type="number"
              value={errorHandling.retryDelay || 1000}
              onChange={(e) =>
                updateErrorHandling({
                  retryDelay: parseInt(e.target.value, 10),
                })
              }
              className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
              min="100"
              step="100"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Fallback Step (optional)
        </label>
        <input
          type="text"
          value={errorHandling.fallbackStep || ''}
          onChange={(e) =>
            updateErrorHandling({
              fallbackStep: e.target.value || undefined,
            })
          }
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary"
          placeholder="fallback-step-id"
        />
        <p className="mt-1 text-xs text-gray-500">
          Jump to this step if the error action fails
        </p>
      </div>
    </div>
  );
}

// Conditions Tab
function ConditionsTab({
  step,
  onChange,
  availableVariables,
}: {
  step: WorkflowStep;
  onChange: (updates: Partial<WorkflowStep>) => void;
  availableVariables: string[];
}) {
  const conditions = step.conditions || [];

  const addCondition = () => {
    onChange({ conditions: [...conditions, ''] });
  };

  const updateCondition = (index: number, value: string) => {
    const updated = [...conditions];
    updated[index] = value;
    onChange({ conditions: updated });
  };

  const removeCondition = (index: number) => {
    const updated = conditions.filter((_, i) => i !== index);
    onChange({ conditions: updated.length > 0 ? updated : undefined });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        This step will only execute if all conditions evaluate to true.
      </p>

      {conditions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-3">No conditions defined</p>
          <Button variant="secondary" size="sm" onClick={addCondition}>
            Add Condition
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {conditions.map((condition, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={condition}
                onChange={(e) => updateCondition(index, e.target.value)}
                className="flex-1 px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary"
                placeholder="{{ variable }} === 'value'"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCondition(index)}
              >
                ×
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addCondition}>
            Add Condition
          </Button>
        </div>
      )}

      {availableVariables.length > 0 && (
        <div className="mt-4 p-3 bg-node-bg rounded-lg border border-node-border">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Available Variables
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {availableVariables.map((variable) => (
              <code
                key={variable}
                className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded cursor-pointer hover:bg-primary/20"
                onClick={() => {
                  // Copy to clipboard
                  navigator.clipboard.writeText(`{{ ${variable} }}`);
                }}
              >
                {variable}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

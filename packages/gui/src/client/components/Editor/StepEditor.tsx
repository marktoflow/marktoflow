import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  AlertCircle,
} from 'lucide-react';
import type { WorkflowStep } from '@shared/types';
import { validateStep, getFieldError, type ValidationError } from '../../utils/stepValidation';

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
  const { t } = useTranslation('gui');
  const [editedStep, setEditedStep] = useState<WorkflowStep | null>(null);
  const [activeTab, setActiveTab] = useState('properties');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (step) {
      setEditedStep({ ...step });
      setActiveTab('properties');
      setValidationErrors([]);
      setShowErrors(false);
    }
  }, [step]);

  // Validate on every change
  const validation = useMemo(() => {
    if (!editedStep) return { valid: true, errors: [] };
    return validateStep(editedStep);
  }, [editedStep]);

  if (!editedStep) return null;

  const handleSave = () => {
    if (!editedStep) return;

    const result = validateStep(editedStep);
    setValidationErrors(result.errors);
    setShowErrors(true);

    if (result.valid) {
      onSave(editedStep);
      onOpenChange(false);
    } else {
      // Switch to tab with first error
      const firstError = result.errors[0];
      if (firstError) {
        if (firstError.field === 'id' || firstError.field === 'action' || firstError.field === 'workflow' || firstError.field === 'timeout') {
          setActiveTab('properties');
        } else if (firstError.field === 'outputVariable') {
          setActiveTab('output');
        } else if (firstError.field.startsWith('errorHandling')) {
          setActiveTab('errors');
        } else if (firstError.field.startsWith('conditions')) {
          setActiveTab('conditions');
        }
      }
    }
  };

  const updateStep = (updates: Partial<WorkflowStep>) => {
    setEditedStep((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const getError = (field: string): string | undefined => {
    if (!showErrors) return undefined;
    return getFieldError(validationErrors, field);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('gui:stepEditor.title', { name: editedStep.name || editedStep.id })}
      description={editedStep.action || editedStep.workflow || t('gui:stepEditor.configureSettings')}
      size="xl"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="properties">
            <Settings className="w-4 h-4 mr-1.5" />
            {t('gui:stepEditor.tabs.properties')}
          </TabsTrigger>
          <TabsTrigger value="inputs">
            <FileInput className="w-4 h-4 mr-1.5" />
            {t('gui:stepEditor.tabs.inputs')}
          </TabsTrigger>
          <TabsTrigger value="output">
            <FileOutput className="w-4 h-4 mr-1.5" />
            {t('gui:stepEditor.tabs.output')}
          </TabsTrigger>
          <TabsTrigger value="errors">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            {t('gui:stepEditor.tabs.errors')}
          </TabsTrigger>
          <TabsTrigger value="conditions">
            <Filter className="w-4 h-4 mr-1.5" />
            {t('gui:stepEditor.tabs.conditions')}
          </TabsTrigger>
          <TabsTrigger value="yaml">
            <Code className="w-4 h-4 mr-1.5" />
            {t('gui:stepEditor.tabs.yaml')}
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          <TabsContent value="properties">
            <PropertiesTab step={editedStep} onChange={updateStep} getError={getError} />
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
        {showErrors && validationErrors.length > 0 && (
          <div className="flex-1 flex items-center gap-2 text-error text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationErrors.length} {validationErrors.length > 1 ? t('gui:stepEditor.validationErrors') : t('gui:stepEditor.validationError')}</span>
          </div>
        )}
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t('gui:stepEditor.cancel')}
        </Button>
        <Button onClick={handleSave}>{t('gui:stepEditor.saveChanges')}</Button>
      </ModalFooter>
    </Modal>
  );
}

// Properties Tab
function PropertiesTab({
  step,
  onChange,
  getError,
}: {
  step: WorkflowStep;
  onChange: (updates: Partial<WorkflowStep>) => void;
  getError: (field: string) => string | undefined;
}) {
  const { t } = useTranslation('gui');
  const idError = getError('id');
  const actionError = getError('action');
  const workflowError = getError('workflow');
  const timeoutError = getError('timeout');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {t('gui:stepEditor.stepIdLabel')} <span className="text-error">*</span>
        </label>
        <input
          type="text"
          value={step.id}
          onChange={(e) => onChange({ id: e.target.value })}
          className={`w-full px-3 py-2 bg-node-bg border rounded-lg text-white text-sm focus:outline-none ${
            idError ? 'border-error focus:border-error' : 'border-node-border focus:border-primary'
          }`}
          placeholder={t('gui:stepEditor.stepIdPlaceholder')}
        />
        {idError ? (
          <p className="mt-1 text-xs text-error">{idError}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">
            {t('gui:stepEditor.stepIdHelp')}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {t('gui:stepEditor.stepNameLabel')}
        </label>
        <input
          type="text"
          value={step.name || ''}
          onChange={(e) => onChange({ name: e.target.value || undefined })}
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
          placeholder={t('gui:stepEditor.stepNamePlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {t('gui:stepEditor.actionLabel')} {!step.workflow && <span className="text-error">*</span>}
        </label>
        <input
          type="text"
          value={step.action || ''}
          onChange={(e) => onChange({ action: e.target.value || undefined })}
          className={`w-full px-3 py-2 bg-node-bg border rounded-lg text-white text-sm font-mono focus:outline-none ${
            actionError ? 'border-error focus:border-error' : 'border-node-border focus:border-primary'
          }`}
          placeholder={t('gui:stepEditor.actionPlaceholder')}
        />
        {actionError ? (
          <p className="mt-1 text-xs text-error">{actionError}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">
            {t('gui:stepEditor.actionHelp')}
          </p>
        )}
      </div>

      {step.workflow && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {t('gui:stepEditor.subWorkflowPathLabel')}
          </label>
          <input
            type="text"
            value={step.workflow}
            onChange={(e) => onChange({ workflow: e.target.value })}
            className={`w-full px-3 py-2 bg-node-bg border rounded-lg text-white text-sm font-mono focus:outline-none ${
              workflowError ? 'border-error focus:border-error' : 'border-node-border focus:border-primary'
            }`}
            placeholder={t('gui:stepEditor.subWorkflowPathPlaceholder')}
          />
          {workflowError && (
            <p className="mt-1 text-xs text-error">{workflowError}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {t('gui:stepEditor.timeoutLabel')}
        </label>
        <input
          type="number"
          value={step.timeout || ''}
          onChange={(e) =>
            onChange({
              timeout: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          className={`w-full px-3 py-2 bg-node-bg border rounded-lg text-white text-sm focus:outline-none ${
            timeoutError ? 'border-error focus:border-error' : 'border-node-border focus:border-primary'
          }`}
          placeholder="30"
          min="1"
        />
        {timeoutError && (
          <p className="mt-1 text-xs text-error">{timeoutError}</p>
        )}
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
  const { t } = useTranslation('gui');
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {t('gui:stepEditor.outputVariableLabel')}
        </label>
        <input
          type="text"
          value={step.outputVariable || ''}
          onChange={(e) =>
            onChange({ outputVariable: e.target.value || undefined })
          }
          className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary"
          placeholder={t('gui:stepEditor.outputVariablePlaceholder')}
        />
        <p className="mt-1 text-xs text-gray-500">
          {t('gui:stepEditor.outputVariableHelp')}
        </p>
      </div>

      <div className="p-4 bg-node-bg rounded-lg border border-node-border">
        <h4 className="text-sm font-medium text-gray-300 mb-2">{t('gui:stepEditor.usageExample')}</h4>
        <code className="text-xs text-primary font-mono">
          {'{{ ' + (step.outputVariable || 'variable_name') + ' }}'}
        </code>
        <p className="mt-2 text-xs text-gray-500">
          {t('gui:stepEditor.usageExampleHelp')}
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
  const { t } = useTranslation('gui');
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
          {t('gui:stepEditor.errorActionLabel')}
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
          <option value="stop">{t('gui:stepEditor.errorActionOptions.stop')}</option>
          <option value="continue">{t('gui:stepEditor.errorActionOptions.continue')}</option>
          <option value="retry">{t('gui:stepEditor.errorActionOptions.retry')}</option>
        </select>
      </div>

      {errorHandling.action === 'retry' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {t('gui:stepEditor.maxRetriesLabel')}
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
              {t('gui:stepEditor.retryDelayLabel')}
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
          {t('gui:stepEditor.fallbackStepLabel')}
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
          placeholder={t('gui:stepEditor.fallbackStepPlaceholder')}
        />
        <p className="mt-1 text-xs text-gray-500">
          {t('gui:stepEditor.fallbackStepHelp')}
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
  const { t } = useTranslation('gui');
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
        {t('gui:stepEditor.conditionsDescription')}
      </p>

      {conditions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-3">{t('gui:stepEditor.noConditions')}</p>
          <Button variant="secondary" size="sm" onClick={addCondition}>
            {t('gui:stepEditor.addCondition')}
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
            {t('gui:stepEditor.addCondition')}
          </Button>
        </div>
      )}

      {availableVariables.length > 0 && (
        <div className="mt-4 p-3 bg-node-bg rounded-lg border border-node-border">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            {t('gui:stepEditor.availableVariables')}
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

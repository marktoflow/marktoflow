import { useState } from 'react';
import { Modal, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { SERVICES } from '@shared/constants';
import { getServiceIcon } from '../../utils/serviceIcons';
import { Search, ChevronRight, Zap, FolderOpen } from 'lucide-react';
import type { WorkflowStep } from '@shared/types';

interface NewStepWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateStep: (step: WorkflowStep) => void;
  position?: { afterStepId?: string; beforeStepId?: string };
}

type WizardStep = 'select-type' | 'select-service' | 'select-method' | 'configure';

export function NewStepWizard({
  open,
  onOpenChange,
  onCreateStep,
  position,
}: NewStepWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('select-type');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'action' | 'subworkflow'>('action');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [stepConfig, setStepConfig] = useState({
    id: '',
    name: '',
  });

  const resetWizard = () => {
    setWizardStep('select-type');
    setSearchQuery('');
    setSelectedType('action');
    setSelectedService(null);
    setSelectedMethod(null);
    setStepConfig({ id: '', name: '' });
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  const handleSelectType = (type: 'action' | 'subworkflow') => {
    setSelectedType(type);
    if (type === 'action') {
      setWizardStep('select-service');
    } else {
      // TODO: Show sub-workflow file picker
      setWizardStep('configure');
    }
  };

  const handleSelectService = (service: string) => {
    setSelectedService(service);
    setWizardStep('select-method');
  };

  const handleSelectMethod = (method: string) => {
    setSelectedMethod(method);
    // Auto-generate step ID and name
    const serviceInfo = SERVICES[selectedService as keyof typeof SERVICES];
    setStepConfig({
      id: `${selectedService}-${Date.now()}`,
      name: `${serviceInfo?.name || selectedService} - ${method}`,
    });
    setWizardStep('configure');
  };

  const handleCreate = () => {
    const step: WorkflowStep = {
      id: stepConfig.id || `step-${Date.now()}`,
      name: stepConfig.name || undefined,
      inputs: {},
    };

    if (selectedType === 'action' && selectedService && selectedMethod) {
      step.action = `${selectedService}.${selectedMethod}`;
    }

    onCreateStep(step);
    handleClose();
  };

  const filteredServices = Object.entries(SERVICES).filter(([key, service]) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentServiceMethods = selectedService
    ? SERVICES[selectedService as keyof typeof SERVICES]?.methods || []
    : [];

  const filteredMethods = currentServiceMethods.filter((method) =>
    method.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Add New Step"
      description={getStepDescription(wizardStep)}
      size="lg"
    >
      <div className="p-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <button
            onClick={() => setWizardStep('select-type')}
            className={`${wizardStep === 'select-type' ? 'text-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Type
          </button>
          {selectedType === 'action' && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <button
                onClick={() => selectedService && setWizardStep('select-service')}
                className={`${wizardStep === 'select-service' ? 'text-primary' : selectedService ? 'text-gray-400 hover:text-white' : 'text-gray-600'}`}
                disabled={!selectedService}
              >
                Service
              </button>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <button
                onClick={() => selectedMethod && setWizardStep('select-method')}
                className={`${wizardStep === 'select-method' ? 'text-primary' : selectedMethod ? 'text-gray-400 hover:text-white' : 'text-gray-600'}`}
                disabled={!selectedMethod}
              >
                Method
              </button>
            </>
          )}
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <span
            className={`${wizardStep === 'configure' ? 'text-primary' : 'text-gray-600'}`}
          >
            Configure
          </span>
        </div>

        {/* Step 1: Select Type */}
        {wizardStep === 'select-type' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleSelectType('action')}
              className="p-6 bg-node-bg border border-node-border rounded-lg hover:border-primary transition-colors text-left"
            >
              <Zap className="w-8 h-8 text-primary mb-3" />
              <h3 className="text-lg font-medium text-white mb-1">Action Step</h3>
              <p className="text-sm text-gray-400">
                Execute an action using a service SDK (Slack, GitHub, etc.)
              </p>
            </button>
            <button
              onClick={() => handleSelectType('subworkflow')}
              className="p-6 bg-node-bg border border-node-border rounded-lg hover:border-info transition-colors text-left"
            >
              <FolderOpen className="w-8 h-8 text-info mb-3" />
              <h3 className="text-lg font-medium text-white mb-1">Sub-workflow</h3>
              <p className="text-sm text-gray-400">
                Reference another workflow file for modular composition
              </p>
            </button>
          </div>
        )}

        {/* Step 2: Select Service */}
        {wizardStep === 'select-service' && (
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-10 pr-4 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {filteredServices.map(([key, service]) => {
                const Icon = getServiceIcon(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectService(key)}
                    className="flex flex-col items-center gap-2 p-4 bg-node-bg border border-node-border rounded-lg hover:border-primary transition-colors"
                  >
                    <Icon className="w-8 h-8 text-primary" />
                    <span className="text-sm text-white">{service.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Select Method */}
        {wizardStep === 'select-method' && selectedService && (
          <div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-node-bg rounded-lg border border-node-border">
              {(() => {
                const Icon = getServiceIcon(selectedService);
                return <Icon className="w-6 h-6 text-primary" />;
              })()}
              <div>
                <div className="text-sm font-medium text-white">
                  {SERVICES[selectedService as keyof typeof SERVICES]?.name}
                </div>
                <div className="text-xs text-gray-400">Select a method</div>
              </div>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search methods..."
                className="w-full pl-10 pr-4 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {filteredMethods.map((method) => (
                <button
                  key={method}
                  onClick={() => handleSelectMethod(method)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-node-bg border border-node-border rounded-lg hover:border-primary transition-colors text-left"
                >
                  <span className="text-sm font-mono text-white">{method}</span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Configure */}
        {wizardStep === 'configure' && (
          <div className="space-y-4">
            {selectedType === 'action' && selectedService && selectedMethod && (
              <div className="p-3 bg-node-bg rounded-lg border border-node-border">
                <div className="text-xs text-gray-400 mb-1">Action</div>
                <div className="text-sm font-mono text-primary">
                  {selectedService}.{selectedMethod}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Step ID
              </label>
              <input
                type="text"
                value={stepConfig.id}
                onChange={(e) =>
                  setStepConfig((prev) => ({ ...prev, id: e.target.value }))
                }
                className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm font-mono focus:outline-none focus:border-primary"
                placeholder="unique-step-id"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Step Name (optional)
              </label>
              <input
                type="text"
                value={stepConfig.name}
                onChange={(e) =>
                  setStepConfig((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 bg-node-bg border border-node-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                placeholder="Human-readable name"
              />
            </div>

            {position && (
              <div className="text-xs text-gray-500">
                {position.afterStepId
                  ? `Will be inserted after "${position.afterStepId}"`
                  : position.beforeStepId
                    ? `Will be inserted before "${position.beforeStepId}"`
                    : 'Will be added at the end'}
              </div>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        {wizardStep !== 'select-type' && (
          <Button
            variant="ghost"
            onClick={() => {
              if (wizardStep === 'select-service') setWizardStep('select-type');
              else if (wizardStep === 'select-method') setWizardStep('select-service');
              else if (wizardStep === 'configure') {
                if (selectedType === 'action') setWizardStep('select-method');
                else setWizardStep('select-type');
              }
              setSearchQuery('');
            }}
          >
            Back
          </Button>
        )}
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        {wizardStep === 'configure' && (
          <Button onClick={handleCreate} disabled={!stepConfig.id}>
            Create Step
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

function getStepDescription(step: WizardStep): string {
  switch (step) {
    case 'select-type':
      return 'Choose what type of step to add';
    case 'select-service':
      return 'Select a service to use';
    case 'select-method':
      return 'Choose the method to call';
    case 'configure':
      return 'Configure your new step';
    default:
      return '';
  }
}

/**
 * Provider Switcher Component
 * Allows users to switch between AI providers and configure them
 */

import { useEffect, useState } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { Modal, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { Check, Settings, AlertCircle, Loader2 } from 'lucide-react';

interface ProviderSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProviderSwitcher({ open, onOpenChange }: ProviderSwitcherProps) {
  const { providers, activeProviderId, isLoading, error, loadProviders, setProvider } = useAgentStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configData, setConfigData] = useState({
    apiKey: '',
    baseUrl: '',
    model: '',
  });

  useEffect(() => {
    if (open) {
      loadProviders();
    }
  }, [open, loadProviders]);

  const handleProviderClick = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    if (provider.status === 'needs_config') {
      // Show config modal
      setSelectedProviderId(providerId);
      setShowConfig(true);
    } else if (provider.status === 'ready') {
      // Switch provider directly
      const success = await setProvider(providerId);
      if (success) {
        onOpenChange(false);
      }
    }
  };

  const handleConfigSave = async () => {
    if (!selectedProviderId) return;

    const success = await setProvider(selectedProviderId, configData);
    if (success) {
      setShowConfig(false);
      setConfigData({ apiKey: '', baseUrl: '', model: '' });
      onOpenChange(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <div className="w-2 h-2 rounded-full bg-green-500" />;
      case 'needs_config':
        return <div className="w-2 h-2 rounded-full bg-yellow-500" />;
      case 'unavailable':
        return <div className="w-2 h-2 rounded-full bg-red-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'needs_config':
        return 'Needs Configuration';
      case 'unavailable':
        return 'Unavailable';
      default:
        return 'Unknown';
    }
  };

  if (showConfig) {
    const provider = providers.find((p) => p.id === selectedProviderId);
    if (!provider) return null;

    return (
      <Modal
        open={showConfig}
        onOpenChange={setShowConfig}
        title={`Configure ${provider.name}`}
        description="Enter configuration details for this provider"
        size="md"
      >
        <div className="p-4 space-y-4">
          {provider.configOptions?.apiKey && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={configData.apiKey}
                onChange={(e) => setConfigData({ ...configData, apiKey: e.target.value })}
                className="w-full px-3 py-2 bg-node-bg border border-node-border rounded text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter API key"
              />
            </div>
          )}

          {provider.configOptions?.baseUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Base URL
              </label>
              <input
                type="text"
                value={configData.baseUrl}
                onChange={(e) => setConfigData({ ...configData, baseUrl: e.target.value })}
                className="w-full px-3 py-2 bg-node-bg border border-node-border rounded text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter base URL"
              />
            </div>
          )}

          {provider.configOptions?.model && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Model
              </label>
              <input
                type="text"
                value={configData.model}
                onChange={(e) => setConfigData({ ...configData, model: e.target.value })}
                className="w-full px-3 py-2 bg-node-bg border border-node-border rounded text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter model name"
              />
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowConfig(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfigSave} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Activate'}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="AI Provider"
      description="Select which AI provider to use for agent prompts"
      size="md"
    >
      <div className="p-4 space-y-2">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/30 rounded text-error text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading && providers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : (
          <div className="space-y-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderClick(provider.id)}
                disabled={provider.status === 'unavailable'}
                className={`
                  w-full flex items-center justify-between p-3 rounded border transition-all
                  ${provider.isActive
                    ? 'bg-primary/10 border-primary text-white'
                    : 'bg-node-bg border-node-border text-gray-300 hover:bg-white/5'
                  }
                  ${provider.status === 'unavailable' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(provider.status)}
                  <div className="text-left">
                    <div className="font-medium">{provider.name}</div>
                    {provider.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{provider.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {provider.isActive && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                  {provider.status === 'needs_config' && (
                    <Settings className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-xs text-gray-500">
                    {getStatusLabel(provider.status)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}

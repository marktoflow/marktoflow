/**
 * Provider Switcher Component
 * Allows users to switch between AI providers and configure them
 */

import { useEffect, useState } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import type { Provider } from '../../stores/agentStore';
import { Modal, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { Check, Settings, AlertCircle, Loader2, Info } from 'lucide-react';

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

    if (provider.authType === 'sdk') {
      // SDK providers: show info/config modal (even for needs_config)
      setSelectedProviderId(providerId);
      setShowConfig(true);
    } else if (provider.status === 'needs_config') {
      // Non-SDK providers: show config modal
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

  const handleActivate = async () => {
    if (!selectedProviderId) return;
    const provider = providers.find((p) => p.id === selectedProviderId);
    if (!provider || provider.status !== 'ready') return;

    const config = configData.model ? { model: configData.model } : undefined;
    const success = await setProvider(selectedProviderId, config);
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
        return <div className="w-2 h-2 rounded-full bg-gray-500" />;
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

    const isSDK = provider.authType === 'sdk';

    return (
      <Modal
        open={showConfig}
        onOpenChange={setShowConfig}
        title={`Configure ${provider.name}`}
        description={isSDK ? 'SDK-based provider' : 'Enter configuration details for this provider'}
        size="md"
      >
        <div className="p-4 space-y-4">
          {isSDK ? (
            <SDKProviderConfig provider={provider} configData={configData} setConfigData={setConfigData} />
          ) : (
            <>
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
            </>
          )}
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowConfig(false)}>
            Cancel
          </Button>
          {isSDK ? (
            <Button
              variant="primary"
              onClick={handleActivate}
              disabled={isLoading || provider.status !== 'ready'}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activate'}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleConfigSave} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Activate'}
            </Button>
          )}
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
            {providers.map((provider) => {
              const isDisabled = provider.status === 'unavailable' ||
                (provider.status !== 'ready' && provider.status !== 'needs_config');
              return (
              <button
                key={provider.id}
                onClick={() => handleProviderClick(provider.id)}
                disabled={isDisabled}
                className={`
                  w-full flex items-center justify-between p-3 rounded border transition-all
                  ${provider.isActive
                    ? 'bg-primary/10 border-primary text-white'
                    : 'bg-node-bg border-node-border text-gray-300 hover:bg-white/5'
                  }
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
                  {provider.status === 'needs_config' && !provider.authType?.startsWith('sdk') && (
                    <Settings className="w-4 h-4 text-yellow-500" />
                  )}
                  {provider.authType === 'sdk' && provider.status === 'needs_config' && (
                    <Info className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-xs text-gray-500">
                    {getStatusLabel(provider.status)}
                  </span>
                </div>
              </button>
              );
            })}
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

/** SDK provider info panel shown inside the config modal */
function SDKProviderConfig({
  provider,
  configData,
  setConfigData,
}: {
  provider: Provider;
  configData: { model: string };
  setConfigData: (data: { apiKey: string; baseUrl: string; model: string }) => void;
}) {
  const isConnected = provider.status === 'ready';

  return (
    <>
      {/* Connection status */}
      <div className={`flex items-center gap-2 p-3 rounded border ${
        isConnected
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
      }`}>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
          {isConnected ? 'Connected and ready' : 'Not connected'}
        </span>
      </div>

      {/* Auth instructions */}
      {provider.authInstructions && (
        <div className="flex items-start gap-2 p-3 bg-white/5 rounded border border-white/10">
          <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-300">{provider.authInstructions}</p>
        </div>
      )}

      {/* Model dropdown (if models available) */}
      {provider.availableModels && provider.availableModels.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Model
          </label>
          <select
            value={configData.model}
            onChange={(e) => setConfigData({ apiKey: '', baseUrl: '', model: e.target.value })}
            className="w-full px-3 py-2 bg-node-bg border border-node-border rounded text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Default</option>
            {provider.availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

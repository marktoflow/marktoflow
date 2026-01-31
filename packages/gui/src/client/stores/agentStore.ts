/**
 * Agent/AI Provider Store
 * Manages available AI providers and active provider selection
 */

import { create } from 'zustand';

export interface Provider {
  id: string;
  name: string;
  status: 'ready' | 'needs_config' | 'unavailable';
  isActive: boolean;
  description?: string;
  configOptions?: {
    apiKey?: boolean;
    baseUrl?: boolean;
    model?: boolean;
  };
}

export interface AgentStatus {
  activeProvider: string | null;
  providers: Provider[];
}

interface AgentState {
  providers: Provider[];
  activeProviderId: string | null;
  isLoading: boolean;
  error: string | null;
  availableModels: Record<string, string[]>;
  modelsLoading: boolean;

  // Actions
  loadProviders: () => Promise<void>;
  setProvider: (id: string, config?: { apiKey?: string; baseUrl?: string; model?: string }) => Promise<boolean>;
  refreshStatus: () => Promise<void>;
  loadModels: (providerId: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  providers: [],
  activeProviderId: null,
  isLoading: false,
  error: null,
  availableModels: {},
  modelsLoading: false,

  loadProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/ai/providers');
      if (!response.ok) {
        throw new Error('Failed to load providers');
      }

      const status: AgentStatus = await response.json();

      set({
        providers: status.providers,
        activeProviderId: status.activeProvider,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading providers:', error);
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  setProvider: async (id, config) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/ai/providers/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config || {}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to set provider');
      }

      const result = await response.json();

      if (result.success && result.status) {
        set({
          providers: result.status.providers,
          activeProviderId: result.status.activeProvider,
          isLoading: false,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error setting provider:', error);
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
      return false;
    }
  },

  refreshStatus: async () => {
    await get().loadProviders();
  },

  loadModels: async (providerId: string) => {
    // Check if we already have models cached
    if (get().availableModels[providerId]) {
      return;
    }

    set({ modelsLoading: true });
    try {
      const response = await fetch(`/api/ai/providers/${providerId}/models`);
      if (!response.ok) {
        throw new Error('Failed to load models');
      }

      const data: { models: string[]; dynamic: boolean } = await response.json();

      set((state) => ({
        availableModels: {
          ...state.availableModels,
          [providerId]: data.models,
        },
        modelsLoading: false,
      }));
    } catch (error) {
      console.error('Error loading models:', error);
      set({ modelsLoading: false });
    }
  },
}));

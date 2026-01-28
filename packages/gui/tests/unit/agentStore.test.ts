/**
 * Tests for agent store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAgentStore } from '../../src/client/stores/agentStore';

// Mock fetch
global.fetch = vi.fn();

describe('Agent Store', () => {
  beforeEach(() => {
    // Reset store
    useAgentStore.setState({
      providers: [],
      activeProviderId: null,
      isLoading: false,
      error: null,
    });

    // Reset fetch mock
    vi.clearAllMocks();
  });

  describe('loadProviders', () => {
    it('should load providers successfully', async () => {
      const mockProviders = [
        {
          id: 'copilot',
          name: 'GitHub Copilot',
          status: 'ready',
          isActive: true,
        },
        {
          id: 'claude',
          name: 'Claude Code',
          status: 'needs_config',
          isActive: false,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          activeProvider: 'copilot',
          providers: mockProviders,
        }),
      });

      const { loadProviders } = useAgentStore.getState();
      await loadProviders();

      const state = useAgentStore.getState();
      expect(state.providers).toEqual(mockProviders);
      expect(state.activeProviderId).toBe('copilot');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should handle loading errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { loadProviders } = useAgentStore.getState();
      await loadProviders();

      const state = useAgentStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { loadProviders } = useAgentStore.getState();
      await loadProviders();

      const state = useAgentStore.getState();
      expect(state.error).toBe('Failed to load providers');
      expect(state.isLoading).toBe(false);
    });

    it('should set loading state during fetch', async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as any).mockReturnValueOnce(promise);

      const { loadProviders } = useAgentStore.getState();
      const loadPromise = loadProviders();

      // Check loading state
      expect(useAgentStore.getState().isLoading).toBe(true);

      // Resolve promise
      resolvePromise({
        ok: true,
        json: async () => ({ activeProvider: null, providers: [] }),
      });

      await loadPromise;
      expect(useAgentStore.getState().isLoading).toBe(false);
    });
  });

  describe('setProvider', () => {
    it('should set provider successfully', async () => {
      const mockProviders = [
        {
          id: 'copilot',
          name: 'GitHub Copilot',
          status: 'ready',
          isActive: false,
        },
        {
          id: 'claude',
          name: 'Claude Code',
          status: 'ready',
          isActive: true,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: {
            activeProvider: 'claude',
            providers: mockProviders,
          },
        }),
      });

      const { setProvider } = useAgentStore.getState();
      const result = await setProvider('claude');

      expect(result).toBe(true);
      const state = useAgentStore.getState();
      expect(state.activeProviderId).toBe('claude');
      expect(state.providers).toEqual(mockProviders);
    });

    it('should send configuration with request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: { activeProvider: 'claude', providers: [] },
        }),
      });

      const { setProvider } = useAgentStore.getState();
      await setProvider('claude', {
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        model: 'claude-3',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/providers/claude',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: 'test-key',
            baseUrl: 'https://api.test.com',
            model: 'claude-3',
          }),
        })
      );
    });

    it('should handle set provider errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { setProvider } = useAgentStore.getState();
      const result = await setProvider('claude');

      expect(result).toBe(false);
      const state = useAgentStore.getState();
      expect(state.error).toBe('Network error');
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Provider not found' }),
      });

      const { setProvider } = useAgentStore.getState();
      const result = await setProvider('invalid');

      expect(result).toBe(false);
      const state = useAgentStore.getState();
      expect(state.error).toBe('Provider not found');
    });
  });

  describe('refreshStatus', () => {
    it('should call loadProviders', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activeProvider: null, providers: [] }),
      });

      const { refreshStatus } = useAgentStore.getState();
      await refreshStatus();

      expect(global.fetch).toHaveBeenCalledWith('/api/ai/providers');
    });
  });
});

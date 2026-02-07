/**
 * Tests for governance store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGovernanceStore } from '../../src/client/stores/governanceStore';

// Mock fetch
global.fetch = vi.fn();

describe('Governance Store', () => {
  beforeEach(() => {
    // Reset store
    useGovernanceStore.setState({
      roles: [],
      environments: [],
      activeEnvironment: 'dev',
      auditEntries: [],
      secrets: [],
      isLoading: false,
    });

    // Reset fetch mock
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useGovernanceStore.getState();
      expect(state.roles).toEqual([]);
      expect(state.environments).toEqual([]);
      expect(state.activeEnvironment).toBe('dev');
      expect(state.auditEntries).toEqual([]);
      expect(state.secrets).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('loadRoles', () => {
    it('should load and set roles', async () => {
      const mockRoles = [
        { id: 'r1', name: 'Admin', permissions: ['read', 'write', 'delete'] },
        { id: 'r2', name: 'Viewer', permissions: ['read'] },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ roles: mockRoles }),
      });

      await useGovernanceStore.getState().loadRoles();

      const state = useGovernanceStore.getState();
      expect(state.roles).toEqual(mockRoles);
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/roles');
    });
  });

  describe('createRole', () => {
    it('should post new role and reload roles', async () => {
      const mockRoles = [
        { id: 'r1', name: 'Editor', permissions: ['read', 'write'] },
      ];

      // First call: POST role, second call: loadRoles GET
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          json: async () => ({ roles: mockRoles }),
        });

      await useGovernanceStore.getState().createRole('Editor', ['read', 'write']);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Editor', permissions: ['read', 'write'] }),
      });
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/admin/roles');

      const state = useGovernanceStore.getState();
      expect(state.roles).toEqual(mockRoles);
    });
  });

  describe('updateRole', () => {
    it('should put updated role and reload roles', async () => {
      const mockRoles = [
        { id: 'r1', name: 'Admin Updated', permissions: ['read', 'write', 'admin'] },
      ];

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          json: async () => ({ roles: mockRoles }),
        });

      await useGovernanceStore.getState().updateRole('r1', 'Admin Updated', ['read', 'write', 'admin']);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/admin/roles/r1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Admin Updated', permissions: ['read', 'write', 'admin'] }),
      });
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/admin/roles');

      const state = useGovernanceStore.getState();
      expect(state.roles).toEqual(mockRoles);
    });
  });

  describe('loadEnvironments', () => {
    it('should load environments and set activeEnvironment from isActive', async () => {
      const mockEnvironments = [
        { id: 'dev', name: 'dev', label: 'Development', config: {}, isActive: false },
        { id: 'staging', name: 'staging', label: 'Staging', config: {}, isActive: true },
        { id: 'prod', name: 'prod', label: 'Production', config: {}, isActive: false },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ environments: mockEnvironments }),
      });

      await useGovernanceStore.getState().loadEnvironments();

      const state = useGovernanceStore.getState();
      expect(state.environments).toEqual(mockEnvironments);
      expect(state.activeEnvironment).toBe('staging');
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/environments');
    });

    it('should default activeEnvironment to dev when none is active', async () => {
      const mockEnvironments = [
        { id: 'dev', name: 'dev', label: 'Development', config: {}, isActive: false },
        { id: 'staging', name: 'staging', label: 'Staging', config: {}, isActive: false },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ environments: mockEnvironments }),
      });

      await useGovernanceStore.getState().loadEnvironments();

      const state = useGovernanceStore.getState();
      expect(state.activeEnvironment).toBe('dev');
    });
  });

  describe('activateEnvironment', () => {
    it('should activate environment and reload environments', async () => {
      const mockEnvironments = [
        { id: 'dev', name: 'dev', label: 'Development', config: {}, isActive: false },
        { id: 'prod', name: 'prod', label: 'Production', config: {}, isActive: true },
      ];

      // First call: POST activate, second call: loadEnvironments GET
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          json: async () => ({ environments: mockEnvironments }),
        });

      await useGovernanceStore.getState().activateEnvironment('prod');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/admin/environments/prod/activate', {
        method: 'POST',
      });

      const state = useGovernanceStore.getState();
      // activeEnvironment is set to 'prod' immediately, then loadEnvironments confirms it
      expect(state.activeEnvironment).toBe('prod');
    });
  });

  describe('loadAudit', () => {
    it('should load audit entries with default limit of 50', async () => {
      const mockEntries = [
        {
          id: 'a1',
          userId: 'user-1',
          action: 'create',
          resource: 'workflow',
          details: 'Created workflow test.md',
          timestamp: '2026-01-01T00:00:00Z',
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ entries: mockEntries }),
      });

      await useGovernanceStore.getState().loadAudit();

      const state = useGovernanceStore.getState();
      expect(state.auditEntries).toEqual(mockEntries);
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/audit?limit=50');
    });

    it('should use custom limit when provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ entries: [] }),
      });

      await useGovernanceStore.getState().loadAudit(100);

      expect(global.fetch).toHaveBeenCalledWith('/api/admin/audit?limit=100');
    });
  });

  describe('loadSecrets', () => {
    it('should load and set secrets', async () => {
      const mockSecrets = [
        {
          id: 's1',
          name: 'SLACK_TOKEN',
          environment: 'prod',
          maskedValue: 'xoxb-****',
          lastRotated: '2026-01-01T00:00:00Z',
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ secrets: mockSecrets }),
      });

      await useGovernanceStore.getState().loadSecrets();

      const state = useGovernanceStore.getState();
      expect(state.secrets).toEqual(mockSecrets);
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/secrets');
    });
  });

  describe('createSecret', () => {
    it('should post new secret and reload secrets', async () => {
      const mockSecrets = [
        {
          id: 's1',
          name: 'API_KEY',
          environment: 'dev',
          maskedValue: 'sk-****',
          lastRotated: '2026-01-01T00:00:00Z',
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          json: async () => ({ secrets: mockSecrets }),
        });

      await useGovernanceStore.getState().createSecret('API_KEY', 'dev', 'sk-live-12345');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/admin/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'API_KEY', environment: 'dev', value: 'sk-live-12345' }),
      });
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/admin/secrets');

      const state = useGovernanceStore.getState();
      expect(state.secrets).toEqual(mockSecrets);
    });
  });
});

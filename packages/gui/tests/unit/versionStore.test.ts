import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVersionStore } from '../../src/client/stores/versionStore';

describe('versionStore', () => {
  beforeEach(() => {
    useVersionStore.setState({
      versions: [],
      isLoading: false,
      compareMode: false,
      selectedVersions: [null, null],
    });
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useVersionStore.getState();
      expect(state.versions).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.compareMode).toBe(false);
      expect(state.selectedVersions).toEqual([null, null]);
    });
  });

  describe('setCompareMode', () => {
    it('should enable compare mode and reset selected versions', () => {
      useVersionStore.setState({ selectedVersions: ['v1', 'v2'] });

      useVersionStore.getState().setCompareMode(true);

      const state = useVersionStore.getState();
      expect(state.compareMode).toBe(true);
      expect(state.selectedVersions).toEqual([null, null]);
    });

    it('should disable compare mode and reset selected versions', () => {
      useVersionStore.setState({ compareMode: true, selectedVersions: ['v1', null] });

      useVersionStore.getState().setCompareMode(false);

      const state = useVersionStore.getState();
      expect(state.compareMode).toBe(false);
      expect(state.selectedVersions).toEqual([null, null]);
    });
  });

  describe('selectForCompare', () => {
    it('should set first slot when both are empty', () => {
      useVersionStore.getState().selectForCompare('v1');

      expect(useVersionStore.getState().selectedVersions).toEqual(['v1', null]);
    });

    it('should set second slot when first is filled', () => {
      useVersionStore.setState({ selectedVersions: ['v1', null] });

      useVersionStore.getState().selectForCompare('v2');

      expect(useVersionStore.getState().selectedVersions).toEqual(['v1', 'v2']);
    });

    it('should reset to first slot when both are filled', () => {
      useVersionStore.setState({ selectedVersions: ['v1', 'v2'] });

      useVersionStore.getState().selectForCompare('v3');

      expect(useVersionStore.getState().selectedVersions).toEqual(['v3', null]);
    });
  });

  describe('loadVersions', () => {
    it('should fetch and set versions', async () => {
      const mockVersions = [
        { id: 'v1', workflowPath: 'test.md', version: 1, message: 'init', author: 'user', createdAt: '2025-01-01', hash: 'abc', isAutoSave: false },
        { id: 'v2', workflowPath: 'test.md', version: 2, message: 'update', author: 'user', createdAt: '2025-01-02', hash: 'def', isAutoSave: false },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versions: mockVersions }),
      });

      await useVersionStore.getState().loadVersions('test.md');

      const state = useVersionStore.getState();
      expect(state.versions).toEqual(mockVersions);
      expect(state.isLoading).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith('/api/versions/test.md/versions');
    });

    it('should set isLoading false on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
      });

      await useVersionStore.getState().loadVersions('test.md');

      const state = useVersionStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      await useVersionStore.getState().loadVersions('test.md');

      const state = useVersionStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('createVersion', () => {
    it('should POST and then reload versions', async () => {
      const mockVersions = [
        { id: 'v1', workflowPath: 'test.md', version: 1, message: 'created', author: 'user', createdAt: '2025-01-01', hash: 'abc', isAutoSave: false },
      ];

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // POST create
        .mockResolvedValueOnce({ ok: true, json: async () => ({ versions: mockVersions }) }); // GET loadVersions

      await useVersionStore.getState().createVersion('test.md', '# Content', 'created');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/versions/test.md/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Content', message: 'created' }),
      });

      const state = useVersionStore.getState();
      expect(state.versions).toEqual(mockVersions);
    });
  });

  describe('restoreVersion', () => {
    it('should POST restore and return content', async () => {
      const mockVersions = [
        { id: 'v1', workflowPath: 'test.md', version: 1, message: 'init', author: 'user', createdAt: '2025-01-01', hash: 'abc', isAutoSave: false },
      ];

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ restoredContent: '# Restored' }) }) // POST restore
        .mockResolvedValueOnce({ ok: true, json: async () => ({ versions: mockVersions }) }); // GET loadVersions

      const result = await useVersionStore.getState().restoreVersion('test.md', 'v1');

      expect(result).toBe('# Restored');
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        '/api/versions/test.md/versions/v1/restore',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
    });

    it('should return null on failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false });

      const result = await useVersionStore.getState().restoreVersion('test.md', 'v1');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await useVersionStore.getState().restoreVersion('test.md', 'v1');

      expect(result).toBeNull();
    });
  });
});

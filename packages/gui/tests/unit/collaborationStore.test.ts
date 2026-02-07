/**
 * Tests for collaboration store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCollaborationStore } from '../../src/client/stores/collaborationStore';

// Mock fetch
global.fetch = vi.fn();

describe('Collaboration Store', () => {
  beforeEach(() => {
    // Reset store
    useCollaborationStore.setState({
      lock: null,
      comments: [],
      activities: [],
      presence: [],
      isLocked: false,
    });

    // Reset fetch mock
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useCollaborationStore.getState();
      expect(state.lock).toBeNull();
      expect(state.comments).toEqual([]);
      expect(state.activities).toEqual([]);
      expect(state.presence).toEqual([]);
      expect(state.isLocked).toBe(false);
    });
  });

  describe('addPresence', () => {
    it('should add a presence entry', () => {
      const presence = {
        userId: 'user-1',
        userName: 'Alice',
        color: '#ff0000',
        lastSeen: '2026-01-01T00:00:00Z',
      };

      useCollaborationStore.getState().addPresence(presence);

      const state = useCollaborationStore.getState();
      expect(state.presence).toHaveLength(1);
      expect(state.presence[0]).toEqual(presence);
    });

    it('should replace existing presence entry by userId', () => {
      const presence1 = {
        userId: 'user-1',
        userName: 'Alice',
        color: '#ff0000',
        lastSeen: '2026-01-01T00:00:00Z',
      };
      const presence2 = {
        userId: 'user-1',
        userName: 'Alice Updated',
        color: '#00ff00',
        lastSeen: '2026-01-01T01:00:00Z',
      };

      useCollaborationStore.getState().addPresence(presence1);
      useCollaborationStore.getState().addPresence(presence2);

      const state = useCollaborationStore.getState();
      expect(state.presence).toHaveLength(1);
      expect(state.presence[0]).toEqual(presence2);
    });
  });

  describe('removePresence', () => {
    it('should remove presence by userId', () => {
      const presence = {
        userId: 'user-1',
        userName: 'Alice',
        color: '#ff0000',
        lastSeen: '2026-01-01T00:00:00Z',
      };

      useCollaborationStore.getState().addPresence(presence);
      useCollaborationStore.getState().removePresence('user-1');

      const state = useCollaborationStore.getState();
      expect(state.presence).toEqual([]);
    });

    it('should not affect other users when removing', () => {
      const presence1 = {
        userId: 'user-1',
        userName: 'Alice',
        color: '#ff0000',
        lastSeen: '2026-01-01T00:00:00Z',
      };
      const presence2 = {
        userId: 'user-2',
        userName: 'Bob',
        color: '#0000ff',
        lastSeen: '2026-01-01T00:00:00Z',
      };

      useCollaborationStore.getState().addPresence(presence1);
      useCollaborationStore.getState().addPresence(presence2);
      useCollaborationStore.getState().removePresence('user-1');

      const state = useCollaborationStore.getState();
      expect(state.presence).toHaveLength(1);
      expect(state.presence[0].userId).toBe('user-2');
    });
  });

  describe('checkLock', () => {
    it('should set lock and isLocked when workflow is locked', async () => {
      const mockLock = {
        workflowPath: 'test.md',
        lockedBy: 'user-1',
        lockedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-01T01:00:00Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ locked: true, lock: mockLock }),
      });

      await useCollaborationStore.getState().checkLock('test.md');

      const state = useCollaborationStore.getState();
      expect(state.lock).toEqual(mockLock);
      expect(state.isLocked).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/collaboration/lock/${encodeURIComponent('test.md')}`
      );
    });

    it('should set null and false when workflow is not locked', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ locked: false }),
      });

      await useCollaborationStore.getState().checkLock('test.md');

      const state = useCollaborationStore.getState();
      expect(state.lock).toBeNull();
      expect(state.isLocked).toBe(false);
    });

    it('should set null and false on fetch error', async () => {
      // Set locked state first
      useCollaborationStore.setState({ lock: { workflowPath: 'x', lockedBy: 'u', lockedAt: '', expiresAt: '' }, isLocked: true });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      await useCollaborationStore.getState().checkLock('test.md');

      const state = useCollaborationStore.getState();
      expect(state.lock).toBeNull();
      expect(state.isLocked).toBe(false);
    });
  });

  describe('acquireLock', () => {
    it('should set lock and return true on success', async () => {
      const mockLock = {
        workflowPath: 'test.md',
        lockedBy: 'user-1',
        lockedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-01T01:00:00Z',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lock: mockLock }),
      });

      const result = await useCollaborationStore.getState().acquireLock('test.md', 'user-1');

      expect(result).toBe(true);
      const state = useCollaborationStore.getState();
      expect(state.lock).toEqual(mockLock);
      expect(state.isLocked).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/collaboration/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowPath: 'test.md', userId: 'user-1' }),
      });
    });

    it('should return false when lock acquisition fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      });

      const result = await useCollaborationStore.getState().acquireLock('test.md', 'user-1');

      expect(result).toBe(false);
      const state = useCollaborationStore.getState();
      expect(state.lock).toBeNull();
      expect(state.isLocked).toBe(false);
    });

    it('should return false on fetch error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const result = await useCollaborationStore.getState().acquireLock('test.md', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('should set lock to null and isLocked to false', async () => {
      useCollaborationStore.setState({
        lock: { workflowPath: 'test.md', lockedBy: 'user-1', lockedAt: '', expiresAt: '' },
        isLocked: true,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

      await useCollaborationStore.getState().releaseLock('test.md', 'user-1');

      const state = useCollaborationStore.getState();
      expect(state.lock).toBeNull();
      expect(state.isLocked).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith('/api/collaboration/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowPath: 'test.md', userId: 'user-1' }),
      });
    });
  });

  describe('loadComments', () => {
    it('should load and set comments', async () => {
      const mockComments = [
        {
          id: 'c1',
          workflowPath: 'test.md',
          author: 'user-1',
          text: 'Great workflow!',
          createdAt: '2026-01-01T00:00:00Z',
          resolved: false,
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ comments: mockComments }),
      });

      await useCollaborationStore.getState().loadComments('test.md');

      const state = useCollaborationStore.getState();
      expect(state.comments).toEqual(mockComments);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/collaboration/comments/${encodeURIComponent('test.md')}`
      );
    });
  });

  describe('addComment', () => {
    it('should post comment and reload comments', async () => {
      const mockComments = [
        {
          id: 'c1',
          workflowPath: 'test.md',
          author: 'current-user',
          text: 'New comment',
          createdAt: '2026-01-01T00:00:00Z',
          resolved: false,
        },
      ];

      // First call: POST comment, second call: loadComments GET
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          json: async () => ({ comments: mockComments }),
        });

      await useCollaborationStore.getState().addComment('test.md', 'New comment', 'node-1', 'parent-1');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/collaboration/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowPath: 'test.md',
          text: 'New comment',
          nodeId: 'node-1',
          parentId: 'parent-1',
          author: 'current-user',
        }),
      });

      const state = useCollaborationStore.getState();
      expect(state.comments).toEqual(mockComments);
    });
  });

  describe('resolveComment', () => {
    it('should resolve comment and reload comments', async () => {
      const mockComments = [
        {
          id: 'c1',
          workflowPath: 'test.md',
          author: 'user-1',
          text: 'Resolved comment',
          createdAt: '2026-01-01T00:00:00Z',
          resolved: true,
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          json: async () => ({ comments: mockComments }),
        });

      await useCollaborationStore.getState().resolveComment('test.md', 'c1');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/collaboration/comments/c1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowPath: 'test.md' }),
      });

      const state = useCollaborationStore.getState();
      expect(state.comments).toEqual(mockComments);
    });
  });

  describe('loadActivity', () => {
    it('should load and set activities', async () => {
      const mockActivities = [
        {
          id: 'a1',
          workflowPath: 'test.md',
          author: 'user-1',
          action: 'edited',
          details: 'Updated step 1',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({ activities: mockActivities }),
      });

      await useCollaborationStore.getState().loadActivity('test.md');

      const state = useCollaborationStore.getState();
      expect(state.activities).toEqual(mockActivities);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/collaboration/activity/${encodeURIComponent('test.md')}`
      );
    });
  });
});

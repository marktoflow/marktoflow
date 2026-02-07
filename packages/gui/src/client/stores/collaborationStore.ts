import { create } from 'zustand';

interface WorkflowLock {
  workflowPath: string;
  lockedBy: string;
  lockedAt: string;
  expiresAt: string;
}

interface Comment {
  id: string;
  workflowPath: string;
  nodeId?: string;
  author: string;
  text: string;
  createdAt: string;
  parentId?: string;
  resolved: boolean;
}

interface Activity {
  id: string;
  workflowPath: string;
  author: string;
  action: string;
  details: string;
  createdAt: string;
}

interface Presence {
  userId: string;
  userName: string;
  color: string;
  lastSeen: string;
}

interface CollaborationState {
  lock: WorkflowLock | null;
  comments: Comment[];
  activities: Activity[];
  presence: Presence[];
  isLocked: boolean;

  checkLock: (workflowPath: string) => Promise<void>;
  acquireLock: (workflowPath: string, userId: string) => Promise<boolean>;
  releaseLock: (workflowPath: string, userId: string) => Promise<void>;

  loadComments: (workflowPath: string) => Promise<void>;
  addComment: (workflowPath: string, text: string, nodeId?: string, parentId?: string) => Promise<void>;
  resolveComment: (workflowPath: string, commentId: string) => Promise<void>;

  loadActivity: (workflowPath: string) => Promise<void>;

  addPresence: (presence: Presence) => void;
  removePresence: (userId: string) => void;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  lock: null,
  comments: [],
  activities: [],
  presence: [],
  isLocked: false,

  checkLock: async (workflowPath) => {
    try {
      const res = await fetch(`/api/collaboration/lock/${encodeURIComponent(workflowPath)}`);
      const data = await res.json();
      set({ lock: data.locked ? data.lock : null, isLocked: data.locked });
    } catch {
      set({ lock: null, isLocked: false });
    }
  },

  acquireLock: async (workflowPath, userId) => {
    try {
      const res = await fetch('/api/collaboration/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowPath, userId }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ lock: data.lock, isLocked: true });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  releaseLock: async (workflowPath, userId) => {
    try {
      await fetch('/api/collaboration/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowPath, userId }),
      });
      set({ lock: null, isLocked: false });
    } catch { /* ignore */ }
  },

  loadComments: async (workflowPath) => {
    try {
      const res = await fetch(`/api/collaboration/comments/${encodeURIComponent(workflowPath)}`);
      const data = await res.json();
      set({ comments: data.comments });
    } catch { /* ignore */ }
  },

  addComment: async (workflowPath, text, nodeId, parentId) => {
    try {
      await fetch('/api/collaboration/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowPath, text, nodeId, parentId, author: 'current-user' }),
      });
      await get().loadComments(workflowPath);
    } catch { /* ignore */ }
  },

  resolveComment: async (workflowPath, commentId) => {
    try {
      await fetch(`/api/collaboration/comments/${commentId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowPath }),
      });
      await get().loadComments(workflowPath);
    } catch { /* ignore */ }
  },

  loadActivity: async (workflowPath) => {
    try {
      const res = await fetch(`/api/collaboration/activity/${encodeURIComponent(workflowPath)}`);
      const data = await res.json();
      set({ activities: data.activities });
    } catch { /* ignore */ }
  },

  addPresence: (presence) => {
    set((state) => ({
      presence: [...state.presence.filter((p) => p.userId !== presence.userId), presence],
    }));
  },

  removePresence: (userId) => {
    set((state) => ({
      presence: state.presence.filter((p) => p.userId !== userId),
    }));
  },
}));

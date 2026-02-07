import { create } from 'zustand';

interface VersionMeta {
  id: string;
  workflowPath: string;
  version: number;
  message: string;
  author: string;
  createdAt: string;
  hash: string;
  isAutoSave: boolean;
}

interface VersionState {
  versions: VersionMeta[];
  isLoading: boolean;
  compareMode: boolean;
  selectedVersions: [string | null, string | null];

  loadVersions: (workflowPath: string) => Promise<void>;
  createVersion: (workflowPath: string, content: string, message: string) => Promise<void>;
  restoreVersion: (workflowPath: string, versionId: string) => Promise<string | null>;
  setCompareMode: (enabled: boolean) => void;
  selectForCompare: (versionId: string) => void;
}

export const useVersionStore = create<VersionState>((set, get) => ({
  versions: [],
  isLoading: false,
  compareMode: false,
  selectedVersions: [null, null],

  loadVersions: async (workflowPath) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/versions/${encodeURIComponent(workflowPath)}/versions`);
      if (!res.ok) throw new Error('Failed to load versions');
      const data = await res.json();
      set({ versions: data.versions, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createVersion: async (workflowPath, content, message) => {
    try {
      await fetch(`/api/versions/${encodeURIComponent(workflowPath)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, message }),
      });
      await get().loadVersions(workflowPath);
    } catch {
      // Ignore
    }
  },

  restoreVersion: async (workflowPath, versionId) => {
    try {
      const res = await fetch(
        `/api/versions/${encodeURIComponent(workflowPath)}/versions/${versionId}/restore`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      if (!res.ok) throw new Error('Failed to restore');
      const data = await res.json();
      await get().loadVersions(workflowPath);
      return data.restoredContent;
    } catch {
      return null;
    }
  },

  setCompareMode: (enabled) => set({ compareMode: enabled, selectedVersions: [null, null] }),

  selectForCompare: (versionId) => {
    const { selectedVersions } = get();
    if (!selectedVersions[0]) {
      set({ selectedVersions: [versionId, null] });
    } else if (!selectedVersions[1]) {
      set({ selectedVersions: [selectedVersions[0], versionId] });
    } else {
      set({ selectedVersions: [versionId, null] });
    }
  },
}));

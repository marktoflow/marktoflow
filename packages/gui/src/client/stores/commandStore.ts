import { create } from 'zustand';
import Fuse from 'fuse.js';

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: 'action' | 'workflow' | 'node' | 'setting' | 'navigation';
  icon?: string;
  shortcut?: string;
  execute: () => void;
  keywords?: string[];
}

interface CommandState {
  isOpen: boolean;
  mode: 'commands' | 'workflows' | 'nodes';
  query: string;
  selectedIndex: number;
  commands: Command[];
  recentCommandIds: string[];

  // Actions
  open: (mode?: CommandState['mode']) => void;
  close: () => void;
  setQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  registerCommand: (command: Command) => void;
  registerCommands: (commands: Command[]) => void;
  unregisterCommand: (id: string) => void;
  executeSelected: () => void;
  executeCommand: (id: string) => void;
  moveUp: () => void;
  moveDown: () => void;
  getFilteredCommands: () => Command[];
}

const MAX_RECENT = 5;

// Load recent commands from localStorage
function loadRecent(): string[] {
  try {
    const stored = localStorage.getItem('marktoflow-recent-commands');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecent(ids: string[]) {
  try {
    localStorage.setItem('marktoflow-recent-commands', JSON.stringify(ids));
  } catch {
    // Ignore
  }
}

export const useCommandStore = create<CommandState>((set, get) => ({
  isOpen: false,
  mode: 'commands',
  query: '',
  selectedIndex: 0,
  commands: [],
  recentCommandIds: loadRecent(),

  open: (mode = 'commands') => {
    set({ isOpen: true, mode, query: '', selectedIndex: 0 });
  },

  close: () => {
    set({ isOpen: false, query: '', selectedIndex: 0 });
  },

  setQuery: (query) => {
    set({ query, selectedIndex: 0 });
  },

  setSelectedIndex: (selectedIndex) => {
    set({ selectedIndex });
  },

  registerCommand: (command) => {
    set((state) => {
      // Avoid duplicates
      const filtered = state.commands.filter((c) => c.id !== command.id);
      return { commands: [...filtered, command] };
    });
  },

  registerCommands: (commands) => {
    set((state) => {
      const existingIds = new Set(commands.map((c) => c.id));
      const filtered = state.commands.filter((c) => !existingIds.has(c.id));
      return { commands: [...filtered, ...commands] };
    });
  },

  unregisterCommand: (id) => {
    set((state) => ({
      commands: state.commands.filter((c) => c.id !== id),
    }));
  },

  executeSelected: () => {
    const { selectedIndex, recentCommandIds } = get();
    const filtered = get().getFilteredCommands();
    const command = filtered[selectedIndex];
    if (command) {
      // Track recent
      const newRecent = [command.id, ...recentCommandIds.filter((id) => id !== command.id)].slice(0, MAX_RECENT);
      saveRecent(newRecent);
      set({ isOpen: false, query: '', selectedIndex: 0, recentCommandIds: newRecent });
      command.execute();
    }
  },

  executeCommand: (id) => {
    const { commands, recentCommandIds } = get();
    const command = commands.find((c) => c.id === id);
    if (command) {
      const newRecent = [command.id, ...recentCommandIds.filter((rid) => rid !== command.id)].slice(0, MAX_RECENT);
      saveRecent(newRecent);
      set({ isOpen: false, query: '', selectedIndex: 0, recentCommandIds: newRecent });
      command.execute();
    }
  },

  moveUp: () => {
    const { selectedIndex } = get();
    const filtered = get().getFilteredCommands();
    set({ selectedIndex: selectedIndex > 0 ? selectedIndex - 1 : filtered.length - 1 });
  },

  moveDown: () => {
    const { selectedIndex } = get();
    const filtered = get().getFilteredCommands();
    set({ selectedIndex: selectedIndex < filtered.length - 1 ? selectedIndex + 1 : 0 });
  },

  getFilteredCommands: () => {
    const { commands, query, mode, recentCommandIds } = get();

    // Filter by mode
    let pool = commands;
    if (mode === 'workflows') {
      pool = commands.filter((c) => c.category === 'workflow');
    } else if (mode === 'nodes') {
      pool = commands.filter((c) => c.category === 'node');
    }

    if (!query.trim()) {
      // Show recent first, then the rest
      const recentSet = new Set(recentCommandIds);
      const recent = recentCommandIds
        .map((id) => pool.find((c) => c.id === id))
        .filter(Boolean) as Command[];
      const rest = pool.filter((c) => !recentSet.has(c.id));
      return [...recent, ...rest];
    }

    // Fuzzy search
    const fuse = new Fuse(pool, {
      keys: [
        { name: 'label', weight: 0.5 },
        { name: 'description', weight: 0.2 },
        { name: 'keywords', weight: 0.2 },
        { name: 'category', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });

    return fuse.search(query).map((result) => result.item);
  },
}));

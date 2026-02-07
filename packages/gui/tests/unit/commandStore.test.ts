import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCommandStore, Command } from '../../src/client/stores/commandStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function makeCommand(overrides: Partial<Command> & { id: string }): Command {
  return {
    label: overrides.id,
    category: 'action',
    execute: vi.fn(),
    ...overrides,
  };
}

describe('commandStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useCommandStore.setState({
      isOpen: false,
      mode: 'commands',
      query: '',
      selectedIndex: 0,
      commands: [],
      recentCommandIds: [],
    });
  });

  describe('initial state', () => {
    it('should have isOpen false and empty commands', () => {
      const state = useCommandStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.commands).toEqual([]);
      expect(state.query).toBe('');
      expect(state.selectedIndex).toBe(0);
      expect(state.mode).toBe('commands');
    });
  });

  describe('open/close', () => {
    it('should open the palette with defaults', () => {
      const { open } = useCommandStore.getState();

      open();

      const state = useCommandStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.mode).toBe('commands');
      expect(state.query).toBe('');
      expect(state.selectedIndex).toBe(0);
    });

    it('should open with a specific mode', () => {
      const { open } = useCommandStore.getState();

      open('workflows');

      const state = useCommandStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.mode).toBe('workflows');
    });

    it('should close and reset query and selectedIndex', () => {
      useCommandStore.setState({ isOpen: true, query: 'test', selectedIndex: 3 });

      const { close } = useCommandStore.getState();
      close();

      const state = useCommandStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.query).toBe('');
      expect(state.selectedIndex).toBe(0);
    });
  });

  describe('registerCommand', () => {
    it('should add a command', () => {
      const { registerCommand } = useCommandStore.getState();
      const cmd = makeCommand({ id: 'cmd-1' });

      registerCommand(cmd);

      const state = useCommandStore.getState();
      expect(state.commands).toHaveLength(1);
      expect(state.commands[0].id).toBe('cmd-1');
    });

    it('should avoid duplicates by replacing existing command', () => {
      const { registerCommand } = useCommandStore.getState();
      const cmd1 = makeCommand({ id: 'cmd-1', label: 'First' });
      const cmd2 = makeCommand({ id: 'cmd-1', label: 'Updated' });

      registerCommand(cmd1);
      registerCommand(cmd2);

      const state = useCommandStore.getState();
      expect(state.commands).toHaveLength(1);
      expect(state.commands[0].label).toBe('Updated');
    });
  });

  describe('registerCommands', () => {
    it('should batch register multiple commands', () => {
      const { registerCommands } = useCommandStore.getState();
      const cmds = [
        makeCommand({ id: 'a' }),
        makeCommand({ id: 'b' }),
        makeCommand({ id: 'c' }),
      ];

      registerCommands(cmds);

      const state = useCommandStore.getState();
      expect(state.commands).toHaveLength(3);
    });

    it('should replace existing commands with same id', () => {
      const { registerCommand, registerCommands } = useCommandStore.getState();
      registerCommand(makeCommand({ id: 'a', label: 'Old' }));

      registerCommands([makeCommand({ id: 'a', label: 'New' }), makeCommand({ id: 'b' })]);

      const state = useCommandStore.getState();
      expect(state.commands).toHaveLength(2);
      const cmdA = state.commands.find((c) => c.id === 'a');
      expect(cmdA?.label).toBe('New');
    });
  });

  describe('unregisterCommand', () => {
    it('should remove a command by id', () => {
      const { registerCommands, unregisterCommand } = useCommandStore.getState();
      registerCommands([makeCommand({ id: 'a' }), makeCommand({ id: 'b' })]);

      useCommandStore.getState().unregisterCommand('a');

      const state = useCommandStore.getState();
      expect(state.commands).toHaveLength(1);
      expect(state.commands[0].id).toBe('b');
    });
  });

  describe('setQuery', () => {
    it('should set query and reset selectedIndex', () => {
      useCommandStore.setState({ selectedIndex: 5 });

      const { setQuery } = useCommandStore.getState();
      setQuery('hello');

      const state = useCommandStore.getState();
      expect(state.query).toBe('hello');
      expect(state.selectedIndex).toBe(0);
    });
  });

  describe('moveUp/moveDown', () => {
    beforeEach(() => {
      const cmds = [
        makeCommand({ id: 'a' }),
        makeCommand({ id: 'b' }),
        makeCommand({ id: 'c' }),
      ];
      useCommandStore.setState({ commands: cmds, selectedIndex: 0, query: '' });
    });

    it('should move down', () => {
      useCommandStore.getState().moveDown();
      expect(useCommandStore.getState().selectedIndex).toBe(1);
    });

    it('should wrap around when moving down past the end', () => {
      useCommandStore.setState({ selectedIndex: 2 });
      useCommandStore.getState().moveDown();
      expect(useCommandStore.getState().selectedIndex).toBe(0);
    });

    it('should move up', () => {
      useCommandStore.setState({ selectedIndex: 2 });
      useCommandStore.getState().moveUp();
      expect(useCommandStore.getState().selectedIndex).toBe(1);
    });

    it('should wrap around when moving up past the beginning', () => {
      useCommandStore.setState({ selectedIndex: 0 });
      useCommandStore.getState().moveUp();
      expect(useCommandStore.getState().selectedIndex).toBe(2);
    });
  });

  describe('executeCommand', () => {
    it('should call execute, track recent, and close palette', () => {
      const executeFn = vi.fn();
      const cmd = makeCommand({ id: 'run-it', execute: executeFn });
      useCommandStore.setState({ commands: [cmd], isOpen: true });

      useCommandStore.getState().executeCommand('run-it');

      expect(executeFn).toHaveBeenCalledOnce();
      const state = useCommandStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.recentCommandIds).toContain('run-it');
    });

    it('should not execute if command id not found', () => {
      const executeFn = vi.fn();
      const cmd = makeCommand({ id: 'exists', execute: executeFn });
      useCommandStore.setState({ commands: [cmd] });

      useCommandStore.getState().executeCommand('does-not-exist');

      expect(executeFn).not.toHaveBeenCalled();
    });
  });

  describe('executeSelected', () => {
    it('should execute the command at the selectedIndex', () => {
      const executeFn = vi.fn();
      const cmds = [
        makeCommand({ id: 'a' }),
        makeCommand({ id: 'b', execute: executeFn }),
        makeCommand({ id: 'c' }),
      ];
      useCommandStore.setState({ commands: cmds, selectedIndex: 1, query: '' });

      useCommandStore.getState().executeSelected();

      expect(executeFn).toHaveBeenCalledOnce();
      expect(useCommandStore.getState().isOpen).toBe(false);
    });
  });

  describe('getFilteredCommands', () => {
    it('should return all commands when no query and mode is commands', () => {
      const cmds = [
        makeCommand({ id: 'a', category: 'action' }),
        makeCommand({ id: 'b', category: 'workflow' }),
        makeCommand({ id: 'c', category: 'node' }),
      ];
      useCommandStore.setState({ commands: cmds, query: '', mode: 'commands' });

      const filtered = useCommandStore.getState().getFilteredCommands();
      expect(filtered).toHaveLength(3);
    });

    it('should filter by workflow mode', () => {
      const cmds = [
        makeCommand({ id: 'a', category: 'action' }),
        makeCommand({ id: 'b', category: 'workflow' }),
        makeCommand({ id: 'c', category: 'node' }),
      ];
      useCommandStore.setState({ commands: cmds, query: '', mode: 'workflows' });

      const filtered = useCommandStore.getState().getFilteredCommands();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('b');
    });

    it('should filter by node mode', () => {
      const cmds = [
        makeCommand({ id: 'a', category: 'action' }),
        makeCommand({ id: 'b', category: 'workflow' }),
        makeCommand({ id: 'c', category: 'node' }),
      ];
      useCommandStore.setState({ commands: cmds, query: '', mode: 'nodes' });

      const filtered = useCommandStore.getState().getFilteredCommands();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('c');
    });

    it('should use fuzzy search with a query', () => {
      const cmds = [
        makeCommand({ id: 'a', label: 'Deploy workflow' }),
        makeCommand({ id: 'b', label: 'Delete node' }),
        makeCommand({ id: 'c', label: 'Open settings' }),
      ];
      useCommandStore.setState({ commands: cmds, query: 'deploy', mode: 'commands' });

      const filtered = useCommandStore.getState().getFilteredCommands();
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered[0].label).toBe('Deploy workflow');
    });
  });

  describe('recent commands', () => {
    it('should show recent commands first when no query', () => {
      const cmds = [
        makeCommand({ id: 'a', label: 'Alpha' }),
        makeCommand({ id: 'b', label: 'Beta' }),
        makeCommand({ id: 'c', label: 'Charlie' }),
      ];
      useCommandStore.setState({
        commands: cmds,
        recentCommandIds: ['c', 'a'],
        query: '',
        mode: 'commands',
      });

      const filtered = useCommandStore.getState().getFilteredCommands();
      expect(filtered[0].id).toBe('c');
      expect(filtered[1].id).toBe('a');
      expect(filtered[2].id).toBe('b');
    });

    it('should limit recent commands to MAX_RECENT (5)', () => {
      const cmds = Array.from({ length: 7 }, (_, i) =>
        makeCommand({ id: `cmd-${i}` })
      );
      useCommandStore.setState({ commands: cmds, recentCommandIds: [] });

      // Execute 7 commands
      for (let i = 0; i < 7; i++) {
        useCommandStore.getState().executeCommand(`cmd-${i}`);
        // Re-open so we can keep executing
        useCommandStore.setState({ isOpen: true });
      }

      const state = useCommandStore.getState();
      expect(state.recentCommandIds).toHaveLength(5);
    });

    it('should persist recent commands to localStorage', () => {
      const cmd = makeCommand({ id: 'persisted' });
      useCommandStore.setState({ commands: [cmd] });

      useCommandStore.getState().executeCommand('persisted');

      const stored = localStorageMock.getItem('marktoflow-recent-commands');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toContain('persisted');
    });
  });
});

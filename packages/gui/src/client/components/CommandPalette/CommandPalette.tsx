import { useEffect, useRef, useCallback } from 'react';
import { Search, Command as CommandIcon, FileText, LayoutGrid } from 'lucide-react';
import { useCommandStore } from '../../stores/commandStore';
import { CommandItem } from './CommandItem';

export function CommandPalette() {
  const {
    isOpen,
    mode,
    query,
    selectedIndex,
    close,
    setQuery,
    setSelectedIndex,
    executeSelected,
    moveUp,
    moveDown,
    getFilteredCommands,
    open,
  } = useCommandStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filteredCommands = isOpen ? getFilteredCommands() : [];

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the dialog is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveUp();
          break;
        case 'Enter':
          e.preventDefault();
          executeSelected();
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
        case 'Tab':
          e.preventDefault();
          // Cycle through modes
          if (mode === 'commands') open('workflows');
          else if (mode === 'workflows') open('nodes');
          else open('commands');
          break;
      }
    },
    [moveDown, moveUp, executeSelected, close, mode, open]
  );

  if (!isOpen) return null;

  const modeConfig = {
    commands: { icon: CommandIcon, placeholder: 'Type a command...', label: 'Commands' },
    workflows: { icon: FileText, placeholder: 'Search workflows...', label: 'Workflows' },
    nodes: { icon: LayoutGrid, placeholder: 'Search nodes...', label: 'Nodes' },
  };

  const config = modeConfig[mode];
  const ModeIcon = config.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={close}
        aria-hidden="true"
      />

      {/* Palette */}
      <div
        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 bg-bg-panel border border-border-default rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        {/* Mode tabs */}
        <div className="flex border-b border-border-default">
          {(Object.keys(modeConfig) as Array<keyof typeof modeConfig>).map((m) => {
            const Icon = modeConfig[m].icon;
            return (
              <button
                key={m}
                onClick={() => open(m)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
                  mode === m
                    ? 'text-primary border-b-2 border-primary -mb-px'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {modeConfig[m].label}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default">
          <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={config.placeholder}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={filteredCommands[selectedIndex]?.id}
          />
          <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-default rounded text-xs font-mono text-text-muted">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-list"
          className="max-h-[320px] overflow-y-auto py-1"
          role="listbox"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              {query ? 'No matching commands found' : 'No commands available'}
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <CommandItem
                key={command.id}
                command={command}
                isSelected={index === selectedIndex}
                onSelect={() => setSelectedIndex(index)}
                onExecute={() => {
                  setSelectedIndex(index);
                  executeSelected();
                }}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-default text-xs text-text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-surface border border-border-default rounded font-mono">
                &uarr;&darr;
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-surface border border-border-default rounded font-mono">
                &crarr;
              </kbd>
              Execute
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-surface border border-border-default rounded font-mono">
                Tab
              </kbd>
              Switch mode
            </span>
          </div>
          <span>{filteredCommands.length} results</span>
        </div>
      </div>
    </>
  );
}

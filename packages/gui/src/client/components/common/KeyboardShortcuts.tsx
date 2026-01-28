import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';
import { Keyboard } from 'lucide-react';
import { getModKey } from '../../utils/platform';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // General
  { keys: ['⌘', 'S'], description: 'Save workflow', category: 'General' },
  { keys: ['⌘', 'Z'], description: 'Undo', category: 'General' },
  { keys: ['⌘', '⇧', 'Z'], description: 'Redo', category: 'General' },
  { keys: ['⌘', '?'], description: 'Show keyboard shortcuts', category: 'General' },

  // Canvas
  { keys: ['N'], description: 'Add new step', category: 'Canvas' },
  { keys: ['⌘', 'L'], description: 'Auto-layout canvas', category: 'Canvas' },
  { keys: ['⌘', '0'], description: 'Fit view', category: 'Canvas' },
  { keys: ['⌘', '+'], description: 'Zoom in', category: 'Canvas' },
  { keys: ['⌘', '-'], description: 'Zoom out', category: 'Canvas' },
  { keys: ['⌫'], description: 'Delete selected', category: 'Canvas' },
  { keys: ['⌘', 'D'], description: 'Duplicate selected', category: 'Canvas' },

  // Editing
  { keys: ['Double-click'], description: 'Edit step', category: 'Editing' },
  { keys: ['E'], description: 'Edit selected step', category: 'Editing' },
  { keys: ['Y'], description: 'View YAML', category: 'Editing' },
  { keys: ['Escape'], description: 'Close modal / deselect', category: 'Editing' },

  // Navigation
  { keys: ['⌘', '←'], description: 'Back to parent workflow', category: 'Navigation' },
  { keys: ['⌘', '↑'], description: 'Go to root workflow', category: 'Navigation' },

  // Execution
  { keys: ['⌘', '↵'], description: 'Execute workflow', category: 'Execution' },

  // Debugging
  { keys: ['F9'], description: 'Toggle debug mode', category: 'Debugging' },
  { keys: ['F5'], description: 'Continue execution', category: 'Debugging' },
  { keys: ['F10'], description: 'Step over', category: 'Debugging' },
  { keys: ['F11'], description: 'Step into', category: 'Debugging' },
  { keys: ['⇧', 'F11'], description: 'Step out', category: 'Debugging' },
];

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  // Group shortcuts by category
  const categories = [...new Set(shortcuts.map((s) => s.category))];

  // Get platform-specific modifier key
  const modKey = getModKey();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Keyboard Shortcuts"
      description="Quick reference for all keyboard shortcuts"
      size="md"
    >
      <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              {category}
            </h3>
            <div className="space-y-2">
              {shortcuts
                .filter((s) => s.category === category)
                .map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5 border-b border-node-border last:border-0"
                  >
                    <span className="text-sm text-gray-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="px-2 py-1 bg-node-bg border border-node-border rounded text-xs font-mono text-gray-300"
                        >
                          {key === '⌘' ? modKey : key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// Hook to manage keyboard shortcuts modal
export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘+? or Ctrl+? to open shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    setIsOpen,
    openShortcuts: () => setIsOpen(true),
  };
}

// Small button to show keyboard shortcuts
export function KeyboardShortcutsButton({ onClick }: { onClick: () => void }) {
  const modKey = getModKey();

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      title={`Keyboard shortcuts (${modKey}/)`}
    >
      <Keyboard className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Shortcuts</span>
    </button>
  );
}

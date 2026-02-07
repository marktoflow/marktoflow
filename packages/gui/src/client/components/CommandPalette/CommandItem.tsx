import { memo } from 'react';
import {
  Workflow,
  Settings,
  Navigation,
  Zap,
  LayoutGrid,
} from 'lucide-react';
import type { Command } from '../../stores/commandStore';

const categoryIcons: Record<Command['category'], typeof Zap> = {
  action: Zap,
  workflow: Workflow,
  node: LayoutGrid,
  setting: Settings,
  navigation: Navigation,
};

const categoryColors: Record<Command['category'], string> = {
  action: 'text-accent',
  workflow: 'text-primary',
  node: 'text-warning',
  setting: 'text-gray-400',
  navigation: 'text-success',
};

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  onSelect: () => void;
  onExecute: () => void;
}

function CommandItemComponent({ command, isSelected, onSelect, onExecute }: CommandItemProps) {
  const CategoryIcon = categoryIcons[command.category] || Zap;
  const color = categoryColors[command.category] || 'text-gray-400';

  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected
          ? 'bg-primary/10 text-text-primary'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
      onClick={onExecute}
      onMouseEnter={onSelect}
      role="option"
      aria-selected={isSelected}
    >
      <CategoryIcon className={`w-4 h-4 flex-shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{command.label}</div>
        {command.description && (
          <div className="text-xs text-text-muted truncate">{command.description}</div>
        )}
      </div>
      {command.shortcut && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {command.shortcut.split('+').map((key, i) => (
            <kbd
              key={i}
              className="px-1.5 py-0.5 bg-bg-surface border border-border-default rounded text-xs font-mono text-text-muted"
            >
              {key.trim()}
            </kbd>
          ))}
        </div>
      )}
      <span className="text-xs text-text-muted capitalize flex-shrink-0">
        {command.category}
      </span>
    </button>
  );
}

export const CommandItem = memo(CommandItemComponent);

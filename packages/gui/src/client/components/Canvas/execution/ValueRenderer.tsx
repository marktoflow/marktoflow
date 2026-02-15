/**
 * ValueRenderer — Recursive component for rendering typed values in the variable inspector.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function ValueRenderer({
  value,
  onCopy,
  copiedKey,
  path,
  depth = 0,
}: {
  value: unknown;
  onCopy: (key: string, value: unknown) => void;
  copiedKey: string | null;
  path: string;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null) {
    return <span className="text-text-muted font-mono text-xs">null</span>;
  }

  if (value === undefined) {
    return <span className="text-text-muted font-mono text-xs">undefined</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <span className={`font-mono text-xs ${value ? 'text-success' : 'text-error'}`}>
        {String(value)}
      </span>
    );
  }

  if (typeof value === 'number') {
    return <span className="text-warning font-mono text-xs">{value}</span>;
  }

  if (typeof value === 'string') {
    const displayValue = value.length > 200 ? value.substring(0, 200) + '...' : value;
    return (
      <span className="text-success font-mono text-xs">
        &quot;{displayValue}&quot;
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-text-secondary font-mono text-xs">[]</span>;
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="text-xs font-mono">Array({value.length})</span>
        </button>
        {expanded && (
          <div className="ml-4 pl-2 border-l border-border-default space-y-1">
            {value.slice(0, 20).map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-text-muted font-mono text-xs">[{index}]:</span>
                <ValueRenderer value={item} onCopy={onCopy} copiedKey={copiedKey} path={`${path}[${index}]`} depth={depth + 1} />
              </div>
            ))}
            {value.length > 20 && (
              <div className="text-text-muted text-xs">... and {value.length - 20} more items</div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-text-secondary font-mono text-xs">{'{}'}</span>;
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="text-xs font-mono">Object({entries.length} keys)</span>
        </button>
        {expanded && (
          <div className="ml-4 pl-2 border-l border-border-default space-y-1">
            {entries.slice(0, 30).map(([key, val]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-primary font-mono text-xs">{key}:</span>
                <ValueRenderer value={val} onCopy={onCopy} copiedKey={copiedKey} path={`${path}.${key}`} depth={depth + 1} />
              </div>
            ))}
            {entries.length > 30 && (
              <div className="text-text-muted text-xs">... and {entries.length - 30} more keys</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-text-secondary font-mono text-xs">{String(value)}</span>;
}

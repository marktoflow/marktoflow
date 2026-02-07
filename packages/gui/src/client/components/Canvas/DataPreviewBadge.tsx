import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DataPreviewBadgeProps {
  label: string;
  data: unknown;
  variant?: 'input' | 'output';
  className?: string;
}

function DataPreviewBadgeComponent({ label, data, variant = 'output', className }: DataPreviewBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (data === undefined || data === null) return null;

  const preview = getPreview(data);
  const isExpandable = typeof data === 'object';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className={cn('mt-1', className)}>
      <button
        onClick={(e) => { e.stopPropagation(); if (isExpandable) setExpanded(!expanded); }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-xs w-full text-left transition-colors',
          variant === 'input' ? 'bg-blue-500/10 text-blue-400' : 'bg-success/10 text-success'
        )}
      >
        {isExpandable && (
          expanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />
        )}
        <span className="font-medium flex-shrink-0">{label}:</span>
        <span className="truncate font-mono opacity-75">{preview}</span>
        <button
          onClick={handleCopy}
          className="ml-auto flex-shrink-0 p-0.5 rounded hover:bg-white/10"
          title="Copy value"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-50" />}
        </button>
      </button>
      {expanded && isExpandable && (
        <pre className="mt-1 px-2 py-1.5 bg-bg-surface rounded text-xs font-mono text-text-secondary overflow-x-auto max-h-[120px] overflow-y-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function getPreview(data: unknown): string {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  if (typeof data === 'string') return data.length > 40 ? data.slice(0, 40) + '...' : data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);
  if (Array.isArray(data)) return `[${data.length} items]`;
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
  }
  return String(data);
}

export const DataPreviewBadge = memo(DataPreviewBadgeComponent);

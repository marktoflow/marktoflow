import { memo } from 'react';
import { cn } from '../../utils/cn';

interface DiffViewerProps {
  original: string;
  modified: string;
  className?: string;
}

function DiffViewerComponent({ original, modified, className }: DiffViewerProps) {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');

  const origSet = new Set(origLines);
  const modSet = new Set(modLines);

  return (
    <div className={cn('grid grid-cols-2 gap-0 border border-border-default rounded-lg overflow-hidden', className)}>
      <div className="border-r border-border-default">
        <div className="px-3 py-1.5 bg-error/10 text-xs font-medium text-error border-b border-border-default">Original</div>
        <div className="font-mono text-xs overflow-auto max-h-[400px]">
          {origLines.map((line, i) => (
            <div key={i} className={cn('px-3 py-0.5', !modSet.has(line) && 'bg-error/10 text-error')}>
              <span className="text-text-muted mr-2 select-none w-8 inline-block text-right">{i + 1}</span>
              {line}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="px-3 py-1.5 bg-success/10 text-xs font-medium text-success border-b border-border-default">Modified</div>
        <div className="font-mono text-xs overflow-auto max-h-[400px]">
          {modLines.map((line, i) => (
            <div key={i} className={cn('px-3 py-0.5', !origSet.has(line) && 'bg-success/10 text-success')}>
              <span className="text-text-muted mr-2 select-none w-8 inline-block text-right">{i + 1}</span>
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const DiffViewer = memo(DiffViewerComponent);

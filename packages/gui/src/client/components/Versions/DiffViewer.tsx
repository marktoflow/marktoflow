import { memo, useMemo } from 'react';
import { cn } from '../../utils/cn';

interface DiffViewerProps {
  original: string;
  modified: string;
  className?: string;
}

/**
 * Compute which line indices in each file are NOT part of the Longest Common
 * Subsequence. Those are the truly added/removed lines that should be
 * highlighted in the diff view.
 *
 * The previous Set-based approach was incorrect: it checked whether a line
 * existed *anywhere* in the other file, so moved lines and duplicate removals
 * were not flagged as changed. LCS-based diffing correctly handles positional
 * alignment, moves, and duplicate lines.
 */
function computeChangedIndices(
  origLines: string[],
  modLines: string[],
): { changedOrig: Set<number>; changedMod: Set<number> } {
  const m = origLines.length;
  const n = modLines.length;

  // Build LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        origLines[i - 1] === modLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to find which indices are in the LCS alignment
  const lcsOrig = new Set<number>();
  const lcsMod = new Set<number>();
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (origLines[i - 1] === modLines[j - 1]) {
      lcsOrig.add(i - 1);
      lcsMod.add(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Lines NOT in LCS are changed
  const changedOrig = new Set<number>();
  const changedMod = new Set<number>();
  for (let k = 0; k < m; k++) if (!lcsOrig.has(k)) changedOrig.add(k);
  for (let k = 0; k < n; k++) if (!lcsMod.has(k)) changedMod.add(k);

  return { changedOrig, changedMod };
}

function DiffViewerComponent({ original, modified, className }: DiffViewerProps) {
  const origLines = useMemo(() => original.split('\n'), [original]);
  const modLines = useMemo(() => modified.split('\n'), [modified]);

  const { changedOrig, changedMod } = useMemo(
    () => computeChangedIndices(origLines, modLines),
    [origLines, modLines],
  );

  return (
    <div className={cn('grid grid-cols-2 gap-0 border border-border-default rounded-lg overflow-hidden', className)}>
      <div className="border-r border-border-default">
        <div className="px-3 py-1.5 bg-error/10 text-xs font-medium text-error border-b border-border-default">Original</div>
        <div className="font-mono text-xs overflow-auto max-h-[400px]">
          {origLines.map((line, idx) => (
            <div key={idx} className={cn('px-3 py-0.5', changedOrig.has(idx) && 'bg-error/10 text-error')}>
              <span className="text-text-muted mr-2 select-none w-8 inline-block text-right">{idx + 1}</span>
              {line}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="px-3 py-1.5 bg-success/10 text-xs font-medium text-success border-b border-border-default">Modified</div>
        <div className="font-mono text-xs overflow-auto max-h-[400px]">
          {modLines.map((line, idx) => (
            <div key={idx} className={cn('px-3 py-0.5', changedMod.has(idx) && 'bg-success/10 text-success')}>
              <span className="text-text-muted mr-2 select-none w-8 inline-block text-right">{idx + 1}</span>
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const DiffViewer = memo(DiffViewerComponent);

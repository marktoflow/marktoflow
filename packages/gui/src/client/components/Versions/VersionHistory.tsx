import { memo, useEffect, useState, useCallback } from 'react';
import { History, RotateCcw, GitCompare, Clock, User, Tag, Eye } from 'lucide-react';
import { useVersionStore } from '../../stores/versionStore';
import { Button } from '../common/Button';
import { DiffViewer } from './DiffViewer';
import { cn } from '../../utils/cn';

interface VersionHistoryProps {
  workflowPath: string | null;
  onRestore?: (content: string) => void;
}

function VersionHistoryComponent({ workflowPath, onRestore }: VersionHistoryProps) {
  const {
    versions, isLoading, compareMode, selectedVersions,
    loadVersions, restoreVersion, getVersionContent, setCompareMode, selectForCompare,
  } = useVersionStore();

  const [diffContents, setDiffContents] = useState<{ a: string; b: string } | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);

  useEffect(() => {
    if (workflowPath) loadVersions(workflowPath);
  }, [workflowPath, loadVersions]);

  // Clear diff when compare mode is toggled off
  useEffect(() => {
    if (!compareMode) setDiffContents(null);
  }, [compareMode]);

  const handleRestore = async (versionId: string) => {
    if (!workflowPath) return;
    const content = await restoreVersion(workflowPath, versionId);
    if (content && onRestore) onRestore(content);
  };

  const handleViewDiff = useCallback(async () => {
    if (!workflowPath || !selectedVersions[0] || !selectedVersions[1]) return;
    setIsDiffLoading(true);
    const [a, b] = await Promise.all([
      getVersionContent(workflowPath, selectedVersions[0]),
      getVersionContent(workflowPath, selectedVersions[1]),
    ]);
    setIsDiffLoading(false);
    if (a !== null && b !== null) setDiffContents({ a, b });
  }, [workflowPath, selectedVersions, getVersionContent]);

  const bothSelected = selectedVersions[0] !== null && selectedVersions[1] !== null;

  if (!workflowPath) {
    return <div className="p-4 text-sm text-text-muted text-center">Select a workflow to view versions</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border-default">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <History className="w-4 h-4" />
          Version History
        </h3>
        <Button variant={compareMode ? 'primary' : 'secondary'} size="sm" onClick={() => setCompareMode(!compareMode)}>
          <GitCompare className="w-3.5 h-3.5 mr-1" />
          Compare
        </Button>
      </div>

      {/* Compare mode status bar + View Diff button */}
      {compareMode && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border-b border-border-default text-xs text-text-secondary">
          <span>
            {bothSelected
              ? 'Two versions selected — ready to diff'
              : `Select ${selectedVersions[0] ? '1 more' : '2'} version${selectedVersions[0] ? '' : 's'} to compare`}
          </span>
          {bothSelected && (
            <button
              onClick={handleViewDiff}
              disabled={isDiffLoading}
              className="flex items-center gap-1 px-2 py-1 rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Eye className="w-3 h-3" />
              {isDiffLoading ? 'Loading…' : 'View Diff'}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-text-muted">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-sm text-text-muted">No versions saved yet</div>
        ) : (
          versions.map((version) => (
            <div key={version.id} className={cn(
              'p-3 rounded-lg border transition-colors',
              compareMode && selectedVersions.includes(version.id)
                ? 'border-primary bg-primary/10'
                : 'border-border-default bg-bg-surface hover:border-border-default/80'
            )}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-primary" />
                  v{version.version}
                </span>
                <span className="text-xs text-text-muted font-mono">{version.hash}</span>
              </div>
              <div className="text-xs text-text-secondary mb-2">{version.message}</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{version.author}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(version.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex gap-1">
                  {compareMode ? (
                    <button
                      onClick={() => selectForCompare(version.id)}
                      className={cn(
                        'px-2 py-1 text-xs rounded hover:text-text-primary',
                        selectedVersions.includes(version.id)
                          ? 'bg-primary/20 text-primary'
                          : 'bg-bg-hover text-text-secondary',
                      )}
                    >
                      {selectedVersions.includes(version.id) ? '✓ Selected' : 'Select'}
                    </button>
                  ) : (
                    <button onClick={() => handleRestore(version.id)} className="px-2 py-1 text-xs rounded bg-bg-hover text-text-secondary hover:text-text-primary flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                  )}
                </div>
              </div>
              {version.isAutoSave && <span className="mt-1 inline-block text-xs text-text-muted bg-bg-hover px-1.5 py-0.5 rounded">auto</span>}
            </div>
          ))
        )}
      </div>

      {/* Diff viewer — shown once View Diff is clicked with two versions selected */}
      {diffContents && (
        <div className="border-t border-border-default p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Diff</span>
            <button
              onClick={() => setDiffContents(null)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Close
            </button>
          </div>
          <DiffViewer original={diffContents.a} modified={diffContents.b} />
        </div>
      )}
    </div>
  );
}

export const VersionHistory = memo(VersionHistoryComponent);

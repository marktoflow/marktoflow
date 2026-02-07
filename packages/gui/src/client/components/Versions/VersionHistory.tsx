import { memo, useEffect } from 'react';
import { History, RotateCcw, GitCompare, Clock, User, Tag } from 'lucide-react';
import { useVersionStore } from '../../stores/versionStore';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';

interface VersionHistoryProps {
  workflowPath: string | null;
  onRestore?: (content: string) => void;
}

function VersionHistoryComponent({ workflowPath, onRestore }: VersionHistoryProps) {
  const { versions, isLoading, compareMode, selectedVersions, loadVersions, restoreVersion, setCompareMode, selectForCompare } = useVersionStore();

  useEffect(() => {
    if (workflowPath) loadVersions(workflowPath);
  }, [workflowPath, loadVersions]);

  const handleRestore = async (versionId: string) => {
    if (!workflowPath) return;
    const content = await restoreVersion(workflowPath, versionId);
    if (content && onRestore) onRestore(content);
  };

  if (!workflowPath) {
    return <div className="p-4 text-sm text-text-muted text-center">Select a workflow to view versions</div>;
  }

  return (
    <div className="flex flex-col h-full">
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
                    <button onClick={() => selectForCompare(version.id)} className="px-2 py-1 text-xs rounded bg-bg-hover text-text-secondary hover:text-text-primary">
                      Select
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
    </div>
  );
}

export const VersionHistory = memo(VersionHistoryComponent);

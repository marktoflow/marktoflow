import { memo, useEffect } from 'react';
import { FileSearch, Download, Shield, Clock } from 'lucide-react';
import { useGovernanceStore } from '../../stores/governanceStore';

function AuditViewerComponent() {
  const { auditEntries, loadAudit } = useGovernanceStore();

  useEffect(() => { loadAudit(); }, [loadAudit]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <FileSearch className="w-4 h-4" /> Audit Log
        </h3>
        <button className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary" title="Export audit log">
          <Download className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1">
        {auditEntries.length === 0 ? (
          <div className="text-center py-8 text-sm text-text-muted">No audit entries</div>
        ) : (
          auditEntries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border-default last:border-0">
              <Shield className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary">{entry.details}</div>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span>{entry.userId}</span>
                  <span className="px-1.5 py-0.5 bg-bg-hover rounded">{entry.action}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const AuditViewer = memo(AuditViewerComponent);

/**
 * LogsViewer — Displays execution logs.
 */

export function LogsViewer({ logs }: { logs: string[] }) {
  return (
    <div className="font-mono text-xs space-y-1">
      {logs.length === 0 ? (
        <div className="text-text-muted">No logs yet...</div>
      ) : (
        logs.map((log, index) => (
          <div key={index} className="text-text-primary">
            {log}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * DebugPanel — Debug state display with breakpoints, call stack, and watch expressions.
 */

import { useState } from 'react';
import { Circle, ArrowRight, Trash2, Plus, X } from 'lucide-react';
import type { DebugState } from '../../../stores/executionStore';

export function DebugPanel({
  debug,
  onClearBreakpoints,
  onAddWatchExpression,
  onRemoveWatchExpression,
}: {
  debug: DebugState;
  onClearBreakpoints?: () => void;
  onAddWatchExpression?: (expression: string) => void;
  onRemoveWatchExpression?: (expression: string) => void;
}) {
  const [newWatchExpr, setNewWatchExpr] = useState('');

  const handleAddWatch = () => {
    if (newWatchExpr.trim() && onAddWatchExpression) {
      onAddWatchExpression(newWatchExpr.trim());
      setNewWatchExpr('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Breakpoints */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <Circle className="w-3 h-3 text-error" />
            Breakpoints ({debug.breakpoints.size})
          </h4>
          {debug.breakpoints.size > 0 && onClearBreakpoints && (
            <button onClick={onClearBreakpoints} className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
        <div className="bg-bg-surface rounded-lg p-3">
          {debug.breakpoints.size === 0 ? (
            <div className="text-xs text-text-muted">No breakpoints set. Click the dot next to a step to add one.</div>
          ) : (
            <div className="space-y-1">
              {Array.from(debug.breakpoints).map((stepId) => (
                <div key={stepId} className="flex items-center gap-2 text-xs text-text-primary">
                  <Circle className="w-2 h-2 fill-current text-error" />
                  <span className="font-mono">{stepId}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Call Stack */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-text-primary">Call Stack</h4>
        <div className="bg-bg-surface rounded-lg p-3">
          {debug.callStack.length === 0 ? (
            <div className="text-xs text-text-muted">No active call stack</div>
          ) : (
            <div className="space-y-1">
              {debug.callStack.map((frame, index) => (
                <div key={index} className={`flex items-center gap-2 text-xs ${index === 0 ? 'text-primary' : 'text-text-secondary'}`}>
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-mono">{frame}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Watch Expressions */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-text-primary">Watch Expressions</h4>
        <div className="bg-bg-surface rounded-lg p-3 space-y-2">
          {onAddWatchExpression && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newWatchExpr}
                onChange={(e) => setNewWatchExpr(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatch()}
                placeholder="Add expression..."
                className="flex-1 bg-transparent border border-border-default rounded px-2 py-1 text-xs text-text-primary placeholder-gray-500 focus:outline-none focus:border-primary"
              />
              <button onClick={handleAddWatch} disabled={!newWatchExpr.trim()} className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-50">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
          {debug.watchExpressions.length === 0 ? (
            <div className="text-xs text-text-muted">No watch expressions. Add an expression to monitor its value.</div>
          ) : (
            <div className="space-y-1">
              {debug.watchExpressions.map((expr) => (
                <div key={expr} className="flex items-center justify-between gap-2 text-xs group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-primary font-mono truncate">{expr}</span>
                    <span className="text-text-muted">=</span>
                    <span className="text-text-primary font-mono truncate">(not evaluated)</span>
                  </div>
                  {onRemoveWatchExpression && (
                    <button onClick={() => onRemoveWatchExpression(expr)} className="p-1 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Debug State */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-text-primary">Debug State</h4>
        <div className="bg-bg-surface rounded-lg p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Current Step:</span>
            <span className="text-text-primary font-mono">{debug.currentStepId || '(none)'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Paused at Breakpoint:</span>
            <span className={debug.pausedAtBreakpoint ? 'text-error' : 'text-text-muted'}>{debug.pausedAtBreakpoint ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Step Over Pending:</span>
            <span className={debug.stepOverPending ? 'text-warning' : 'text-text-muted'}>{debug.stepOverPending ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

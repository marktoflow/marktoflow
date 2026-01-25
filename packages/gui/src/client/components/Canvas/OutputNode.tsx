import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Flag, CheckCircle, XCircle, Clock } from 'lucide-react';

export interface OutputNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  description?: string;
  variables?: string[];
  status?: 'pending' | 'completed' | 'failed';
  result?: unknown;
}

export type OutputNodeType = Node<OutputNodeData, 'output'>;

function OutputNodeComponent({ data, selected }: NodeProps<OutputNodeType>) {
  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-gray-400',
      borderColor: 'border-gray-500',
      bgColor: 'bg-gray-500/10',
    },
    completed: {
      icon: CheckCircle,
      color: 'text-success',
      borderColor: 'border-success',
      bgColor: 'bg-success/10',
    },
    failed: {
      icon: XCircle,
      color: 'text-error',
      borderColor: 'border-error',
      bgColor: 'bg-error/10',
    },
  };

  const status = data.status || 'pending';
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 ${config.borderColor} ${config.bgColor} ${
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-canvas-bg' : ''
      } transition-all duration-200`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg"
      />

      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
          <Flag className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Output
          </div>
          <div className="text-sm font-medium text-white truncate">
            {data.name || 'Workflow End'}
          </div>
        </div>
        <StatusIcon className={`w-4 h-4 ${config.color}`} />
      </div>

      {/* Variables */}
      {data.variables && data.variables.length > 0 && (
        <div className="px-3 py-2 border-t border-white/10">
          <div className="text-xs text-gray-500 mb-1">Output Variables</div>
          <div className="flex flex-wrap gap-1">
            {data.variables.map((variable) => (
              <code
                key={variable}
                className="px-1.5 py-0.5 bg-white/5 text-primary text-xs rounded"
              >
                {variable}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {data.description && (
        <div className="px-3 py-2 border-t border-white/10">
          <div className="text-xs text-gray-400">{data.description}</div>
        </div>
      )}

      {/* Result preview */}
      {status === 'completed' && data.result !== undefined && (
        <div className="px-3 py-2 border-t border-white/10">
          <div className="text-xs text-gray-500 mb-1">Result</div>
          <pre className="text-xs text-success font-mono bg-black/20 rounded p-1.5 overflow-x-auto max-h-20">
            {typeof data.result === 'string'
              ? data.result.slice(0, 100)
              : JSON.stringify(data.result, null, 2).slice(0, 100)}
            {(typeof data.result === 'string' ? data.result : JSON.stringify(data.result)).length > 100 && '...'}
          </pre>
        </div>
      )}
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);

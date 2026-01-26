import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  ArrowRight,
  Filter,
  Minimize2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

export interface TransformNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  transformType: 'map' | 'filter' | 'reduce';
  items: string;
  itemVariable?: string;
  expression?: string;
  condition?: string;
  accumulatorVariable?: string;
  initialValue?: unknown;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  inputCount?: number;
  outputCount?: number;
}

export type TransformNodeType = Node<TransformNodeData, 'map' | 'filter' | 'reduce'>;

function TransformNodeComponent({ data, selected }: NodeProps<TransformNodeType>) {
  const transformConfig: Record<
    NonNullable<TransformNodeData['transformType']>,
    { icon: typeof ArrowRight; label: string; color: string }
  > = {
    map: { icon: ArrowRight, label: 'Map', color: '#14b8a6' },
    filter: { icon: Filter, label: 'Filter', color: '#10b981' },
    reduce: { icon: Minimize2, label: 'Reduce', color: '#06b6d4' },
  };

  const statusConfig: Record<
    NonNullable<TransformNodeData['status']>,
    { icon: typeof Clock; color: string; bgColor: string; animate?: boolean }
  > = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10' },
    running: {
      icon: transformConfig[data.transformType].icon,
      color: 'text-teal-400',
      bgColor: 'bg-teal-400/10',
      animate: true,
    },
    completed: {
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    failed: { icon: XCircle, color: 'text-error', bgColor: 'bg-error/10' },
    skipped: {
      icon: XCircle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
    },
  };

  const status = data.status || 'pending';
  const statusCfg = statusConfig[status];
  const StatusIcon = statusCfg.icon;

  const transformCfg = transformConfig[data.transformType];
  const TransformIcon = transformCfg.icon;

  const displayExpression =
    data.transformType === 'filter'
      ? data.condition
      : data.transformType === 'reduce'
        ? `${data.accumulatorVariable || 'acc'}: ${data.expression || 'Not set'}`
        : data.expression;

  return (
    <div
      className={`control-flow-node transform-node p-0 ${selected ? 'selected' : ''} ${status === 'running' ? 'running' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-node-bg"
      />

      {/* Node header */}
      <div className="flex items-center gap-3 p-3 border-b border-white/20">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <TransformIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">
            {data.name || transformCfg.label}
          </div>
          <div className="text-xs text-white/70">Transform</div>
        </div>
        <div
          className={`w-6 h-6 rounded-full ${statusCfg.bgColor} flex items-center justify-center`}
        >
          <StatusIcon
            className={`w-4 h-4 ${statusCfg.color} ${statusCfg.animate ? 'animate-pulse' : ''}`}
          />
        </div>
      </div>

      {/* Node body */}
      <div className="p-3 bg-white/10">
        {/* Items source */}
        <div className="text-xs text-white/90 mb-2">
          <span className="text-white/60">Items:</span>{' '}
          <span className="font-mono">{data.items || 'Not set'}</span>
        </div>

        {/* Variable */}
        <div className="text-xs text-white/90 mb-3">
          <span className="text-white/60">Variable:</span>{' '}
          <span className="font-mono">{data.itemVariable || 'item'}</span>
        </div>

        {/* Expression/Condition */}
        <div className="mb-3 p-2 bg-white/5 rounded">
          <div className="text-xs text-white/60 mb-1">
            {data.transformType === 'filter'
              ? 'Condition'
              : data.transformType === 'reduce'
                ? 'Reducer'
                : 'Expression'}
          </div>
          <div className="text-xs text-white font-mono break-all">
            {displayExpression || 'Not set'}
          </div>
        </div>

        {/* Initial value for reduce */}
        {data.transformType === 'reduce' && data.initialValue !== undefined && (
          <div className="text-xs text-white/90 mb-3">
            <span className="text-white/60">Initial:</span>{' '}
            <span className="font-mono">{JSON.stringify(data.initialValue)}</span>
          </div>
        )}

        {/* Input/Output count */}
        {(data.inputCount !== undefined || data.outputCount !== undefined) && (
          <div className="mt-3 p-2 bg-white/5 rounded flex items-center justify-between">
            <div className="text-xs">
              <span className="text-white/60">In:</span>{' '}
              <span className="text-white font-medium">{data.inputCount ?? '?'}</span>
            </div>
            <div className="text-white/40">→</div>
            <div className="text-xs">
              <span className="text-white/60">Out:</span>{' '}
              <span className="text-white font-medium">{data.outputCount ?? '?'}</span>
            </div>
          </div>
        )}

        {/* Transform type indicator */}
        <div className="mt-3 text-xs text-white/50 flex items-center gap-2">
          <span>ℹ️</span>
          <span>
            {data.transformType === 'map'
              ? 'Transforms each item'
              : data.transformType === 'filter'
                ? 'Selects matching items'
                : 'Aggregates to single value'}
          </span>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-node-bg"
      />
    </div>
  );
}

export const TransformNode = memo(TransformNodeComponent);

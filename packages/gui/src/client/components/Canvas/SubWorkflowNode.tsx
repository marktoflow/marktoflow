import { memo, useState, useCallback } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigationStore';
import { useWorkflowStore } from '../../stores/workflowStore';

export interface SubWorkflowNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  workflowPath: string;
  stepCount?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

export type SubWorkflowNodeType = Node<SubWorkflowNodeData, 'subworkflow'>;

function SubWorkflowNodeComponent({
  data,
  selected,
}: NodeProps<SubWorkflowNodeType>) {
  const [expanded, setExpanded] = useState(false);
  const { pushWorkflow, breadcrumbs, setRootWorkflow } = useNavigationStore();
  const { loadWorkflow, selectedWorkflow, currentWorkflow } = useWorkflowStore();

  // Handle drilling down into sub-workflow
  const handleDrillDown = useCallback(() => {
    // If this is the first navigation, set the current workflow as root
    if (breadcrumbs.length === 0 && selectedWorkflow && currentWorkflow) {
      setRootWorkflow({
        id: selectedWorkflow,
        name: currentWorkflow.metadata?.name || 'Main Workflow',
        path: selectedWorkflow,
      });
    }

    // Push the sub-workflow onto the navigation stack
    pushWorkflow({
      id: data.id,
      name: data.name || data.id,
      path: data.workflowPath,
    });

    // Load the sub-workflow
    loadWorkflow(data.workflowPath);
  }, [data, pushWorkflow, breadcrumbs, setRootWorkflow, selectedWorkflow, currentWorkflow, loadWorkflow]);

  const statusColors = {
    pending: 'border-node-border',
    running: 'border-warning',
    completed: 'border-success',
    failed: 'border-error',
  };

  const status = data.status || 'pending';

  return (
    <div
      className={`step-node p-0 min-w-[250px] ${selected ? 'selected' : ''} ${statusColors[status]}`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-info !border-2 !border-node-bg"
      />

      {/* Node header */}
      <div className="flex items-center gap-3 p-3 border-b border-node-border bg-info/5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-info" />
          ) : (
            <ChevronRight className="w-4 h-4 text-info" />
          )}
        </button>
        <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
          <FolderOpen className="w-5 h-5 text-info" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {data.name || data.id}
          </div>
          <div className="text-xs text-gray-400">Sub-workflow</div>
        </div>
        <button
          onClick={handleDrillDown}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-info/20 transition-colors"
          title="Drill into sub-workflow"
        >
          <ArrowRight className="w-4 h-4 text-info" />
        </button>
      </div>

      {/* Node body */}
      <div className="p-3">
        <div className="text-xs text-gray-400 font-mono truncate">
          {data.workflowPath}
        </div>
        {data.stepCount !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-info/10 text-info">
              {data.stepCount} steps
            </span>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-node-border p-3 bg-black/20">
          <button
            onClick={handleDrillDown}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-info/10 hover:bg-info/20 rounded text-sm text-info transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Open Sub-workflow
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-info !border-2 !border-node-bg"
      />
    </div>
  );
}

export const SubWorkflowNode = memo(SubWorkflowNodeComponent);

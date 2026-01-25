import { useState } from 'react';
import {
  Settings,
  Variable,
  History,
  X,
  ChevronRight,
} from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useWorkflowStore } from '../../stores/workflowStore';

type TabId = 'properties' | 'variables' | 'history';

export function PropertiesPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('properties');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedNodes = useCanvasStore((s) => s.nodes.filter((n) => n.selected));
  const workflow = useWorkflowStore((s) => s.currentWorkflow);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="w-10 bg-panel-bg border-l border-node-border flex flex-col items-center py-4 gap-4"
      >
        <ChevronRight className="w-4 h-4 text-gray-400 rotate-180" />
        <Settings className="w-5 h-5 text-gray-400" />
      </button>
    );
  }

  return (
    <div className="w-80 bg-panel-bg border-l border-node-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-node-border">
        <h2 className="text-sm font-medium text-white">Properties</h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-node-border">
        <TabButton
          active={activeTab === 'properties'}
          onClick={() => setActiveTab('properties')}
          icon={<Settings className="w-4 h-4" />}
          label="Properties"
        />
        <TabButton
          active={activeTab === 'variables'}
          onClick={() => setActiveTab('variables')}
          icon={<Variable className="w-4 h-4" />}
          label="Variables"
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          icon={<History className="w-4 h-4" />}
          label="History"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'properties' && (
          <PropertiesTab selectedNodes={selectedNodes} workflow={workflow} />
        )}
        {activeTab === 'variables' && <VariablesTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
        active
          ? 'text-primary border-b-2 border-primary -mb-px'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface PropertiesTabProps {
  selectedNodes: any[];
  workflow: any;
}

function PropertiesTab({ selectedNodes, workflow }: PropertiesTabProps) {
  if (selectedNodes.length === 0) {
    // Show workflow properties
    return (
      <div className="p-4 space-y-4">
        <Section title="Workflow">
          {workflow ? (
            <div className="space-y-3">
              <Property label="Name" value={workflow.metadata?.name || 'Untitled'} />
              <Property label="Version" value={workflow.metadata?.version || '1.0.0'} />
              <Property label="Author" value={workflow.metadata?.author || 'Unknown'} />
              <Property
                label="Steps"
                value={`${workflow.steps?.length || 0} steps`}
              />
            </div>
          ) : (
            <div className="text-sm text-gray-500">No workflow loaded</div>
          )}
        </Section>

        {workflow?.metadata?.description && (
          <Section title="Description">
            <p className="text-sm text-gray-300">
              {workflow.metadata.description}
            </p>
          </Section>
        )}

        {workflow?.metadata?.tags && workflow.metadata.tags.length > 0 && (
          <Section title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {workflow.metadata.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  if (selectedNodes.length === 1) {
    const node = selectedNodes[0];
    return (
      <div className="p-4 space-y-4">
        <Section title="Step">
          <div className="space-y-3">
            <Property label="ID" value={node.data?.id || node.id} />
            <Property label="Name" value={node.data?.name || '(unnamed)'} />
            <Property label="Action" value={node.data?.action || node.data?.workflowPath || '-'} />
            <Property
              label="Status"
              value={node.data?.status || 'pending'}
              badge
              badgeColor={
                node.data?.status === 'completed'
                  ? 'success'
                  : node.data?.status === 'failed'
                    ? 'error'
                    : node.data?.status === 'running'
                      ? 'warning'
                      : 'default'
              }
            />
          </div>
        </Section>

        {node.data?.error && (
          <Section title="Error">
            <div className="p-2 bg-error/10 border border-error/20 rounded text-xs text-error font-mono">
              {node.data.error}
            </div>
          </Section>
        )}

        <Section title="Actions">
          <div className="flex gap-2">
            <button className="flex-1 px-3 py-1.5 bg-node-bg border border-node-border rounded text-xs text-gray-300 hover:border-primary transition-colors">
              Edit
            </button>
            <button className="flex-1 px-3 py-1.5 bg-node-bg border border-node-border rounded text-xs text-gray-300 hover:border-primary transition-colors">
              View YAML
            </button>
          </div>
        </Section>
      </div>
    );
  }

  // Multiple nodes selected
  return (
    <div className="p-4">
      <div className="text-sm text-gray-400">
        {selectedNodes.length} nodes selected
      </div>
    </div>
  );
}

function VariablesTab() {
  const variables = [
    { name: 'inputs.repo', value: 'owner/repo', type: 'string' },
    { name: 'inputs.pr_number', value: '123', type: 'number' },
    { name: 'pr_details.title', value: 'Fix bug', type: 'string' },
    { name: 'pr_details.state', value: 'open', type: 'string' },
  ];

  return (
    <div className="p-4 space-y-2">
      {variables.map((variable) => (
        <div
          key={variable.name}
          className="p-3 bg-node-bg rounded-lg border border-node-border"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono text-primary">
              {variable.name}
            </span>
            <span className="text-xs text-gray-500">{variable.type}</span>
          </div>
          <div className="text-sm text-gray-300 font-mono truncate">
            {variable.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTab() {
  const runs = [
    { id: '1', status: 'completed', duration: '2.3s', time: '2 min ago' },
    { id: '2', status: 'failed', duration: '1.1s', time: '5 min ago' },
    { id: '3', status: 'completed', duration: '3.5s', time: '1 hour ago' },
  ];

  return (
    <div className="p-4 space-y-2">
      {runs.map((run) => (
        <div
          key={run.id}
          className="p-3 bg-node-bg rounded-lg border border-node-border cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-white">Run #{run.id}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                run.status === 'completed'
                  ? 'bg-success/10 text-success'
                  : 'bg-error/10 text-error'
              }`}
            >
              {run.status}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{run.duration}</span>
            <span>{run.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface PropertyProps {
  label: string;
  value: string;
  badge?: boolean;
  badgeColor?: 'default' | 'success' | 'error' | 'warning';
}

function Property({
  label,
  value,
  badge,
  badgeColor = 'default',
}: PropertyProps) {
  const colors = {
    default: 'bg-gray-500/10 text-gray-400',
    success: 'bg-success/10 text-success',
    error: 'bg-error/10 text-error',
    warning: 'bg-warning/10 text-warning',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      {badge ? (
        <span className={`text-xs px-2 py-0.5 rounded-full ${colors[badgeColor]}`}>
          {value}
        </span>
      ) : (
        <span className="text-sm text-gray-200 font-mono truncate max-w-[180px]">
          {value}
        </span>
      )}
    </div>
  );
}

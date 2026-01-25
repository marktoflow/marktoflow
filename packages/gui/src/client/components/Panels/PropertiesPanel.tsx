import { useState } from 'react';
import {
  Settings,
  Variable,
  History,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Play,
} from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useLayoutStore } from '../../stores/layoutStore';
import {
  useExecutionStore,
  formatDuration,
  formatRelativeTime,
  type ExecutionRun,
} from '../../stores/executionStore';

type TabId = 'properties' | 'variables' | 'history';

export function PropertiesPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('properties');
  const selectedNodes = useCanvasStore((s) => s.nodes.filter((n) => n.selected));
  const workflow = useWorkflowStore((s) => s.currentWorkflow);
  const { propertiesPanelOpen, setPropertiesPanelOpen, breakpoint } = useLayoutStore();

  // On mobile, show as an overlay when open
  if (breakpoint === 'mobile') {
    if (!propertiesPanelOpen) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setPropertiesPanelOpen(false)}
        />
        {/* Panel */}
        <div className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-panel-bg border-l border-node-border flex flex-col z-50 animate-slide-in-right">
          <PropertiesPanelContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedNodes={selectedNodes}
            workflow={workflow}
            onClose={() => setPropertiesPanelOpen(false)}
            showClose
          />
        </div>
      </>
    );
  }

  // Desktop/Tablet: collapsed state
  if (!propertiesPanelOpen) {
    return (
      <button
        onClick={() => setPropertiesPanelOpen(true)}
        className="w-10 bg-panel-bg border-l border-node-border flex flex-col items-center py-4 gap-4 hover:bg-white/5 transition-colors"
        aria-label="Expand properties panel"
      >
        <ChevronLeft className="w-4 h-4 text-gray-400" />
        <Settings className="w-5 h-5 text-gray-400" />
      </button>
    );
  }

  return (
    <div className="w-80 bg-panel-bg border-l border-node-border flex flex-col">
      <PropertiesPanelContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedNodes={selectedNodes}
        workflow={workflow}
        onClose={() => setPropertiesPanelOpen(false)}
        showClose={breakpoint === 'tablet'}
      />
    </div>
  );
}

interface PropertiesPanelContentProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedNodes: any[];
  workflow: any;
  onClose: () => void;
  showClose?: boolean;
}

function PropertiesPanelContent({
  activeTab,
  setActiveTab,
  selectedNodes,
  workflow,
  onClose,
  showClose,
}: PropertiesPanelContentProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-node-border">
        <h2 className="text-sm font-medium text-white">Properties</h2>
        {showClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label="Close properties panel"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
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
    </>
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
  const { runs, clearHistory } = useExecutionStore();
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null);

  if (selectedRun) {
    return <RunDetailView run={selectedRun} onBack={() => setSelectedRun(null)} />;
  }

  if (runs.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-node-bg flex items-center justify-center">
          <History className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-400 mb-1">No execution history</p>
        <p className="text-xs text-gray-500">
          Run a workflow to see execution history here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {runs.map((run) => (
          <button
            key={run.id}
            onClick={() => setSelectedRun(run)}
            className="w-full p-3 bg-node-bg rounded-lg border border-node-border cursor-pointer hover:border-primary transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white truncate max-w-[140px]">
                {run.workflowName}
              </span>
              <RunStatusBadge status={run.status} />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{run.duration ? formatDuration(run.duration) : '-'}</span>
              <span>{formatRelativeTime(run.startTime)}</span>
            </div>
            {run.steps.length > 0 && (
              <div className="mt-2 flex items-center gap-1">
                {run.steps.slice(0, 5).map((step) => (
                  <StepStatusDot key={step.stepId} status={step.status} />
                ))}
                {run.steps.length > 5 && (
                  <span className="text-xs text-gray-500">+{run.steps.length - 5}</span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
      {runs.length > 0 && (
        <div className="p-3 border-t border-node-border">
          <button
            onClick={clearHistory}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-error transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

interface RunDetailViewProps {
  run: ExecutionRun;
  onBack: () => void;
}

function RunDetailView({ run, onBack }: RunDetailViewProps) {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-node-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white mb-2"
        >
          <ChevronRight className="w-3 h-3 rotate-180" />
          Back to history
        </button>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white truncate max-w-[180px]">
            {run.workflowName}
          </span>
          <RunStatusBadge status={run.status} />
        </div>
        <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
          <span>{run.duration ? formatDuration(run.duration) : 'Running...'}</span>
          <span>{new Date(run.startTime).toLocaleString()}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-node-border">
        <button
          onClick={() => setShowLogs(false)}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            !showLogs
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Steps ({run.steps.length})
        </button>
        <button
          onClick={() => setShowLogs(true)}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            showLogs
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Logs ({run.logs.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {showLogs ? (
          <div className="space-y-1 font-mono text-xs">
            {run.logs.map((log, i) => (
              <div key={i} className="text-gray-300 break-words">
                {log}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {run.steps.map((step) => (
              <div
                key={step.stepId}
                className="p-2 bg-node-bg rounded border border-node-border"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white truncate">
                    {step.stepName}
                  </span>
                  <StepStatusBadge status={step.status} />
                </div>
                {step.duration && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDuration(step.duration)}
                  </div>
                )}
                {step.error && (
                  <div className="mt-2 p-2 bg-error/10 border border-error/20 rounded text-xs text-error">
                    {step.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: ExecutionRun['status'] }) {
  const config = {
    running: { bg: 'bg-warning/10', text: 'text-warning', icon: Loader2 },
    completed: { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle },
    failed: { bg: 'bg-error/10', text: 'text-error', icon: XCircle },
    cancelled: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: XCircle },
    pending: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: Clock },
  };

  const { bg, text, icon: Icon } = config[status] || config.pending;

  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${bg} ${text}`}>
      <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status}
    </span>
  );
}

function StepStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    running: { bg: 'bg-warning/10', text: 'text-warning' },
    completed: { bg: 'bg-success/10', text: 'text-success' },
    failed: { bg: 'bg-error/10', text: 'text-error' },
    pending: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
  };

  const { bg, text } = config[status] || config.pending;

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${bg} ${text}`}>
      {status}
    </span>
  );
}

function StepStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-warning',
    completed: 'bg-success',
    failed: 'bg-error',
    pending: 'bg-gray-500',
  };

  return (
    <div
      className={`w-2 h-2 rounded-full ${colors[status] || colors.pending} ${
        status === 'running' ? 'animate-pulse' : ''
      }`}
      title={status}
    />
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

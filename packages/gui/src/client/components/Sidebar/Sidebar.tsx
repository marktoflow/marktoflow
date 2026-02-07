import { useState, useCallback, useEffect } from 'react';
import {
  FileText,
  FolderTree,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Loader2,
  X,
  Upload,
  Settings2,
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { ImportDialog } from './ImportDialog';
import { NewWorkflowDialog } from './NewWorkflowDialog';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { useSettingsStore } from '../../stores/settingsStore';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'tools'>(
    'workflows'
  );
  const { workflows, selectedWorkflow, selectWorkflow } = useWorkflowStore();
  const { resetNavigation } = useNavigationStore();
  const { sidebarOpen, setSidebarOpen, breakpoint } = useLayoutStore();

  // Handle workflow selection - resets sub-workflow navigation
  const handleSelectWorkflow = useCallback(
    (path: string) => {
      resetNavigation();
      selectWorkflow(path);
      // Close sidebar on mobile after selection
      if (breakpoint === 'mobile') {
        setSidebarOpen(false);
      }
    },
    [resetNavigation, selectWorkflow, breakpoint, setSidebarOpen]
  );

  // Collapsed state for desktop
  if (!sidebarOpen && breakpoint !== 'mobile') {
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="w-12 bg-bg-panel border-r border-border-default flex flex-col items-center py-4 gap-4 hover:bg-bg-hover transition-colors"
        aria-label="Expand sidebar"
      >
        <ChevronRight className="w-4 h-4 text-text-secondary" />
        <FolderTree className="w-5 h-5 text-accent" />
      </button>
    );
  }

  // Mobile overlay
  if (breakpoint === 'mobile') {
    if (!sidebarOpen) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 w-72 bg-bg-panel border-r border-border-default flex flex-col z-50 md:hidden animate-slide-in-left">
          <SidebarContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            workflows={workflows}
            selectedWorkflow={selectedWorkflow}
            onSelectWorkflow={handleSelectWorkflow}
            onClose={() => setSidebarOpen(false)}
            showClose
          />
        </div>
      </>
    );
  }

  // Desktop/Tablet sidebar
  return (
    <div className="w-64 bg-bg-panel border-r border-border-default flex flex-col">
      <SidebarContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        workflows={workflows}
        selectedWorkflow={selectedWorkflow}
        onSelectWorkflow={handleSelectWorkflow}
        onClose={() => setSidebarOpen(false)}
        showClose={breakpoint === 'tablet'}
      />
    </div>
  );
}

interface SidebarContentProps {
  activeTab: 'workflows' | 'tools';
  setActiveTab: (tab: 'workflows' | 'tools') => void;
  workflows: Array<{ path: string; name: string }>;
  selectedWorkflow: string | null;
  onSelectWorkflow: (path: string) => void;
  onClose: () => void;
  showClose?: boolean;
}

function SidebarContent({
  activeTab,
  setActiveTab,
  workflows,
  selectedWorkflow,
  onSelectWorkflow,
  onClose,
  showClose,
}: SidebarContentProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showNewWorkflowDialog, setShowNewWorkflowDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { fetchWorkflows } = useWorkflowStore();

  // Handle creating a new workflow
  const handleCreateWorkflow = useCallback(async (name: string, template: string) => {
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, template }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to create workflow:', error);
        return;
      }

      const result = await response.json();
      console.log('Created workflow:', result);

      // Refresh workflows list and select the new one
      await fetchWorkflows();
      if (result.path) {
        onSelectWorkflow(result.path);
      }
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  }, [fetchWorkflows, onSelectWorkflow]);

  // Filter workflows based on search query
  const filteredWorkflows = workflows.filter((workflow) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      workflow.name.toLowerCase().includes(query) ||
      workflow.path.toLowerCase().includes(query)
    );
  });

  return (
    <>
      {/* Logo/Title */}
      <div className="p-4 border-b border-border-default flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-accent" />
          Marktoflow
        </h1>
        {showClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-bg-hover transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        )}
      </div>

      {/* Tab buttons */}
      <div className="flex border-b border-border-default">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'workflows'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Workflows
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'tools'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Tools
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border-default">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-9 pr-3 py-2 bg-bg-surface border border-border-default rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'workflows' ? (
          <WorkflowList
            workflows={filteredWorkflows}
            selectedWorkflow={selectedWorkflow}
            onSelect={onSelectWorkflow}
            searchQuery={searchQuery}
          />
        ) : (
          <ToolsPalette />
        )}
      </div>

      {/* New workflow and Import buttons */}
      {activeTab === 'workflows' && (
        <div className="p-3 border-t border-border-default space-y-2">
          <button
            onClick={() => setShowNewWorkflowDialog(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-text-inverse rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-surface border border-border-default hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      )}

      {/* Settings button - always visible at bottom */}
      <div className="p-3 border-t border-border-default">
        <button
          onClick={() => useSettingsStore.getState().openSettings()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors text-sm"
          title="Settings (⌘,)"
        >
          <Settings2 className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Import Dialog */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={() => fetchWorkflows()}
      />

      {/* New Workflow Dialog */}
      <NewWorkflowDialog
        open={showNewWorkflowDialog}
        onOpenChange={setShowNewWorkflowDialog}
        onCreate={handleCreateWorkflow}
      />

      {/* Settings Panel */}
      <SettingsPanel />
    </>
  );
}

interface WorkflowListProps {
  workflows: Array<{ path: string; name: string }>;
  selectedWorkflow: string | null;
  onSelect: (path: string) => void;
  searchQuery?: string;
}

function WorkflowList({
  workflows,
  selectedWorkflow,
  onSelect,
  searchQuery = '',
}: WorkflowListProps) {
  if (workflows.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        {searchQuery ? (
          <>
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No workflows match "{searchQuery}"</p>
          </>
        ) : (
          <>
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No workflows found</p>
            <p className="text-xs mt-1 text-text-muted">Create your first workflow to get started</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {workflows.map((workflow) => (
        <button
          key={workflow.path}
          onClick={() => onSelect(workflow.path)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
            selectedWorkflow === workflow.path
              ? 'bg-accent-muted text-accent border border-accent/20'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm truncate">{workflow.name}</span>
          <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0 opacity-50" />
        </button>
      ))}
    </div>
  );
}

export interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  category: string;
  description?: string;
  sdk?: string;
  authType?: string;
  actionCount?: number;
  actions?: string[];
}

// Fallback tools in case API is unavailable
const fallbackTools: ToolDefinition[] = [
  { id: 'slack', name: 'Slack', icon: '💬', category: 'Communication', sdk: '@slack/web-api' },
  { id: 'github', name: 'GitHub', icon: '🐙', category: 'Development', sdk: '@octokit/rest' },
  { id: 'jira', name: 'Jira', icon: '📋', category: 'Project Management', sdk: 'jira.js' },
  { id: 'gmail', name: 'Gmail', icon: '📧', category: 'Communication', sdk: 'googleapis' },
  { id: 'http', name: 'HTTP', icon: '🌐', category: 'Network' },
  { id: 'claude', name: 'Claude', icon: '🤖', category: 'AI' },
];

function ToolsPalette() {
  const [tools, setTools] = useState<ToolDefinition[]>(fallbackTools);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch tools from API
  useEffect(() => {
    async function fetchTools() {
      try {
        const response = await fetch('/api/tools');
        if (response.ok) {
          const data = await response.json();
          setTools(data.tools);
        }
      } catch (error) {
        console.error('Failed to fetch tools:', error);
        // Keep fallback tools
      } finally {
        setLoading(false);
      }
    }
    fetchTools();
  }, []);

  // Filter tools by search query
  const filteredTools = searchQuery
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tools;

  const categories = [...new Set(filteredTools.map((t) => t.category))];

  const handleDragStart = (e: React.DragEvent, tool: ToolDefinition) => {
    e.dataTransfer.setData('application/marktoflow-tool', JSON.stringify(tool));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category}>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mb-2">
            {category}
          </h3>
          <div className="space-y-1">
            {filteredTools
              .filter((t) => t.category === category)
              .map((tool) => (
                <div
                  key={tool.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tool)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 cursor-grab active:cursor-grabbing transition-colors group"
                  title={tool.description || (tool.sdk ? 'SDK: ' + tool.sdk : undefined)}
                >
                  <span className="text-lg">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm block truncate">{tool.name}</span>
                    {tool.actionCount !== undefined && (
                      <span className="text-xs text-gray-500">{tool.actionCount} actions</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {filteredTools.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No tools found
        </div>
      )}
    </div>
  );
}

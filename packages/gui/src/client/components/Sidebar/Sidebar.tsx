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
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useNavigationStore } from '../../stores/navigationStore';
import { useLayoutStore } from '../../stores/layoutStore';

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
        className="w-12 bg-panel-bg border-r border-node-border flex flex-col items-center py-4 gap-4 hover:bg-white/5 transition-colors"
        aria-label="Expand sidebar"
      >
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <FolderTree className="w-5 h-5 text-primary" />
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
        <div className="fixed inset-y-0 left-0 w-72 bg-panel-bg border-r border-node-border flex flex-col z-50 md:hidden animate-slide-in-left">
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
    <div className="w-64 bg-panel-bg border-r border-node-border flex flex-col">
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
  return (
    <>
      {/* Logo/Title */}
      <div className="p-4 border-b border-node-border flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-primary" />
          Marktoflow
        </h1>
        {showClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Tab buttons */}
      <div className="flex border-b border-node-border">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'workflows'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Workflows
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'tools'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Tools
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-node-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-9 pr-3 py-2 bg-node-bg border border-node-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'workflows' ? (
          <WorkflowList
            workflows={workflows}
            selectedWorkflow={selectedWorkflow}
            onSelect={onSelectWorkflow}
          />
        ) : (
          <ToolsPalette />
        )}
      </div>

      {/* New workflow button */}
      {activeTab === 'workflows' && (
        <div className="p-3 border-t border-node-border">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>
      )}
    </>
  );
}

interface WorkflowListProps {
  workflows: Array<{ path: string; name: string }>;
  selectedWorkflow: string | null;
  onSelect: (path: string) => void;
}

function WorkflowList({
  workflows,
  selectedWorkflow,
  onSelect,
}: WorkflowListProps) {
  if (workflows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No workflows found
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
              ? 'bg-primary/10 text-primary'
              : 'text-gray-300 hover:bg-white/5'
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

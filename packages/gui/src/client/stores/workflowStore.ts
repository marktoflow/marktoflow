import { create } from 'zustand';

interface WorkflowMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
}

interface WorkflowStep {
  id: string;
  name?: string;
  action?: string;
  workflow?: string;
  inputs: Record<string, unknown>;
  outputVariable?: string;
  conditions?: string[];
  errorHandling?: {
    action: 'stop' | 'continue' | 'retry';
    maxRetries?: number;
  };
  timeout?: number;
}

interface Workflow {
  metadata: WorkflowMetadata;
  steps: WorkflowStep[];
  tools?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  triggers?: unknown[];
}

interface WorkflowListItem {
  path: string;
  name: string;
}

interface WorkflowState {
  workflows: WorkflowListItem[];
  selectedWorkflow: string | null;
  currentWorkflow: Workflow | null;
  isLoading: boolean;
  error: string | null;

  loadWorkflows: () => Promise<void>;
  selectWorkflow: (path: string) => void;
  loadWorkflow: (path: string) => Promise<void>;
  saveWorkflow: (workflow: Workflow) => Promise<void>;
  createWorkflow: (name: string) => Promise<void>;
  deleteWorkflow: (path: string) => Promise<void>;
}

// Demo workflows for initial state
const demoWorkflows: WorkflowListItem[] = [
  { path: 'examples/code-review/workflow.md', name: 'Code Review' },
  { path: 'examples/daily-standup/workflow.md', name: 'Daily Standup' },
  { path: 'examples/incident-response/workflow.md', name: 'Incident Response' },
  { path: 'examples/sprint-planning/workflow.md', name: 'Sprint Planning' },
  { path: 'examples/dependency-update/workflow.md', name: 'Dependency Update' },
];

const demoWorkflow: Workflow = {
  metadata: {
    id: 'code-review',
    name: 'Code Review',
    version: '1.0.0',
    description: 'Automatically review pull requests using Claude AI',
    author: 'Marktoflow',
    tags: ['github', 'ai', 'code-review'],
  },
  steps: [
    {
      id: 'fetch_pr',
      name: 'Fetch PR Details',
      action: 'github.pulls.get',
      inputs: {
        owner: "{{ inputs.repo.split('/')[0] }}",
        repo: "{{ inputs.repo.split('/')[1] }}",
        pull_number: '{{ inputs.pr_number }}',
      },
      outputVariable: 'pr_details',
    },
    {
      id: 'get_files',
      name: 'Get Changed Files',
      action: 'github.pulls.listFiles',
      inputs: {
        owner: "{{ inputs.repo.split('/')[0] }}",
        repo: "{{ inputs.repo.split('/')[1] }}",
        pull_number: '{{ inputs.pr_number }}',
      },
      outputVariable: 'changed_files',
    },
    {
      id: 'analyze',
      name: 'Analyze Changes',
      action: 'claude.analyze',
      inputs: {
        prompt: 'Review the following code changes',
        context: '{{ changed_files }}',
      },
      outputVariable: 'analysis',
    },
    {
      id: 'post_review',
      name: 'Post Review',
      action: 'github.pulls.createReview',
      inputs: {
        owner: "{{ inputs.repo.split('/')[0] }}",
        repo: "{{ inputs.repo.split('/')[1] }}",
        pull_number: '{{ inputs.pr_number }}',
        body: '{{ analysis.summary }}',
        event: 'COMMENT',
      },
      outputVariable: 'review_result',
    },
  ],
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: demoWorkflows,
  selectedWorkflow: demoWorkflows[0].path,
  currentWorkflow: demoWorkflow,
  isLoading: false,
  error: null,

  loadWorkflows: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/workflows');
      if (!response.ok) throw new Error('Failed to load workflows');
      const data = await response.json();
      set({ workflows: data.workflows, isLoading: false });
    } catch (error) {
      // Use demo data if API fails
      set({ workflows: demoWorkflows, isLoading: false });
    }
  },

  selectWorkflow: (path) => {
    set({ selectedWorkflow: path });
    get().loadWorkflow(path);
  },

  loadWorkflow: async (path) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error('Failed to load workflow');
      const data = await response.json();
      set({ currentWorkflow: data.workflow, isLoading: false });
    } catch (error) {
      // Use demo data if API fails
      set({ currentWorkflow: demoWorkflow, isLoading: false });
    }
  },

  saveWorkflow: async (workflow) => {
    const path = get().selectedWorkflow;
    if (!path) return;

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      });
      if (!response.ok) throw new Error('Failed to save workflow');
      set({ currentWorkflow: workflow, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to save workflow', isLoading: false });
    }
  },

  createWorkflow: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create workflow');
      const data = await response.json();
      const workflows = [...get().workflows, data.workflow];
      set({ workflows, selectedWorkflow: data.workflow.path, isLoading: false });
      get().loadWorkflow(data.workflow.path);
    } catch (error) {
      set({ error: 'Failed to create workflow', isLoading: false });
    }
  },

  deleteWorkflow: async (path) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete workflow');
      const workflows = get().workflows.filter((w) => w.path !== path);
      set({
        workflows,
        selectedWorkflow: workflows[0]?.path || null,
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to delete workflow', isLoading: false });
    }
  },
}));

import { create } from 'zustand';
import { useWorkflowStore } from './workflowStore';
import { useCanvasStore } from './canvasStore';

interface PromptHistoryItem {
  prompt: string;
  response: string;
  timestamp: Date;
  success: boolean;
}

interface PromptState {
  isProcessing: boolean;
  history: PromptHistoryItem[];
  lastError: string | null;
  pendingChanges: any | null;

  sendPrompt: (prompt: string) => Promise<void>;
  acceptChanges: () => void;
  rejectChanges: () => void;
  clearHistory: () => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  isProcessing: false,
  history: [],
  lastError: null,
  pendingChanges: null,

  sendPrompt: async (prompt: string) => {
    set({ isProcessing: true, lastError: null });

    const workflow = useWorkflowStore.getState().currentWorkflow;

    try {
      const response = await fetch('/api/ai/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          workflow,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process prompt');
      }

      const data = await response.json();

      // Add to history
      const historyItem: PromptHistoryItem = {
        prompt,
        response: data.explanation,
        timestamp: new Date(),
        success: true,
      };

      set({
        history: [historyItem, ...get().history].slice(0, 20),
        pendingChanges: data.workflow,
        isProcessing: false,
      });

      // Auto-accept for now (in production, show diff first)
      if (data.workflow) {
        get().acceptChanges();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const historyItem: PromptHistoryItem = {
        prompt,
        response: errorMessage,
        timestamp: new Date(),
        success: false,
      };

      set({
        history: [historyItem, ...get().history].slice(0, 20),
        lastError: errorMessage,
        isProcessing: false,
      });

      // Demo: simulate AI response for testing without backend
      console.log('AI Prompt (demo mode):', prompt);
      console.log('Current workflow:', workflow);
    }
  },

  acceptChanges: () => {
    const pendingChanges = get().pendingChanges;
    if (!pendingChanges) return;

    // Update workflow store
    useWorkflowStore.getState().saveWorkflow(pendingChanges);

    // TODO: Convert workflow to graph and update canvas
    // const { nodes, edges } = workflowToGraph(pendingChanges);
    // useCanvasStore.getState().setNodes(nodes);
    // useCanvasStore.getState().setEdges(edges);

    set({ pendingChanges: null });
  },

  rejectChanges: () => {
    set({ pendingChanges: null });
  },

  clearHistory: () => {
    set({ history: [] });
  },
}));

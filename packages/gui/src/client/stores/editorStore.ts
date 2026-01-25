import { create } from 'zustand';
import type { WorkflowStep } from '@shared/types';

interface EditorState {
  // Currently editing step
  editingStep: WorkflowStep | null;
  isEditorOpen: boolean;

  // YAML viewer
  yamlViewStep: WorkflowStep | null;
  isYamlViewOpen: boolean;

  // New step wizard
  isNewStepOpen: boolean;
  newStepPosition: { afterStepId?: string; beforeStepId?: string } | null;

  // Clipboard
  copiedNodes: WorkflowStep[];

  // Undo/redo stacks
  undoStack: WorkflowStep[][];
  redoStack: WorkflowStep[][];

  // Actions
  openEditor: (step: WorkflowStep) => void;
  closeEditor: () => void;
  openYamlViewer: (step: WorkflowStep) => void;
  closeYamlViewer: () => void;
  openNewStepWizard: (position?: { afterStepId?: string; beforeStepId?: string }) => void;
  closeNewStepWizard: () => void;
  copyNodes: (steps: WorkflowStep[]) => void;
  clearClipboard: () => void;
  pushUndo: (steps: WorkflowStep[]) => void;
  undo: () => WorkflowStep[] | null;
  redo: () => WorkflowStep[] | null;
  clearHistory: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editingStep: null,
  isEditorOpen: false,
  yamlViewStep: null,
  isYamlViewOpen: false,
  isNewStepOpen: false,
  newStepPosition: null,
  copiedNodes: [],
  undoStack: [],
  redoStack: [],

  openEditor: (step) =>
    set({
      editingStep: step,
      isEditorOpen: true,
    }),

  closeEditor: () =>
    set({
      editingStep: null,
      isEditorOpen: false,
    }),

  openYamlViewer: (step) =>
    set({
      yamlViewStep: step,
      isYamlViewOpen: true,
    }),

  closeYamlViewer: () =>
    set({
      yamlViewStep: null,
      isYamlViewOpen: false,
    }),

  openNewStepWizard: (position = null) =>
    set({
      isNewStepOpen: true,
      newStepPosition: position,
    }),

  closeNewStepWizard: () =>
    set({
      isNewStepOpen: false,
      newStepPosition: null,
    }),

  copyNodes: (steps) =>
    set({
      copiedNodes: steps.map((s) => ({ ...s })),
    }),

  clearClipboard: () =>
    set({
      copiedNodes: [],
    }),

  pushUndo: (steps) => {
    const { undoStack } = get();
    set({
      undoStack: [...undoStack, steps],
      redoStack: [], // Clear redo stack when new action is taken
    });
  },

  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return null;

    const lastState = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, lastState],
    });
    return lastState;
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return null;

    const nextState = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, nextState],
    });
    return nextState;
  },

  clearHistory: () =>
    set({
      undoStack: [],
      redoStack: [],
    }),
}));

/**
 * Canvas keyboard shortcut handler extracted from Canvas.tsx.
 *
 * Centralizes all canvas-scoped keyboard shortcuts for maintainability.
 */

import { useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { useWorkflowStore } from '../stores/workflowStore';
import { useCanvas } from './useCanvas';
import type { WorkflowStep } from '@shared/types';
import type { Node } from '@xyflow/react';

const STEP_NODE_TYPES = [
  'step', 'if', 'for_each', 'while', 'switch',
  'parallel', 'try', 'map', 'filter', 'reduce',
];

interface UseCanvasShortcutsOptions {
  onEditStep: (step: WorkflowStep) => void;
  onViewYaml: (step: WorkflowStep) => void;
}

export function useCanvasShortcuts({ onEditStep, onViewYaml }: UseCanvasShortcutsOptions) {
  const { nodes, undo, redo, canUndo, canRedo, copySelected, paste, canPaste } =
    useCanvasStore();
  const { autoLayout, deleteSelected, duplicateSelected } = useCanvas();
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);

  const getSelectedStep = useCallback((): WorkflowStep | null => {
    if (!currentWorkflow) return null;
    const selectedNode = nodes.find(
      (n: Node) => n.selected && STEP_NODE_TYPES.includes(n.type || ''),
    );
    if (!selectedNode) return null;
    return currentWorkflow.steps.find((s) => s.id === selectedNode.data.id) || null;
  }, [currentWorkflow, nodes]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;

      // Delete selected nodes
      if (event.key === 'Backspace' || event.key === 'Delete') {
        deleteSelected();
        return;
      }
      // Duplicate (Cmd/Ctrl + D)
      if (isMeta && event.key === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      // Auto-layout (Cmd/Ctrl + L)
      if (isMeta && event.key === 'l') {
        event.preventDefault();
        autoLayout();
        return;
      }
      // Undo (Cmd/Ctrl + Z)
      if (isMeta && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo()) undo();
        return;
      }
      // Redo (Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y)
      if ((isMeta && event.shiftKey && event.key === 'z') || (isMeta && event.key === 'y')) {
        event.preventDefault();
        if (canRedo()) redo();
        return;
      }
      // Copy (Cmd/Ctrl + C)
      if (isMeta && event.key === 'c') {
        event.preventDefault();
        copySelected();
        return;
      }
      // Paste (Cmd/Ctrl + V)
      if (isMeta && event.key === 'v') {
        event.preventDefault();
        if (canPaste()) paste();
        return;
      }
      // Edit selected step (E)
      if (event.key === 'e' && !isMeta && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        const step = getSelectedStep();
        if (step) onEditStep(step);
        return;
      }
      // View YAML (Y)
      if (event.key === 'y' && !isMeta && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        const step = getSelectedStep();
        if (step) onViewYaml(step);
        return;
      }
    },
    [
      deleteSelected, duplicateSelected, autoLayout, getSelectedStep,
      undo, redo, canUndo, canRedo, copySelected, paste, canPaste,
      onEditStep, onViewYaml,
    ],
  );

  return { onKeyDown };
}

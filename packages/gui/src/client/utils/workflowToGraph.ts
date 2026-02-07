import type { Node, Edge } from '@xyflow/react';
import { parse } from 'yaml';

interface WorkflowStep {
  id: string;
  name?: string;
  action?: string;
  workflow?: string;
  type?: 'while' | 'for_each' | 'for' | 'switch' | 'parallel' | 'try' | 'if' | 'map' | 'filter' | 'reduce';
  condition?: string;
  items?: string;
  maxIterations?: number;
  inputs: Record<string, unknown>;
  outputVariable?: string;
  conditions?: string[];
  steps?: WorkflowStep[];
  variables?: Record<string, { initial: unknown }>;
}

interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  cron?: string;
  path?: string;
  events?: string[];
}

interface Workflow {
  metadata: {
    id: string;
    name: string;
  };
  steps: WorkflowStep[];
  triggers?: WorkflowTrigger[];
}

interface GraphResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Parse control flow constructs from raw markdown content
 * This is a temporary solution until the core parser supports control flow
 */
function extractControlFlowFromMarkdown(markdown?: string): WorkflowStep[] {
  if (!markdown) return [];

  const controlFlowSteps: WorkflowStep[] = [];
  // Match YAML code blocks that contain control flow types
  const codeBlockRegex = /```yaml\s*\n([\s\S]*?)\n```/g;
  let match;
  let stepIndex = 0;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const yamlContent = match[1];

    try {
      // Parse the YAML content
      const parsedStep = parse(yamlContent);

      // Check if this is a control flow block
      if (parsedStep && parsedStep.type && ['while', 'for_each', 'for', 'switch', 'parallel', 'try', 'if', 'map', 'filter', 'reduce'].includes(parsedStep.type)) {
        const id = parsedStep.id || `control-flow-${parsedStep.type}-${stepIndex++}`;

        // Create the step object preserving all properties
        const step: WorkflowStep = {
          ...parsedStep,
          id,
          // Ensure inputs is initialized
          inputs: parsedStep.inputs || {},
        };

        controlFlowSteps.push(step);
      }
    } catch (e) {
      console.warn('Failed to parse control flow YAML block:', e);
    }
  }

  return controlFlowSteps;
}

/**
 * Converts a marktoflow Workflow to React Flow nodes and edges
 */
export function workflowToGraph(workflow: Workflow & { markdown?: string }): GraphResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const VERTICAL_SPACING = 180;
  const HORIZONTAL_OFFSET = 250;

  // Try to extract control flow from markdown if available
  const controlFlowSteps = extractControlFlowFromMarkdown(workflow.markdown);
  const allSteps = [...workflow.steps, ...controlFlowSteps];

  // Helper for recursive step processing
  const processSteps = (
    steps: WorkflowStep[],
    startX: number,
    startY: number,
    parentId?: string
  ): { lastNodeId: string | null; endY: number } => {
    let currentY = startY;
    let prevNodeId: string | null = null;

    steps.forEach((step, index) => {
      // Ensure step has an ID
      if (!step.id) {
        step.id = parentId
          ? `${parentId}-step-${index}`
          : `step-${Date.now()}-${index}`;
      }

      const isSubWorkflow = !!step.workflow;
      const isControlFlow = !!step.type && ['while', 'for_each', 'for', 'switch', 'parallel', 'try', 'if', 'map', 'filter', 'reduce'].includes(step.type);

      let nodeType = 'step';
      if (isSubWorkflow) {
        nodeType = 'subworkflow';
      } else if (isControlFlow) {
        nodeType = step.type!;
      }

      // Build node data based on type
      const baseData = {
        id: step.id,
        name: step.name,
        action: step.action,
        workflowPath: step.workflow,
        status: 'pending' as const,
      };

      // Add control-flow specific data
      let nodeData: any = { ...baseData };
      if (step.type === 'while') {
        nodeData = {
          ...baseData,
          condition: step.condition || 'true',
          maxIterations: step.maxIterations || 100,
          variables: step.variables,
        };
      } else if (step.type === 'for_each' || step.type === 'for') {
        const items = step.items || '[]';
        nodeData = {
          ...baseData,
          items: items === 'unknown' ? '[]' : items,
          itemVariable: step.inputs?.itemVariable as string,
        };
      } else if (step.type === 'switch') {
        nodeData = {
          ...baseData,
          expression: step.inputs?.expression as string || step.condition || '',
          cases: {},
          hasDefault: true,
        };
      } else if (step.type === 'parallel') {
        nodeData = {
          ...baseData,
          branches: [],
          maxConcurrent: 0,
        };
      } else if (step.type === 'try') {
        nodeData = {
          ...baseData,
          hasCatch: true,
          hasFinally: false,
        };
      } else if (step.type === 'if') {
        nodeData = {
          ...baseData,
          condition: step.condition || 'true',
          hasElse: true,
        };
      } else if (step.type === 'map' || step.type === 'filter' || step.type === 'reduce') {
        const items = step.items || (step.inputs?.items as string) || '[]';
        nodeData = {
          ...baseData,
          transformType: step.type,
          items: items === 'unknown' ? '[]' : items, // Guard against 'unknown' string
          itemVariable: step.inputs?.itemVariable as string,
          expression: step.inputs?.expression as string,
          condition: step.condition,
        };
      } else {
        // Regular step
        nodeData = {
          ...baseData,
          condition: step.condition,
          items: step.items,
          maxIterations: step.maxIterations,
          variables: step.variables,
        };
      }

      const node: Node = {
        id: step.id,
        type: nodeType,
        position: {
          x: startX,
          y: currentY,
        },
        data: nodeData,
      };

      nodes.push(node);

      // Connect from previous sibling (Next Step Logic)
      if (prevNodeId) {
        const edge: Edge = {
          id: `e-${prevNodeId}-${step.id}`,
          source: prevNodeId,
          target: step.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#ff6d5a', strokeWidth: 2 },
        };

        // Add condition label if present
        if (step.conditions && step.conditions.length > 0) {
          edge.label = 'conditional';
          edge.labelStyle = { fill: '#a0a0c0', fontSize: 10 };
          edge.labelBgStyle = { fill: '#232340' };
        }

        edges.push(edge);
      }

      // Handle Nested Steps for Loops (Recursive)
      if ((step.type === 'while' || step.type === 'for_each' || step.type === 'for') && step.steps && step.steps.length > 0) {
        // Position children to the right and potentially slightly down
        const childStartX = startX + 350;
        // Offset Y slightly to align better with side handles 
        const childStartY = currentY + 20;

        const { lastNodeId: lastChildId, endY: childrenEndY } = processSteps(step.steps, childStartX, childStartY, step.id);

        const loopColor = step.type === 'while' ? '#fb923c' : '#f093fb';

        // Connect Loop (Body/Right) -> First Child
        edges.push({
          id: `e-${step.id}-body-start`,
          source: step.id,
          target: step.steps[0].id,
          sourceHandle: 'body',
          type: 'smoothstep',
          animated: true,
          style: { stroke: loopColor, strokeWidth: 2 },
          label: step.type === 'while' ? 'do' : 'each',
          labelStyle: { fill: loopColor, fontSize: 10 },
          labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.8 },
        });

        // Connect Last Child -> Loop (Loop Back/Left)
        if (lastChildId) {
          edges.push({
            id: `e-${lastChildId}-${step.id}-loop-back`,
            source: lastChildId,
            target: step.id,
            targetHandle: 'loop-back',
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: loopColor,
              strokeWidth: 2,
              strokeDasharray: '5,5',
            },
          });
        }

        // Ensure next sibling starts below the block
        // Use childrenEndY but careful not to overlap if children are short
        currentY = Math.max(currentY + VERTICAL_SPACING, childrenEndY);
      } else {
        // Regular spacing
        currentY += VERTICAL_SPACING;
      }

      prevNodeId = step.id;
    });

    return { lastNodeId: prevNodeId, endY: currentY };
  };

  // Add trigger node if triggers are defined
  let startY = 0;
  let triggerId: string | null = null;

  if (workflow.triggers && workflow.triggers.length > 0) {
    const trigger = workflow.triggers[0]; // Primary trigger
    triggerId = `trigger-${workflow.metadata.id}`;

    nodes.push({
      id: triggerId,
      type: 'trigger',
      position: { x: HORIZONTAL_OFFSET, y: startY },
      data: {
        id: triggerId,
        name: workflow.metadata.name,
        type: trigger.type || 'manual',
        cron: trigger.cron,
        path: trigger.path,
        events: trigger.events,
        active: true,
      },
    });

    startY += VERTICAL_SPACING;
  }

  // Process all steps recursively
  const { lastNodeId: lastStepId, endY } = processSteps(allSteps, HORIZONTAL_OFFSET, startY);

  // Connect trigger to first step
  if (triggerId && allSteps.length > 0) {
    edges.push({
      id: `e-${triggerId}-${allSteps[0].id}`,
      source: triggerId,
      target: allSteps[0].id,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#ff6d5a', strokeWidth: 2 },
    });
  }

  // Add output node at the end
  if (allSteps.length > 0) {
    const outputId = `output-${workflow.metadata.id}`;

    // Collect all output variables (flattened)
    const flattenSteps = (steps: WorkflowStep[]): WorkflowStep[] => {
      let flat: WorkflowStep[] = [];
      steps.forEach(s => {
        flat.push(s);
        if (s.steps) flat = flat.concat(flattenSteps(s.steps));
      });
      return flat;
    };
    const flatSteps = flattenSteps(allSteps);

    const outputVariables = flatSteps
      .filter((s) => s.outputVariable)
      .map((s) => s.outputVariable as string);

    nodes.push({
      id: outputId,
      type: 'output',
      position: { x: HORIZONTAL_OFFSET, y: endY },
      data: {
        id: outputId,
        name: 'Workflow Output',
        variables: outputVariables,
        status: 'pending',
      },
    });

    // Edge from last step to output (if last step exists and isn't the loop itself ending improperly?)
    // If the workflow ended with a loop, lastStepId is the loop node.
    if (lastStepId) {
      edges.push({
        id: `e-${lastStepId}-${outputId}`,
        source: lastStepId,
        target: outputId,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#ff6d5a', strokeWidth: 2 },
      });
    }

    // Add data flow edges based on variable references (using flattened steps)
    const variableEdges = findVariableDependencies(flatSteps);
    edges.push(...variableEdges);
  }

  return { nodes, edges };
}

/**
 * Finds variable dependencies between steps
 * Creates additional edges showing data flow
 */
function findVariableDependencies(steps: WorkflowStep[]): Edge[] {
  const edges: Edge[] = [];
  const outputVariables = new Map<string, string>(); // variable name -> step id

  // First pass: collect all output variables
  steps.forEach((step) => {
    if (step.outputVariable) {
      outputVariables.set(step.outputVariable, step.id);
    }
  });

  // Second pass: find references in inputs
  steps.forEach((step) => {
    const references = findTemplateVariables(step.inputs);

    references.forEach((ref) => {
      // Extract the root variable name (e.g., "pr_details" from "pr_details.title")
      const rootVar = ref.split('.')[0];

      // Check if this references an output variable
      const sourceStepId = outputVariables.get(rootVar);
      if (sourceStepId && sourceStepId !== step.id) {
        // Create data flow edge
        const edgeId = `data-${sourceStepId}-${step.id}-${rootVar}`;

        // Check if edge already exists
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: sourceStepId,
            target: step.id,
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: '#5bc0de',
              strokeWidth: 1,
              strokeDasharray: '5,5',
            },
            label: rootVar,
            labelStyle: { fill: '#5bc0de', fontSize: 9 },
            labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.8 },
          });
        }
      }
    });
  });

  return edges;
}

/**
 * Extracts template variable references from inputs
 */
function findTemplateVariables(inputs: Record<string, unknown> | undefined): string[] {
  const variables: string[] = [];
  if (!inputs) return variables;

  const templateRegex = /\{\{\s*([^}]+)\s*\}\}/g;

  function extractFromValue(value: unknown): void {
    if (typeof value === 'string') {
      let match;
      while ((match = templateRegex.exec(value)) !== null) {
        // Extract variable name, removing any method calls
        const varExpr = match[1].trim();
        const varName = varExpr.split('.')[0].replace(/\[.*\]/, '');

        // Filter out 'inputs' as those are workflow inputs, not step outputs
        if (varName !== 'inputs' && !variables.includes(varName)) {
          variables.push(varName);
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(extractFromValue);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(extractFromValue);
    }
  }

  Object.values(inputs).forEach(extractFromValue);
  return variables;
}

/**
 * Converts React Flow nodes and edges back to a Workflow
 */
export function graphToWorkflow(
  nodes: Node[],
  _edges: Edge[],
  metadata: Workflow['metadata']
): Workflow {
  // Filter out trigger, output, sticky, and group nodes, sort by vertical position
  const stepNodes = nodes
    .filter((node) => node.type === 'step' || node.type === 'subworkflow')
    .sort((a, b) => a.position.y - b.position.y);

  // Extract trigger info if present
  const triggerNode = nodes.find((node) => node.type === 'trigger');
  const triggers: WorkflowTrigger[] = [];

  if (triggerNode) {
    const data = triggerNode.data as Record<string, unknown>;
    triggers.push({
      type: (data.type as WorkflowTrigger['type']) || 'manual',
      cron: data.cron as string | undefined,
      path: data.path as string | undefined,
      events: data.events as string[] | undefined,
    });
  }

  const steps: WorkflowStep[] = stepNodes.map((node) => {
    const data = node.data as Record<string, unknown>;
    const step: WorkflowStep = {
      id: (data.id as string) || node.id,
      inputs: (data.inputs as Record<string, unknown>) || {},
    };

    if (data.name) step.name = data.name as string;
    if (data.action) step.action = data.action as string;
    if (data.workflowPath) step.workflow = data.workflowPath as string;
    if (data.outputVariable) step.outputVariable = data.outputVariable as string;
    if (data.conditions) step.conditions = data.conditions as string[];

    return step;
  });

  return {
    metadata,
    steps,
    triggers: triggers.length > 0 ? triggers : undefined,
  };
}

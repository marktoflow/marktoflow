import type { Node, Edge } from '@xyflow/react';

interface WorkflowStep {
  id: string;
  name?: string;
  action?: string;
  workflow?: string;
  inputs: Record<string, unknown>;
  outputVariable?: string;
  conditions?: string[];
}

interface Workflow {
  metadata: {
    id: string;
    name: string;
  };
  steps: WorkflowStep[];
}

interface GraphResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Converts a marktoflow Workflow to React Flow nodes and edges
 */
export function workflowToGraph(workflow: Workflow): GraphResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const VERTICAL_SPACING = 120;
  const HORIZONTAL_OFFSET = 250;

  // Create nodes for each step
  workflow.steps.forEach((step, index) => {
    const isSubWorkflow = !!step.workflow;

    const node: Node = {
      id: step.id,
      type: isSubWorkflow ? 'subworkflow' : 'step',
      position: {
        x: HORIZONTAL_OFFSET,
        y: index * VERTICAL_SPACING,
      },
      data: {
        id: step.id,
        name: step.name,
        action: step.action,
        workflowPath: step.workflow,
        status: 'pending',
      },
    };

    nodes.push(node);

    // Create edge to next step
    if (index < workflow.steps.length - 1) {
      const nextStep = workflow.steps[index + 1];
      const edge: Edge = {
        id: `e-${step.id}-${nextStep.id}`,
        source: step.id,
        target: nextStep.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#ff6d5a', strokeWidth: 2 },
      };

      // Add condition label if present
      if (nextStep.conditions && nextStep.conditions.length > 0) {
        edge.label = 'conditional';
        edge.labelStyle = { fill: '#a0a0c0', fontSize: 10 };
        edge.labelBgStyle = { fill: '#232340' };
      }

      edges.push(edge);
    }
  });

  // Add data flow edges based on variable references
  const variableEdges = findVariableDependencies(workflow.steps);
  edges.push(...variableEdges);

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
function findTemplateVariables(inputs: Record<string, unknown>): string[] {
  const variables: string[] = [];
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
  // Sort nodes by vertical position to determine step order
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

  const steps: WorkflowStep[] = sortedNodes.map((node) => {
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
  };
}

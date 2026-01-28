import type { Node, Edge } from '@xyflow/react';

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

    // Check if this is a control flow block
    const typeMatch = yamlContent.match(/^type:\s*(while|for_each|for|switch|parallel|try|if|map|filter|reduce)/m);
    if (typeMatch) {
      const type = typeMatch[1] as WorkflowStep['type'];
      const id = `control-flow-${type}-${stepIndex++}`;

      // Extract common properties
      const conditionMatch = yamlContent.match(/condition:\s*["'](.+?)["']/);
      const itemsMatch = yamlContent.match(/items:\s*["'](.+?)["']/);
      const maxIterMatch = yamlContent.match(/max_iterations:\s*(\d+)/);
      const expressionMatch = yamlContent.match(/expression:\s*["'](.+?)["']/);
      const itemVarMatch = yamlContent.match(/item_variable:\s*(\w+)/);

      // Extract switch expression
      const switchExprMatch = yamlContent.match(/expression:\s*["'](.+?)["']/);

      // Extract variables for while loops
      const variables: Record<string, { initial: unknown }> = {};
      const varsMatch = yamlContent.match(/variables:\s*\n((?:  .*\n)*)/);
      if (varsMatch) {
        const varsContent = varsMatch[1];
        const varLines = varsContent.split('\n').filter(Boolean);
        varLines.forEach(line => {
          const varMatch = line.match(/^\s+(\w+):\s*$/);
          if (varMatch) {
            const varName = varMatch[1];
            // Try to find initial value on next line
            const initMatch = varsContent.match(new RegExp(`${varName}:\\s*\\n\\s+initial:\\s*(.+)`));
            if (initMatch) {
              try {
                variables[varName] = { initial: JSON.parse(initMatch[1]) };
              } catch {
                variables[varName] = { initial: initMatch[1].trim() };
              }
            }
          }
        });
      }

      // Build step data based on type
      const step: WorkflowStep = {
        id,
        type,
        name: type === 'map' ? 'Map Transform' :
              type === 'filter' ? 'Filter Transform' :
              type === 'reduce' ? 'Reduce Transform' :
              type === 'switch' ? 'Switch/Case' :
              type === 'parallel' ? 'Parallel Execution' :
              type === 'try' ? 'Try/Catch' :
              type === 'if' ? 'If/Else' :
              `${type.charAt(0).toUpperCase() + type.slice(1)} Loop`,
        inputs: {},
      };

      // Add type-specific properties
      if (conditionMatch) step.condition = conditionMatch[1];
      if (itemsMatch) step.items = itemsMatch[1];
      if (maxIterMatch) step.maxIterations = parseInt(maxIterMatch[1], 10);
      if (Object.keys(variables).length > 0) step.variables = variables;

      // Transform-specific properties
      if (type === 'map' || type === 'filter' || type === 'reduce') {
        if (itemVarMatch) {
          step.inputs = { ...step.inputs, itemVariable: itemVarMatch[1] };
        }
        if (expressionMatch) {
          step.inputs = { ...step.inputs, expression: expressionMatch[1] };
        }
      }

      // Switch-specific properties
      if (type === 'switch' && switchExprMatch) {
        step.inputs = { ...step.inputs, expression: switchExprMatch[1] };
      }

      controlFlowSteps.push(step);
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
  let currentY = 0;

  // Try to extract control flow from markdown if available
  const controlFlowSteps = extractControlFlowFromMarkdown(workflow.markdown);
  const allSteps = [...workflow.steps, ...controlFlowSteps];

  // Add trigger node if triggers are defined
  if (workflow.triggers && workflow.triggers.length > 0) {
    const trigger = workflow.triggers[0]; // Primary trigger
    const triggerId = `trigger-${workflow.metadata.id}`;

    nodes.push({
      id: triggerId,
      type: 'trigger',
      position: { x: HORIZONTAL_OFFSET, y: currentY },
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

    currentY += VERTICAL_SPACING;

    // Edge from trigger to first step
    if (allSteps.length > 0) {
      edges.push({
        id: `e-${triggerId}-${allSteps[0].id}`,
        source: triggerId,
        target: allSteps[0].id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#ff6d5a', strokeWidth: 2 },
      });
    }
  }

  // Create nodes for each step
  allSteps.forEach((step, index) => {
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
    let nodeData = { ...baseData };
    if (step.type === 'while') {
      nodeData = {
        ...baseData,
        condition: step.condition || 'true',
        maxIterations: step.maxIterations || 100,
        variables: step.variables,
      };
    } else if (step.type === 'for_each' || step.type === 'for') {
      nodeData = {
        ...baseData,
        items: step.items || '[]',
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
      nodeData = {
        ...baseData,
        transformType: step.type,
        items: step.items || '[]',
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
        x: HORIZONTAL_OFFSET,
        y: currentY + index * VERTICAL_SPACING,
      },
      data: nodeData,
    };

    nodes.push(node);

    // Create edge to next step
    if (index < allSteps.length - 1) {
      const nextStep = allSteps[index + 1];
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

    // Add loop-back edge for loops
    if (step.type === 'while' || step.type === 'for_each' || step.type === 'for') {
      const loopColor = step.type === 'while' ? '#fb923c' : '#f093fb';
      edges.push({
        id: `e-${step.id}-loop-back`,
        source: step.id,
        target: step.id,
        sourceHandle: 'loop-back',
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: loopColor,
          strokeWidth: 2,
          strokeDasharray: '5,5',
        },
        label: step.type === 'while' ? 'while true' : 'for each item',
        labelStyle: { fill: loopColor, fontSize: 9 },
        labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.9 },
      });
    }

    // Add iteration indicator for transform operations (map/filter/reduce)
    if (step.type === 'map' || step.type === 'filter' || step.type === 'reduce') {
      const transformColor = '#14b8a6';
      const label = step.type === 'map' ? 'transform each' :
                    step.type === 'filter' ? 'test each' :
                    'accumulate';
      edges.push({
        id: `e-${step.id}-transform-flow`,
        source: step.id,
        target: step.id,
        sourceHandle: 'loop-back',
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: transformColor,
          strokeWidth: 1.5,
          strokeDasharray: '3,3',
        },
        label,
        labelStyle: { fill: transformColor, fontSize: 8 },
        labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.9 },
      });
    }
  });

  // Add output node at the end
  if (allSteps.length > 0) {
    const outputId = `output-${workflow.metadata.id}`;
    const lastStep = allSteps[allSteps.length - 1];
    const outputY = currentY + allSteps.length * VERTICAL_SPACING;

    // Collect all output variables
    const outputVariables = allSteps
      .filter((s) => s.outputVariable)
      .map((s) => s.outputVariable as string);

    nodes.push({
      id: outputId,
      type: 'output',
      position: { x: HORIZONTAL_OFFSET, y: outputY },
      data: {
        id: outputId,
        name: 'Workflow Output',
        variables: outputVariables,
        status: 'pending',
      },
    });

    // Edge from last step to output
    edges.push({
      id: `e-${lastStep.id}-${outputId}`,
      source: lastStep.id,
      target: outputId,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#ff6d5a', strokeWidth: 2 },
    });
  }

  // Add data flow edges based on variable references
  const variableEdges = findVariableDependencies(allSteps);
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
  // Filter out trigger and output nodes, sort by vertical position
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

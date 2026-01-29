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
  // Control flow nested steps
  then?: WorkflowStep[];
  else?: WorkflowStep[];
  try?: WorkflowStep[];
  catch?: WorkflowStep[];
  finally?: WorkflowStep[];
  cases?: Record<string, WorkflowStep[]>;
  default?: WorkflowStep[];
  branches?: Array<{ id: string; name?: string; steps: WorkflowStep[] }>;
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

interface GroupContainerData {
  id: string;
  label: string;
  branchType: 'then' | 'else' | 'try' | 'catch' | 'finally' | 'case' | 'default' | 'branch' | 'iteration';
  parentId: string;
  stepCount: number;
  collapsed?: boolean;
}

// Branch colors for visual distinction
const BRANCH_COLORS = {
  then: '#10b981',      // green
  else: '#ef4444',      // red
  try: '#3b82f6',       // blue
  catch: '#f59e0b',     // orange
  finally: '#8b5cf6',   // purple
  case: '#06b6d4',      // cyan
  default: '#64748b',   // slate
  branch: '#06b6d4',    // cyan
  iteration: '#a855f7', // purple
} as const;

/**
 * Create group container nodes and nested step nodes for a control flow branch
 */
function createNestedStepNodes(
  parentStepId: string,
  branchType: GroupContainerData['branchType'],
  branchLabel: string,
  nestedSteps: WorkflowStep[],
  nodes: Node[],
  edges: Edge[],
  startY: number,
  xOffset: number = 0,
  sourceHandleId?: string
): number {
  if (!nestedSteps || nestedSteps.length === 0) return startY;

  const groupId = `${parentStepId}-${branchType}-group`;
  const color = BRANCH_COLORS[branchType];

  // Create group container node
  const groupNode: Node = {
    id: groupId,
    type: 'group',
    position: { x: 250 + xOffset, y: startY },
    data: {
      id: groupId,
      label: branchLabel,
      branchType,
      parentId: parentStepId,
      stepCount: nestedSteps.length,
      collapsed: false,
    } as GroupContainerData,
    style: {
      width: 280,
      minHeight: 100,
    },
  };
  nodes.push(groupNode);

  // Create edge from parent control flow to group
  edges.push({
    id: `e-${parentStepId}-${groupId}`,
    source: parentStepId,
    target: groupId,
    sourceHandle: sourceHandleId || branchType,
    type: 'smoothstep',
    animated: false,
    style: { stroke: color, strokeWidth: 2, strokeDasharray: '5,5' },
    label: branchLabel,
    labelStyle: { fill: color, fontSize: 10 },
    labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.9 },
  });

  let currentY = 60; // Start below group header
  let previousStepId = groupId;

  // Create nested step nodes
  nestedSteps.forEach((step, index) => {
    const stepNode: Node = {
      id: step.id,
      type: step.action ? 'step' : step.workflow ? 'subworkflow' : 'step',
      position: { x: 20, y: currentY },
      parentNode: groupId, // Link to group container
      extent: 'parent' as const,
      data: {
        id: step.id,
        name: step.name,
        action: step.action,
        workflowPath: step.workflow,
        status: 'pending' as const,
      },
      style: {
        width: 240,
      },
    };
    nodes.push(stepNode);

    // Edge from previous step (or group start) to this step
    if (index === 0) {
      // First step connects from group container
      edges.push({
        id: `e-${groupId}-${step.id}`,
        source: groupId,
        target: step.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: color, strokeWidth: 1.5 },
      });
    } else {
      // Subsequent steps connect from previous step
      edges.push({
        id: `e-${previousStepId}-${step.id}`,
        source: previousStepId,
        target: step.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#ff6d5a', strokeWidth: 1.5 },
      });
    }

    previousStepId = step.id;
    currentY += 100; // Spacing between nested steps
  });

  // Return the Y position after this group
  return startY + Math.max(currentY + 40, 150);
}

/**
 * Process control flow nested steps and create appropriate group nodes
 */
function processControlFlowNesting(
  step: WorkflowStep,
  nodes: Node[],
  edges: Edge[],
  startY: number
): number {
  let currentY = startY;

  if (step.type === 'if') {
    // If/Else - simple routing node with 2 outputs (no nested visualization)
    // The then/else paths connect directly to next workflow steps
  } else if (step.type === 'try') {
    // Try/Catch - simple routing node with 2 outputs (no nested visualization)
    // The success/error paths connect directly to next workflow steps
  } else if (step.type === 'switch') {
    // Switch/Case structure
    if (step.cases) {
      const caseKeys = Object.keys(step.cases);
      const caseWidth = 300;
      const totalWidth = caseKeys.length * caseWidth;
      const startX = -totalWidth / 2 + caseWidth / 2;

      caseKeys.forEach((caseKey, index) => {
        const caseSteps = step.cases![caseKey];
        if (caseSteps && caseSteps.length > 0) {
          const caseY = createNestedStepNodes(
            step.id,
            'case',
            `Case: ${caseKey}`,
            caseSteps,
            nodes,
            edges,
            startY,
            startX + index * caseWidth,
            `case-${caseKey}` // Specific source handle ID for this case
          );
          currentY = Math.max(currentY, caseY);
        }
      });
    }
    if (step.default && step.default.length > 0) {
      const defaultY = createNestedStepNodes(
        step.id,
        'default',
        'Default',
        step.default,
        nodes,
        edges,
        startY,
        200,
        'case-default' // Specific source handle ID for default
      );
      currentY = Math.max(currentY, defaultY);
    }
  } else if (step.type === 'for_each' || step.type === 'while') {
    // Loop structures
    console.log(`Processing ${step.type} loop:`, step.id, 'nested steps:', step.steps?.length || 0, step.steps);
    if (step.steps && step.steps.length > 0) {
      console.log('Creating nested step nodes for loop');
      currentY = createNestedStepNodes(
        step.id,
        'iteration',
        step.type === 'for_each' ? 'For Each' : 'While',
        step.steps,
        nodes,
        edges,
        currentY,
        0
      );
    } else {
      console.warn(`Loop ${step.id} has no nested steps!`);
    }
  } else if (step.type === 'parallel') {
    // Parallel branches
    if (step.branches && step.branches.length > 0) {
      const branchWidth = 300;
      const totalWidth = step.branches.length * branchWidth;
      const startX = -totalWidth / 2 + branchWidth / 2;

      step.branches.forEach((branch, index) => {
        if (branch.steps && branch.steps.length > 0) {
          const branchY = createNestedStepNodes(
            step.id,
            'branch',
            branch.name || `Branch ${index + 1}`,
            branch.steps,
            nodes,
            edges,
            startY,
            startX + index * branchWidth
          );
          currentY = Math.max(currentY, branchY);
        }
      });
    }
  }

  return currentY;
}

/**
 * Parse control flow constructs from raw markdown content
 * This is a temporary solution until the core parser supports control flow
 */
function extractControlFlowFromMarkdown(markdown?: string): WorkflowStep[] {
  if (!markdown) {
    console.log('No markdown provided to extract');
    return [];
  }

  console.log('Extracting from markdown, length:', markdown.length);
  const controlFlowSteps: WorkflowStep[] = [];
  // Match YAML code blocks that contain control flow types
  const codeBlockRegex = /```yaml\s*\n([\s\S]*?)\n```/g;
  let match;
  let stepIndex = 0;
  let blockCount = 0;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    blockCount++;
    const yamlContent = match[1];
    console.log(`YAML block ${blockCount}:`, yamlContent.substring(0, 100));

    // Check if this is a control flow block
    const typeMatch = yamlContent.match(/^type:\s*(while|for_each|for|switch|parallel|try|if|map|filter|reduce)/m);
    console.log(`Block ${blockCount} type match:`, typeMatch?.[1] || 'none');
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

      // Extract nested steps using a simple YAML parser
      try {
        // For for_each and while: extract steps array
        if (type === 'for_each' || type === 'while') {
          console.log('Full yamlContent for', type, ':', yamlContent);
          const stepsMatch = yamlContent.match(/steps:\s*\n((?:  - [\s\S]*?(?=\n\S|\n$))+)/);
          console.log('For_each/while steps regex match:', !!stepsMatch);
          if (stepsMatch) {
            console.log('Matched steps content:', stepsMatch[1]);
            const parsedSteps = parseNestedSteps(stepsMatch[1]);
            console.log('Parsed nested steps:', parsedSteps.length, parsedSteps);
            step.steps = parsedSteps;
          } else {
            console.error('Steps regex did not match! Trying alternative...');
            // Try alternative regex
            const altMatch = yamlContent.match(/steps:\s*\n([\s\S]+?)(?=\n[a-z_]+:|$)/);
            if (altMatch) {
              console.log('Alternative match found:', altMatch[1].substring(0, 200));
              const parsedSteps = parseNestedSteps(altMatch[1]);
              console.log('Parsed with alternative:', parsedSteps.length, parsedSteps);
              step.steps = parsedSteps;
            }
          }
        }

        // For if: extract then and else branches
        if (type === 'if') {
          const thenMatch = yamlContent.match(/then:\s*\n((?:  - [\s\S]*?(?=\nelse:|\n\S|\n$))+)/);
          const elseMatch = yamlContent.match(/else:\s*\n((?:  - [\s\S]*?(?=\n\S|\n$))+)/);
          if (thenMatch) step.then = parseNestedSteps(thenMatch[1]);
          if (elseMatch) step.else = parseNestedSteps(elseMatch[1]);
        }

        // For try: extract try, catch, and finally branches
        if (type === 'try') {
          const tryMatch = yamlContent.match(/try:\s*\n((?:  - [\s\S]*?(?=\ncatch:|\nfinally:|\n\S|\n$))+)/);
          const catchMatch = yamlContent.match(/catch:\s*\n((?:  - [\s\S]*?(?=\nfinally:|\n\S|\n$))+)/);
          const finallyMatch = yamlContent.match(/finally:\s*\n((?:  - [\s\S]*?(?=\n\S|\n$))+)/);
          if (tryMatch) step.try = parseNestedSteps(tryMatch[1]);
          if (catchMatch) step.catch = parseNestedSteps(catchMatch[1]);
          if (finallyMatch) step.finally = parseNestedSteps(finallyMatch[1]);
        }

        // For switch: extract cases and default
        if (type === 'switch') {
          const casesMatch = yamlContent.match(/cases:\s*\n((?:  \w+:[\s\S]*?(?=\n  \w+:|\ndefault:|\n\S|\n$))+)/);
          if (casesMatch) {
            step.cases = {};
            const caseContent = casesMatch[1];
            const casePattern = /(\w+):\s*\n((?:    - [\s\S]*?(?=\n  \w+:|\ndefault:|\n\S|\n$))+)/g;
            let caseMatch;
            while ((caseMatch = casePattern.exec(caseContent)) !== null) {
              const caseName = caseMatch[1];
              const caseSteps = parseNestedSteps(caseMatch[2]);
              step.cases[caseName] = caseSteps;
            }
          }
          const defaultMatch = yamlContent.match(/default:\s*\n((?:  - [\s\S]*?(?=\n\S|\n$))+)/);
          if (defaultMatch) step.default = parseNestedSteps(defaultMatch[1]);
        }

        // For parallel: extract branches
        if (type === 'parallel') {
          const branchesMatch = yamlContent.match(/branches:\s*\n((?:  - [\s\S]*?(?=\n  - id:|\n\S|\n$))+)/);
          if (branchesMatch) {
            step.branches = [];
            const branchPattern = /- id:\s*(\S+)\s*\n(?:    name:\s*['"](.+?)['"])?\s*\n    steps:\s*\n((?:      - [\s\S]*?(?=\n  - id:|\n\S|\n$))+)/g;
            let branchMatch;
            while ((branchMatch = branchPattern.exec(branchesMatch[1])) !== null) {
              step.branches.push({
                id: branchMatch[1],
                name: branchMatch[2],
                steps: parseNestedSteps(branchMatch[3]),
              });
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to extract nested steps for ${type}:`, e);
      }

      console.log(`Created control flow step:`, step.id, step.type, step);
      controlFlowSteps.push(step);
    }
  }

  console.log(`Total control flow steps extracted: ${controlFlowSteps.length}`);
  return controlFlowSteps;
}

/**
 * Parse nested steps from YAML content
 */
function parseNestedSteps(yamlContent: string): WorkflowStep[] {
  console.log('parseNestedSteps called with:', yamlContent.substring(0, 300));
  const steps: WorkflowStep[] = [];

  // Split by step markers (  - id:)
  const stepBlocks = yamlContent.split(/\n\s*- id:\s*/);
  console.log('Split into', stepBlocks.length, 'blocks');

  for (let i = 1; i < stepBlocks.length; i++) { // Skip first empty block
    const block = stepBlocks[i];
    console.log(`Parsing block ${i}:`, block.substring(0, 150));

    // Extract id (first line)
    const idMatch = block.match(/^(\S+)/);
    if (!idMatch) continue;

    const step: WorkflowStep = {
      id: idMatch[1],
      inputs: {},
    };

    // Extract name
    const nameMatch = block.match(/name:\s*['"](.+?)['"]/);
    if (nameMatch) step.name = nameMatch[1];

    // Extract action
    const actionMatch = block.match(/action:\s*(\S+)/);
    if (actionMatch) step.action = actionMatch[1];

    // Extract inputs
    const inputsMatch = block.match(/inputs:\s*\n((?:\s{4,}[\s\S]*?(?=\n\s{0,2}\w+:|$))+)/);
    if (inputsMatch) {
      const inputLines = inputsMatch[1].split('\n');
      for (const line of inputLines) {
        const inputMatch = line.match(/^\s+(\w+):\s*(.+)$/);
        if (inputMatch) {
          let value = inputMatch[2].trim();
          // Remove quotes if present
          value = value.replace(/^['"]|['"]$/g, '');
          step.inputs[inputMatch[1]] = value;
        }
      }
    }

    console.log('Parsed step:', step);
    steps.push(step);
  }

  console.log('Total parsed steps:', steps.length);
  return steps;
}

/**
 * Converts a marktoflow Workflow to React Flow nodes and edges
 */
export function workflowToGraph(workflow: Workflow & { markdown?: string }): GraphResult {
  console.log('=== workflowToGraph called ===');
  console.log('Workflow object keys:', Object.keys(workflow));
  console.log('Has markdown?', !!workflow.markdown);
  console.log('Markdown length:', workflow.markdown?.length || 0);
  console.log('Workflow steps count:', workflow.steps?.length || 0);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const VERTICAL_SPACING = 180;
  const HORIZONTAL_OFFSET = 250;
  let currentY = 0;

  // Try to extract control flow from markdown if available
  const controlFlowSteps = extractControlFlowFromMarkdown(workflow.markdown);
  console.log('Extracted control flow steps:', controlFlowSteps.length, controlFlowSteps);
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
        nestedSteps: step.steps,
        stepsCollapsed: false,
      };
    } else if (step.type === 'for_each' || step.type === 'for') {
      nodeData = {
        ...baseData,
        items: step.items || '[]',
        itemVariable: step.inputs?.itemVariable as string,
        nestedSteps: step.steps,
        stepsCollapsed: false,
      };
    } else if (step.type === 'switch') {
      nodeData = {
        ...baseData,
        expression: step.inputs?.expression as string || step.condition || '',
        cases: step.cases || {},
        hasDefault: !!(step.default && step.default.length > 0),
        defaultSteps: step.default,
      };
    } else if (step.type === 'parallel') {
      nodeData = {
        ...baseData,
        branches: step.branches || [],
        maxConcurrent: step.inputs?.maxConcurrent as number || 0,
      };
    } else if (step.type === 'try') {
      nodeData = {
        ...baseData,
        hasCatch: !!(step.catch && step.catch.length > 0),
        hasFinally: !!(step.finally && step.finally.length > 0),
        trySteps: step.try,
        catchSteps: step.catch,
        finallySteps: step.finally,
      };
    } else if (step.type === 'if') {
      nodeData = {
        ...baseData,
        condition: step.condition || 'true',
        hasElse: !!(step.else && step.else.length > 0),
        thenSteps: step.then,
        elseSteps: step.else,
        thenCollapsed: false,
        elseCollapsed: false,
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

    // Process nested steps for control flow structures
    if (isControlFlow) {
      const nestedY = processControlFlowNesting(
        step,
        nodes,
        edges,
        currentY + index * VERTICAL_SPACING + 120
      );
      // Update current Y if nested steps extend beyond normal spacing
      if (nestedY > currentY + (index + 1) * VERTICAL_SPACING) {
        currentY = nestedY - (index + 1) * VERTICAL_SPACING;
      }
    }

    // Create edge to next step
    if (index < allSteps.length - 1) {
      const nextStep = allSteps[index + 1];

      // For if/else and try/catch, create edges from both outputs
      if (step.type === 'if') {
        // Then path
        edges.push({
          id: `e-${step.id}-then-${nextStep.id}`,
          source: step.id,
          sourceHandle: 'then',
          target: nextStep.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#10b981', strokeWidth: 2 },
          label: 'then',
          labelStyle: { fill: '#10b981', fontSize: 9 },
          labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.9 },
        });
        // Else path
        edges.push({
          id: `e-${step.id}-else-${nextStep.id}`,
          source: step.id,
          sourceHandle: 'else',
          target: nextStep.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#ef4444', strokeWidth: 2 },
          label: 'else',
          labelStyle: { fill: '#ef4444', fontSize: 9 },
          labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.9 },
        });
      } else if (step.type === 'try') {
        // Success path
        edges.push({
          id: `e-${step.id}-success-${nextStep.id}`,
          source: step.id,
          sourceHandle: 'success',
          target: nextStep.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#10b981', strokeWidth: 2 },
          label: 'success',
          labelStyle: { fill: '#10b981', fontSize: 9 },
          labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.9 },
        });
        // Error path
        edges.push({
          id: `e-${step.id}-error-${nextStep.id}`,
          source: step.id,
          sourceHandle: 'error',
          target: nextStep.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#ef4444', strokeWidth: 2 },
          label: 'error',
          labelStyle: { fill: '#ef4444', fontSize: 9 },
          labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.9 },
        });
      } else {
        // Regular edge for other node types
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

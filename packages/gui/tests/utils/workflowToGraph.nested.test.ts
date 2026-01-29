import { describe, it, expect } from 'vitest';
import { workflowToGraph } from '../../src/client/utils/workflowToGraph';

describe('workflowToGraph - nested steps', () => {
  it('should create group nodes for if/else with nested steps', () => {
    const workflow = {
      metadata: {
        id: 'test-workflow',
        name: 'Test Workflow',
      },
      steps: [
        {
          id: 'step-1',
          type: 'if' as const,
          name: 'Check condition',
          condition: 'inputs.value > 10',
          inputs: {},
          then: [
            {
              id: 'then-1',
              name: 'Then action 1',
              action: 'console.log',
              inputs: { message: 'Value is greater than 10' },
            },
            {
              id: 'then-2',
              name: 'Then action 2',
              action: 'console.log',
              inputs: { message: 'Another then action' },
            },
          ],
          else: [
            {
              id: 'else-1',
              name: 'Else action 1',
              action: 'console.log',
              inputs: { message: 'Value is 10 or less' },
            },
          ],
        },
      ],
    };

    const result = workflowToGraph(workflow);

    // Should have the if node
    const ifNode = result.nodes.find(n => n.id === 'step-1');
    expect(ifNode).toBeDefined();
    expect(ifNode?.type).toBe('if');
    expect(ifNode?.data.thenSteps).toHaveLength(2);
    expect(ifNode?.data.elseSteps).toHaveLength(1);

    // Should have group nodes for then and else branches
    const thenGroup = result.nodes.find(n => n.id === 'step-1-then-group');
    const elseGroup = result.nodes.find(n => n.id === 'step-1-else-group');
    expect(thenGroup).toBeDefined();
    expect(elseGroup).toBeDefined();
    expect(thenGroup?.type).toBe('group');
    expect(elseGroup?.type).toBe('group');

    // Should have nested step nodes with parentNode set
    const thenStep1 = result.nodes.find(n => n.id === 'then-1');
    const thenStep2 = result.nodes.find(n => n.id === 'then-2');
    const elseStep1 = result.nodes.find(n => n.id === 'else-1');

    expect(thenStep1).toBeDefined();
    expect(thenStep1?.parentNode).toBe('step-1-then-group');
    expect(thenStep2).toBeDefined();
    expect(thenStep2?.parentNode).toBe('step-1-then-group');
    expect(elseStep1).toBeDefined();
    expect(elseStep1?.parentNode).toBe('step-1-else-group');

    // Should have edges from if node to groups
    const edgeToThenGroup = result.edges.find(
      e => e.source === 'step-1' && e.target === 'step-1-then-group'
    );
    const edgeToElseGroup = result.edges.find(
      e => e.source === 'step-1' && e.target === 'step-1-else-group'
    );
    expect(edgeToThenGroup).toBeDefined();
    expect(edgeToElseGroup).toBeDefined();
  });

  it('should create group nodes for for_each with nested steps', () => {
    const workflow = {
      metadata: {
        id: 'test-workflow',
        name: 'Test Workflow',
      },
      steps: [
        {
          id: 'loop-1',
          type: 'for_each' as const,
          name: 'Process items',
          items: 'inputs.items',
          inputs: { itemVariable: 'item' },
          steps: [
            {
              id: 'loop-step-1',
              name: 'Transform item',
              action: 'transform',
              inputs: { item: '{{ item }}' },
            },
            {
              id: 'loop-step-2',
              name: 'Save item',
              action: 'save',
              inputs: { item: '{{ item }}' },
            },
          ],
        },
      ],
    };

    const result = workflowToGraph(workflow);

    // Should have the for_each node
    const loopNode = result.nodes.find(n => n.id === 'loop-1');
    expect(loopNode).toBeDefined();
    expect(loopNode?.type).toBe('for_each');
    expect(loopNode?.data.nestedSteps).toHaveLength(2);

    // Should have iteration group node
    const iterationGroup = result.nodes.find(n => n.id === 'loop-1-iteration-group');
    expect(iterationGroup).toBeDefined();
    expect(iterationGroup?.type).toBe('group');

    // Should have nested step nodes
    const loopStep1 = result.nodes.find(n => n.id === 'loop-step-1');
    const loopStep2 = result.nodes.find(n => n.id === 'loop-step-2');
    expect(loopStep1).toBeDefined();
    expect(loopStep1?.parentNode).toBe('loop-1-iteration-group');
    expect(loopStep2).toBeDefined();
    expect(loopStep2?.parentNode).toBe('loop-1-iteration-group');
  });

  it('should create group nodes for try/catch with nested steps', () => {
    const workflow = {
      metadata: {
        id: 'test-workflow',
        name: 'Test Workflow',
      },
      steps: [
        {
          id: 'try-1',
          type: 'try' as const,
          name: 'Try operation',
          inputs: {},
          try: [
            {
              id: 'try-step-1',
              name: 'Risky operation',
              action: 'risky.action',
              inputs: {},
            },
          ],
          catch: [
            {
              id: 'catch-step-1',
              name: 'Handle error',
              action: 'error.handler',
              inputs: {},
            },
          ],
          finally: [
            {
              id: 'finally-step-1',
              name: 'Cleanup',
              action: 'cleanup',
              inputs: {},
            },
          ],
        },
      ],
    };

    const result = workflowToGraph(workflow);

    // Should have the try node
    const tryNode = result.nodes.find(n => n.id === 'try-1');
    expect(tryNode).toBeDefined();
    expect(tryNode?.type).toBe('try');
    expect(tryNode?.data.trySteps).toHaveLength(1);
    expect(tryNode?.data.catchSteps).toHaveLength(1);
    expect(tryNode?.data.finallySteps).toHaveLength(1);

    // Should have group nodes for all three branches
    const tryGroup = result.nodes.find(n => n.id === 'try-1-try-group');
    const catchGroup = result.nodes.find(n => n.id === 'try-1-catch-group');
    const finallyGroup = result.nodes.find(n => n.id === 'try-1-finally-group');
    expect(tryGroup).toBeDefined();
    expect(catchGroup).toBeDefined();
    expect(finallyGroup).toBeDefined();

    // Should have nested step nodes
    const tryStep = result.nodes.find(n => n.id === 'try-step-1');
    const catchStep = result.nodes.find(n => n.id === 'catch-step-1');
    const finallyStep = result.nodes.find(n => n.id === 'finally-step-1');
    expect(tryStep?.parentNode).toBe('try-1-try-group');
    expect(catchStep?.parentNode).toBe('try-1-catch-group');
    expect(finallyStep?.parentNode).toBe('try-1-finally-group');
  });

  it('should create group nodes for switch with multiple cases', () => {
    const workflow = {
      metadata: {
        id: 'test-workflow',
        name: 'Test Workflow',
      },
      steps: [
        {
          id: 'switch-1',
          type: 'switch' as const,
          name: 'Route by type',
          inputs: { expression: 'inputs.type' },
          cases: {
            'type-a': [
              {
                id: 'case-a-1',
                name: 'Handle type A',
                action: 'handle.a',
                inputs: {},
              },
            ],
            'type-b': [
              {
                id: 'case-b-1',
                name: 'Handle type B',
                action: 'handle.b',
                inputs: {},
              },
              {
                id: 'case-b-2',
                name: 'Followup for B',
                action: 'followup.b',
                inputs: {},
              },
            ],
          },
          default: [
            {
              id: 'default-1',
              name: 'Default handler',
              action: 'handle.default',
              inputs: {},
            },
          ],
        },
      ],
    };

    const result = workflowToGraph(workflow);

    // Should have the switch node
    const switchNode = result.nodes.find(n => n.id === 'switch-1');
    expect(switchNode).toBeDefined();
    expect(switchNode?.type).toBe('switch');
    expect(Object.keys(switchNode?.data.cases || {})).toHaveLength(2);

    // Should have group nodes for each case
    const caseAGroup = result.nodes.find(n => n.id === 'switch-1-case-group');
    const defaultGroup = result.nodes.find(n => n.id === 'switch-1-default-group');
    expect(caseAGroup).toBeDefined();
    expect(defaultGroup).toBeDefined();

    // Should have nested step nodes with correct parent
    const caseA1 = result.nodes.find(n => n.id === 'case-a-1');
    const caseB1 = result.nodes.find(n => n.id === 'case-b-1');
    const caseB2 = result.nodes.find(n => n.id === 'case-b-2');
    const default1 = result.nodes.find(n => n.id === 'default-1');

    expect(caseA1).toBeDefined();
    expect(caseB1).toBeDefined();
    expect(caseB2).toBeDefined();
    expect(default1).toBeDefined();
    expect(default1?.parentNode).toBe('switch-1-default-group');
  });

  it('should handle empty branches gracefully', () => {
    const workflow = {
      metadata: {
        id: 'test-workflow',
        name: 'Test Workflow',
      },
      steps: [
        {
          id: 'step-1',
          type: 'if' as const,
          name: 'Check condition',
          condition: 'inputs.value > 10',
          inputs: {},
          then: [
            {
              id: 'then-1',
              name: 'Then action',
              action: 'console.log',
              inputs: { message: 'Yes' },
            },
          ],
          // No else branch
        },
      ],
    };

    const result = workflowToGraph(workflow);

    // Should have the if node
    const ifNode = result.nodes.find(n => n.id === 'step-1');
    expect(ifNode).toBeDefined();

    // Should have then group but no else group
    const thenGroup = result.nodes.find(n => n.id === 'step-1-then-group');
    const elseGroup = result.nodes.find(n => n.id === 'step-1-else-group');
    expect(thenGroup).toBeDefined();
    expect(elseGroup).toBeUndefined();
  });
});

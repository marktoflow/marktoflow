import { describe, it, expect } from 'vitest';
import { workflowToGraph, graphToWorkflow } from '../../src/client/utils/workflowToGraph';

describe('workflowToGraph', () => {
  describe('basic conversion', () => {
    it('should convert a simple workflow to nodes and edges', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          { id: 'step-1', name: 'Step 1', action: 'http.get', inputs: {} },
          { id: 'step-2', name: 'Step 2', action: 'http.post', inputs: {} },
        ],
      };

      const { nodes, edges } = workflowToGraph(workflow);

      // Should have 2 step nodes + 1 output node
      expect(nodes).toHaveLength(3);
      expect(nodes[0].id).toBe('step-1');
      expect(nodes[0].type).toBe('step');
      expect(nodes[1].id).toBe('step-2');
      expect(nodes[1].type).toBe('step');
      expect(nodes[2].type).toBe('output');

      // Should have edge between steps and to output
      expect(edges.length).toBeGreaterThanOrEqual(2);
      expect(edges.find(e => e.source === 'step-1' && e.target === 'step-2')).toBeDefined();
    });

    it('should create nodes with correct data', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          {
            id: 'fetch',
            name: 'Fetch Data',
            action: 'github.pulls.get',
            inputs: { owner: 'test' },
            outputVariable: 'pr_data',
          },
        ],
      };

      const { nodes } = workflowToGraph(workflow);
      const stepNode = nodes.find(n => n.id === 'fetch');

      expect(stepNode?.data.id).toBe('fetch');
      expect(stepNode?.data.name).toBe('Fetch Data');
      expect(stepNode?.data.action).toBe('github.pulls.get');
      expect(stepNode?.data.status).toBe('pending');
    });

    it('should space steps with 180px vertical spacing', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          { id: 'step-1', name: 'Step 1', action: 'test', inputs: {} },
          { id: 'step-2', name: 'Step 2', action: 'test', inputs: {} },
          { id: 'step-3', name: 'Step 3', action: 'test', inputs: {} },
        ],
      };

      const { nodes } = workflowToGraph(workflow);
      const stepNodes = nodes.filter(n => n.type === 'step');

      // Check vertical spacing between steps
      const step1Y = stepNodes[0].position.y;
      const step2Y = stepNodes[1].position.y;
      const step3Y = stepNodes[2].position.y;

      expect(step2Y - step1Y).toBe(180);
      expect(step3Y - step2Y).toBe(180);
    });
  });

  describe('trigger nodes', () => {
    it('should add a trigger node when triggers are defined', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [{ id: 'step-1', action: 'http.get', inputs: {} }],
        triggers: [{ type: 'webhook' as const, path: '/api/trigger' }],
      };

      const { nodes, edges } = workflowToGraph(workflow);

      const triggerNode = nodes.find(n => n.type === 'trigger');
      expect(triggerNode).toBeDefined();
      expect(triggerNode?.data.type).toBe('webhook');
      expect(triggerNode?.data.path).toBe('/api/trigger');

      // Should have edge from trigger to first step
      const triggerEdge = edges.find(e => e.source === triggerNode?.id && e.target === 'step-1');
      expect(triggerEdge).toBeDefined();
    });

    it('should handle schedule trigger with cron', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [{ id: 'step-1', action: 'http.get', inputs: {} }],
        triggers: [{ type: 'schedule' as const, cron: '0 9 * * *' }],
      };

      const { nodes } = workflowToGraph(workflow);
      const triggerNode = nodes.find(n => n.type === 'trigger');

      expect(triggerNode?.data.type).toBe('schedule');
      expect(triggerNode?.data.cron).toBe('0 9 * * *');
    });
  });

  describe('sub-workflow nodes', () => {
    it('should create subworkflow nodes for steps with workflow property', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          { id: 'step-1', action: 'http.get', inputs: {} },
          { id: 'sub-1', name: 'Sub Process', workflow: '/workflows/sub.md', inputs: {} },
        ],
      };

      const { nodes } = workflowToGraph(workflow);
      const subNode = nodes.find(n => n.id === 'sub-1');

      expect(subNode?.type).toBe('subworkflow');
      expect(subNode?.data.workflowPath).toBe('/workflows/sub.md');
    });
  });

  describe('output nodes', () => {
    it('should add output node at the end', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          { id: 'step-1', action: 'http.get', inputs: {}, outputVariable: 'result1' },
          { id: 'step-2', action: 'http.post', inputs: {}, outputVariable: 'result2' },
        ],
      };

      const { nodes, edges } = workflowToGraph(workflow);
      const outputNode = nodes.find(n => n.type === 'output');

      expect(outputNode).toBeDefined();
      expect(outputNode?.data.variables).toEqual(['result1', 'result2']);

      // Should have edge from last step to output
      const outputEdge = edges.find(e => e.source === 'step-2' && e.target === outputNode?.id);
      expect(outputEdge).toBeDefined();
    });
  });

  describe('variable dependency edges', () => {
    it('should create data flow edges for variable references', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          { id: 'step-1', action: 'http.get', inputs: {}, outputVariable: 'response' },
          { id: 'step-2', action: 'process', inputs: { data: '{{ response.body }}' } },
        ],
      };

      const { edges } = workflowToGraph(workflow);
      const dataEdge = edges.find(e => e.id.startsWith('data-') && e.source === 'step-1' && e.target === 'step-2');

      expect(dataEdge).toBeDefined();
      expect(dataEdge?.label).toBe('response');
      expect(dataEdge?.animated).toBe(true);
    });

    it('should not create edges for inputs references', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          { id: 'step-1', action: 'http.get', inputs: { url: '{{ inputs.url }}' } },
        ],
      };

      const { edges } = workflowToGraph(workflow);
      const dataEdges = edges.filter(e => e.id.startsWith('data-'));

      expect(dataEdges).toHaveLength(0);
    });
  });

  describe('conditional edges', () => {
    it('should label conditional edges', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          { id: 'step-1', action: 'check', inputs: {} },
          { id: 'step-2', action: 'process', inputs: {}, conditions: ['result.success == true'] },
        ],
      };

      const { edges } = workflowToGraph(workflow);
      const conditionalEdge = edges.find(e => e.source === 'step-1' && e.target === 'step-2');

      expect(conditionalEdge?.label).toBe('conditional');
    });
  });

  describe('node positioning', () => {
    it('should position nodes vertically', () => {
      const workflow = {
        metadata: { id: 'test-1', name: 'Test Workflow' },
        steps: [
          { id: 'step-1', action: 'a', inputs: {} },
          { id: 'step-2', action: 'b', inputs: {} },
          { id: 'step-3', action: 'c', inputs: {} },
        ],
      };

      const { nodes } = workflowToGraph(workflow);
      const stepNodes = nodes.filter(n => n.type === 'step');

      // Each step should be below the previous one
      expect(stepNodes[1].position.y).toBeGreaterThan(stepNodes[0].position.y);
      expect(stepNodes[2].position.y).toBeGreaterThan(stepNodes[1].position.y);
    });
  });
});

describe('graphToWorkflow', () => {
  it('should convert nodes back to workflow steps', () => {
    const nodes = [
      {
        id: 'step-1',
        type: 'step',
        position: { x: 250, y: 0 },
        data: { id: 'step-1', name: 'Step 1', action: 'http.get', inputs: {} },
      },
      {
        id: 'step-2',
        type: 'step',
        position: { x: 250, y: 120 },
        data: { id: 'step-2', name: 'Step 2', action: 'http.post', inputs: {}, outputVariable: 'result' },
      },
    ];

    const edges = [{ id: 'e-1-2', source: 'step-1', target: 'step-2' }];
    const metadata = { id: 'test', name: 'Test Workflow' };

    const workflow = graphToWorkflow(nodes, edges, metadata);

    expect(workflow.metadata).toEqual(metadata);
    expect(workflow.steps).toHaveLength(2);
    expect(workflow.steps[0].id).toBe('step-1');
    expect(workflow.steps[0].action).toBe('http.get');
    expect(workflow.steps[1].outputVariable).toBe('result');
  });

  it('should filter out trigger and output nodes', () => {
    const nodes = [
      { id: 'trigger-1', type: 'trigger', position: { x: 250, y: 0 }, data: { type: 'manual' } },
      { id: 'step-1', type: 'step', position: { x: 250, y: 120 }, data: { id: 'step-1', action: 'test', inputs: {} } },
      { id: 'output-1', type: 'output', position: { x: 250, y: 240 }, data: { variables: [] } },
    ];

    const workflow = graphToWorkflow(nodes, [], { id: 'test', name: 'Test' });

    expect(workflow.steps).toHaveLength(1);
    expect(workflow.steps[0].id).toBe('step-1');
  });

  it('should extract trigger info', () => {
    const nodes = [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 0 },
        data: { type: 'webhook', path: '/api/hook' },
      },
      { id: 'step-1', type: 'step', position: { x: 250, y: 120 }, data: { id: 'step-1', inputs: {} } },
    ];

    const workflow = graphToWorkflow(nodes, [], { id: 'test', name: 'Test' });

    expect(workflow.triggers).toHaveLength(1);
    expect(workflow.triggers?.[0].type).toBe('webhook');
    expect(workflow.triggers?.[0].path).toBe('/api/hook');
  });

  it('should sort steps by vertical position', () => {
    const nodes = [
      { id: 'step-3', type: 'step', position: { x: 250, y: 240 }, data: { id: 'step-3', inputs: {} } },
      { id: 'step-1', type: 'step', position: { x: 250, y: 0 }, data: { id: 'step-1', inputs: {} } },
      { id: 'step-2', type: 'step', position: { x: 250, y: 120 }, data: { id: 'step-2', inputs: {} } },
    ];

    const workflow = graphToWorkflow(nodes, [], { id: 'test', name: 'Test' });

    expect(workflow.steps[0].id).toBe('step-1');
    expect(workflow.steps[1].id).toBe('step-2');
    expect(workflow.steps[2].id).toBe('step-3');
  });

  it('should handle sub-workflow nodes', () => {
    const nodes = [
      {
        id: 'sub-1',
        type: 'subworkflow',
        position: { x: 250, y: 0 },
        data: { id: 'sub-1', name: 'Sub Workflow', workflowPath: '/sub.md', inputs: {} },
      },
    ];

    const workflow = graphToWorkflow(nodes, [], { id: 'test', name: 'Test' });

    expect(workflow.steps).toHaveLength(1);
    expect(workflow.steps[0].workflow).toBe('/sub.md');
  });
});

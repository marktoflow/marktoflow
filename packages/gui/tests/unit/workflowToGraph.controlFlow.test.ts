import { describe, it, expect } from 'vitest';
import { workflowToGraph } from '../../src/client/utils/workflowToGraph';
import { Node, Edge } from '@xyflow/react';

describe('workflowToGraph Control Flow', () => {
  describe('While Loop', () => {
    const pollingLoopMarkdown = 
      "# API Job Polling\n\n" +
      "```yaml\n" +
      "type: while\n" +
      "condition: \"job_status.state != 'completed'\"\n" +
      "max_iterations: 100\n" +
      "variables:\n" +
      "  job_status:\n" +
      "    initial: { state: 'pending' }\n" +
      "steps:\n" +
      "  - id: check_status\n" +
      "    name: 'Check Job Status'\n" +
      "    action: http.get\n" +
      "    inputs:\n" +
      "      url: \"{{ inputs.api_url }}\"\n" +
      "    output_variable: status_response\n\n" +
      "  - id: wait\n" +
      "    name: 'Wait'\n" +
      "    action: util.sleep\n" +
      "    inputs:\n" +
      "      seconds: 5\n" +
      "```";

    const workflowWithWhile = {
      metadata: { id: 'test-loop', name: 'Loop Workflow' },
      steps: [
        { id: 'init', name: 'Init', action: 'core.log', inputs: {} },
      ],
      markdown: pollingLoopMarkdown
    };

    it('should extract while loop from markdown and create a while node', () => {
      const { nodes } = workflowToGraph(workflowWithWhile);
      
      const whileNode = nodes.find(n => n.type === 'while');
      expect(whileNode).toBeDefined();
      expect(whileNode?.data.condition).toBe("job_status.state != 'completed'");
      expect(whileNode?.data.maxIterations).toBe(100);
    });

    it('should create nested nodes for steps inside the loop', () => {
      const { nodes } = workflowToGraph(workflowWithWhile);
      
      const checkStatusNode = nodes.find(n => n.id === 'check_status');
      const waitNode = nodes.find(n => n.id === 'wait');

      expect(checkStatusNode).toBeDefined();
      expect(waitNode).toBeDefined();
      
      // Check positioning: nested nodes should be to the right of the main flow
      const whileNode = nodes.find(n => n.type === 'while');
      expect(checkStatusNode?.position.x).toBeGreaterThan(whileNode!.position.x);
      expect(waitNode?.position.x).toBeGreaterThan(whileNode!.position.x);
    });

    it('should create correct edges for loop flow', () => {
      const { nodes, edges } = workflowToGraph(workflowWithWhile);
      
      const whileNode = nodes.find(n => n.type === 'while');
      const checkStatusNode = nodes.find(n => n.id === 'check_status');
      const waitNode = nodes.find(n => n.id === 'wait');

      // 1. Edge from While Node (Body) to First Nested Step
      const bodyEdge = edges.find(e => 
        e.source === whileNode?.id && 
        e.target === checkStatusNode?.id &&
        e.sourceHandle === 'body'
      );
      expect(bodyEdge).toBeDefined();
      expect(bodyEdge?.label).toBe('do');

      // 2. Edge between nested steps
      const nestedEdge = edges.find(e =>
        e.source === checkStatusNode?.id &&
        e.target === waitNode?.id
      );
      expect(nestedEdge).toBeDefined();

      // 3. Edge from Last Nested Step to While Node (Loop Back)
      const loopBackEdge = edges.find(e =>
        e.source === waitNode?.id &&
        e.target === whileNode?.id &&
        e.targetHandle === 'loop-back'
      );
      expect(loopBackEdge).toBeDefined();
    });

    it('should continue main flow after the loop', () => {
      const workflowWithAfterStep = {
        ...workflowWithWhile,
        steps: [
          { id: 'init', name: 'Init', action: 'core.log', inputs: {} },
        ]
      };

      const { nodes, edges } = workflowToGraph(workflowWithAfterStep);
      const whileNode = nodes.find(n => n.type === 'while');
      const outputNode = nodes.find(n => n.type === 'output');

      // Edge from While Node (Exit) to Output (or next step)
      const exitEdge = edges.find(e =>
        e.source === whileNode?.id &&
        e.target === outputNode?.id
      );
      expect(exitEdge).toBeDefined();
    });
  });

  describe('For Each Loop', () => {
    const forEachMarkdown = 
      "# Processing Items\n\n" +
      "```yaml\n" +
      "type: for_each\n" +
      "items: \"{{ inputs.items }}\"\n" +
      "item_variable: item\n" +
      "steps:\n" +
      "  - id: process_item\n" +
      "    name: 'Process Item'\n" +
      "    action: process\n" +
      "    inputs:\n" +
      "      data: \"{{ item }}\"\n" +
      "```";

    const workflow = {
      metadata: { id: 'test-foreach', name: 'ForEach Workflow' },
      steps: [],
      markdown: forEachMarkdown
    };

    it('should extract for_each loop and create nested structure', () => {
      const { nodes, edges } = workflowToGraph(workflow);
      
      const forEachNode = nodes.find(n => n.type === 'for_each');
      const processNode = nodes.find(n => n.id === 'process_item');

      expect(forEachNode).toBeDefined();
      expect(processNode).toBeDefined();
      
      // Check hierarchical positioning
      expect(processNode?.position.x).toBeGreaterThan(forEachNode!.position.x);

      // Check edges
      // ForEach(body) -> Process
      const bodyEdge = edges.find(e => 
        e.source === forEachNode?.id && 
        e.target === processNode?.id &&
        e.sourceHandle === 'body'
      );
      expect(bodyEdge).toBeDefined();
      expect(bodyEdge?.label).toBe('each');

      // Process -> ForEach(loop-back)
      const loopBackEdge = edges.find(e =>
        e.source === processNode?.id &&
        e.target === forEachNode?.id &&
        e.targetHandle === 'loop-back'
      );
      expect(loopBackEdge).toBeDefined();
    });
  });

  describe('Complex Nested Loops', () => {
    const nestedLoopMarkdown = 
      "```yaml\n" +
      "type: while\n" +
      "condition: \"outer\"\n" +
      "steps:\n" +
      "  - id: outer_1\n" +
      "    action: log\n" +
      "  \n" +
      "  - type: while\n" +
      "    condition: \"inner\"\n" +
      "    steps:\n" +
      "      - id: inner_1\n" +
      "        action: log\n" +
      "```";

     const workflow = {
      metadata: { id: 'nested', name: 'Nested' },
      steps: [],
      markdown: nestedLoopMarkdown
    };

    it('should handle nested loops recursively', () => {
      const { nodes, edges } = workflowToGraph(workflow);

      const outerWhile = nodes.find(n => n.data.condition === 'outer');
      const innerWhile = nodes.find(n => n.data.condition === 'inner');
      const innerStep = nodes.find(n => n.id === 'inner_1');

      expect(outerWhile).toBeDefined();
      expect(innerWhile).toBeDefined();
      expect(innerStep).toBeDefined();

      // Inner while should be to the right of outer while
      expect(innerWhile!.position.x).toBeGreaterThan(outerWhile!.position.x);
      
      // Inner step should be to the right of inner while
      expect(innerStep!.position.x).toBeGreaterThan(innerWhile!.position.x);

      // Check connections
      // Outer -> Outer_1
      const e1 = edges.find(e => e.source === outerWhile?.id && e.target === 'outer_1');
      expect(e1).toBeDefined();

      // Outer_1 -> Inner While
      const e2 = edges.find(e => e.source === 'outer_1' && e.target === innerWhile?.id);
      expect(e2).toBeDefined();

      // Inner While -> Inner Step
      const e3 = edges.find(e => e.source === innerWhile?.id && e.target === innerStep?.id);
      expect(e3).toBeDefined();
    });
  });

  describe('Map/Filter/Reduce', () => {
    const dataPipelineMarkdown = 
      "# E-commerce Data Pipeline\n\n" +
      "```yaml\n" +
      "type: map\n" +
      "items: \"{{ orders_response.data.orders }}\"\n" +
      "item_variable: order\n" +
      "expression: \"{{ order }}\"\n" +
      "output_variable: orders\n" +
      "```\n\n" +
      "```yaml\n" +
      "type: filter\n" +
      "items: \"{{ orders }}\"\n" +
      "item_variable: order\n" +
      "condition: \"order.amount >= inputs.threshold\"\n" +
      "output_variable: high_value_orders\n" +
      "```\n\n" +
      "```yaml\n" +
      "type: reduce\n" +
      "items: \"{{ high_value_orders }}\"\n" +
      "item_variable: order\n" +
      "accumulator_variable: total\n" +
      "initial_value: 0\n" +
      "expression: \"{{ total }} + {{ order.amount }}\"\n" +
      "output_variable: total_revenue\n" +
      "```";

    const workflow = {
      metadata: { id: 'data-pipeline', name: 'Data Pipeline' },
      steps: [],
      markdown: dataPipelineMarkdown
    };

    it('should correctly extract items property for transform nodes', () => {
      const { nodes } = workflowToGraph(workflow);

      const mapNode = nodes.find(n => n.type === 'map');
      const filterNode = nodes.find(n => n.type === 'filter');
      const reduceNode = nodes.find(n => n.type === 'reduce');

      expect(mapNode).toBeDefined();
      expect(filterNode).toBeDefined();
      expect(reduceNode).toBeDefined();

      expect(mapNode?.data.items).toBe("{{ orders_response.data.orders }}");
      expect(filterNode?.data.items).toBe("{{ orders }}");
      expect(reduceNode?.data.items).toBe("{{ high_value_orders }}");
    });

    it('should handle "unknown" items by defaulting to "[]"', () => {
      const markdown = `
\`\`\`yaml
type: map
items: unknown
\`\`\`
`;
      const workflow = {
        metadata: { id: 'test', name: 'Test' },
        steps: [],
        markdown
      };

      const { nodes } = workflowToGraph(workflow);
      const mapNode = nodes.find(n => n.type === 'map');
      
      expect(mapNode?.data.items).toBe('[]');
    });
  });
});
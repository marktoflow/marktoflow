import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { TransformNode, type TransformNodeData } from '../../src/client/components/Canvas/TransformNode';

const createMockNode = (data: Partial<TransformNodeData> = {}) => ({
  id: 'transform-1',
  type: 'map' as const,
  position: { x: 0, y: 0 },
  data: {
    id: 'transform-1',
    name: 'Transform Data',
    transformType: 'map' as const,
    items: '{{ orders }}',
    itemVariable: 'order',
    expression: '{{ order.total }}',
    status: 'pending' as const,
    ...data,
  },
});

const renderNode = (data: Partial<TransformNodeData> = {}) => {
  const node = createMockNode(data);
  return render(
    <ReactFlowProvider>
      <TransformNode
        id={node.id}
        type={node.type}
        data={node.data}
        selected={false}
        isConnectable={true}
        zIndex={0}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        dragging={false}
      />
    </ReactFlowProvider>
  );
};

describe('TransformNode', () => {
  it('should render node with name and transform type', () => {
    renderNode();

    expect(screen.getByText('Transform Data')).toBeInTheDocument();
    expect(screen.getByText('Transform')).toBeInTheDocument();
  });

  describe('transform types', () => {
    it('should render map type with default name', () => {
      renderNode({ transformType: 'map', name: undefined });

      expect(screen.getByText('Map')).toBeInTheDocument();
    });

    it('should render filter type with default name', () => {
      renderNode({ transformType: 'filter', name: undefined });

      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    it('should render reduce type with default name', () => {
      renderNode({ transformType: 'reduce', name: undefined });

      expect(screen.getByText('Reduce')).toBeInTheDocument();
    });

    it('should display map description', () => {
      renderNode({ transformType: 'map' });

      expect(screen.getByText('Transforms each item')).toBeInTheDocument();
    });

    it('should display filter description', () => {
      renderNode({ transformType: 'filter' });

      expect(screen.getByText('Selects matching items')).toBeInTheDocument();
    });

    it('should display reduce description', () => {
      renderNode({ transformType: 'reduce' });

      expect(screen.getByText('Aggregates to single value')).toBeInTheDocument();
    });
  });

  describe('status states', () => {
    it('should render pending status', () => {
      renderNode({ status: 'pending' });

      const node = screen.getByText('Transform Data').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render running status with animation', () => {
      renderNode({ status: 'running' });

      const node = screen.getByText('Transform Data').closest('.control-flow-node');
      expect(node).toHaveClass('running');
    });

    it('should render completed status', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Transform Data').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });
  });

  describe('items and variable display', () => {
    it('should display items source', () => {
      renderNode({ items: '{{ orders }}' });

      expect(screen.getByText('Items:')).toBeInTheDocument();
      expect(screen.getByText('{{ orders }}')).toBeInTheDocument();
    });

    it('should display "Not set" when items is empty', () => {
      renderNode({ items: '' });

      expect(screen.getByText('Not set')).toBeInTheDocument();
    });

    it('should display item variable', () => {
      renderNode({ itemVariable: 'order' });

      expect(screen.getByText('Variable:')).toBeInTheDocument();
      expect(screen.getByText('order')).toBeInTheDocument();
    });

    it('should display default variable when not provided', () => {
      renderNode({ itemVariable: undefined });

      expect(screen.getByText('item')).toBeInTheDocument();
    });
  });

  describe('expression/condition display', () => {
    it('should display expression for map type', () => {
      renderNode({
        transformType: 'map',
        expression: '{{ order.total }}',
      });

      expect(screen.getByText('Expression')).toBeInTheDocument();
      expect(screen.getByText('{{ order.total }}')).toBeInTheDocument();
    });

    it('should display condition for filter type', () => {
      renderNode({
        transformType: 'filter',
        condition: '{{ item.price > 100 }}',
      });

      expect(screen.getByText('Condition')).toBeInTheDocument();
      expect(screen.getByText('{{ item.price > 100 }}')).toBeInTheDocument();
    });

    it('should display reducer for reduce type', () => {
      renderNode({
        transformType: 'reduce',
        expression: '{{ acc + item }}',
        accumulatorVariable: 'acc',
      });

      expect(screen.getByText('Reducer')).toBeInTheDocument();
      expect(screen.getByText('acc: {{ acc + item }}')).toBeInTheDocument();
    });

    it('should display "Not set" when expression is missing', () => {
      renderNode({
        transformType: 'map',
        expression: undefined,
      });

      expect(screen.getByText('Not set')).toBeInTheDocument();
    });
  });

  describe('reduce-specific fields', () => {
    it('should display accumulator variable for reduce', () => {
      renderNode({
        transformType: 'reduce',
        accumulatorVariable: 'sum',
        expression: '{{ sum + item.value }}',
      });

      expect(screen.getByText('sum: {{ sum + item.value }}')).toBeInTheDocument();
    });

    it('should display initial value when provided', () => {
      renderNode({
        transformType: 'reduce',
        initialValue: 0,
      });

      expect(screen.getByText('Initial:')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display complex initial values', () => {
      renderNode({
        transformType: 'reduce',
        initialValue: { count: 0, total: 0 },
      });

      expect(screen.getByText('{"count":0,"total":0}')).toBeInTheDocument();
    });

    it('should not display initial value for non-reduce types', () => {
      renderNode({
        transformType: 'map',
        initialValue: 0,
      });

      expect(screen.queryByText('Initial:')).not.toBeInTheDocument();
    });
  });

  describe('input/output count', () => {
    it('should display input and output counts when provided', () => {
      renderNode({
        inputCount: 10,
        outputCount: 5,
      });

      expect(screen.getByText('In:')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Out:')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display "?" for missing counts when at least one is defined', () => {
      renderNode({
        inputCount: 10,
        outputCount: undefined,
      });

      expect(screen.getByText('10')).toBeInTheDocument();
      // The '?' will be rendered for undefined outputCount
      expect(screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && content === '?';
      })).toBeInTheDocument();
    });

    it('should not display count section when both counts are undefined', () => {
      renderNode({
        inputCount: undefined,
        outputCount: undefined,
      });

      // Count section should not be rendered at all
      expect(screen.queryByText('In:')).not.toBeInTheDocument();
      expect(screen.queryByText('Out:')).not.toBeInTheDocument();
    });

    it('should display mixed defined/undefined counts', () => {
      renderNode({
        inputCount: 10,
        outputCount: undefined,
      });

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && content === '?';
      })).toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('should have teal/cyan gradient background', () => {
      renderNode();

      const node = screen.getByText('Transform Data').closest('.control-flow-node');
      expect(node).toHaveStyle({
        background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
      });
    });

    it('should display items with monospace font', () => {
      renderNode();

      const itemsElement = screen.getByText('{{ orders }}');
      expect(itemsElement).toHaveClass('font-mono');
    });

    it('should display variable with monospace font', () => {
      renderNode();

      const variableElement = screen.getByText('order');
      expect(variableElement).toHaveClass('font-mono');
    });

    it('should display expression with monospace font', () => {
      renderNode();

      const expressionElement = screen.getByText('{{ order.total }}');
      expect(expressionElement).toHaveClass('font-mono');
    });
  });

  describe('selection state', () => {
    it('should apply selected class when selected', () => {
      const node = createMockNode();
      const { container } = render(
        <ReactFlowProvider>
          <TransformNode
            id={node.id}
            type={node.type}
            data={node.data}
            selected={true}
            isConnectable={true}
            zIndex={0}
            positionAbsoluteX={0}
            positionAbsoluteY={0}
            dragging={false}
          />
        </ReactFlowProvider>
      );

      const nodeElement = container.querySelector('.control-flow-node');
      expect(nodeElement).toHaveClass('selected');
    });
  });

  describe('complete transform examples', () => {
    it('should render complete map transformation', () => {
      renderNode({
        name: undefined,
        transformType: 'map',
        items: '{{ users }}',
        itemVariable: 'user',
        expression: '{{ user.email }}',
        inputCount: 100,
        outputCount: 100,
      });

      expect(screen.getByText('Map')).toBeInTheDocument();
      expect(screen.getByText('{{ users }}')).toBeInTheDocument();
      expect(screen.getByText('user')).toBeInTheDocument();
      expect(screen.getByText('{{ user.email }}')).toBeInTheDocument();
      const counts = screen.getAllByText('100');
      expect(counts).toHaveLength(2); // Both input and output are 100
    });

    it('should render complete filter transformation', () => {
      renderNode({
        name: undefined,
        transformType: 'filter',
        items: '{{ products }}',
        itemVariable: 'product',
        condition: '{{ product.inStock }}',
        inputCount: 50,
        outputCount: 30,
      });

      expect(screen.getByText('Filter')).toBeInTheDocument();
      expect(screen.getByText('{{ products }}')).toBeInTheDocument();
      expect(screen.getByText('product')).toBeInTheDocument();
      expect(screen.getByText('{{ product.inStock }}')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('should render complete reduce transformation', () => {
      renderNode({
        name: undefined,
        transformType: 'reduce',
        items: '{{ numbers }}',
        itemVariable: 'num',
        accumulatorVariable: 'sum',
        initialValue: 0,
        expression: '{{ sum + num }}',
        inputCount: 10,
        outputCount: 1,
      });

      expect(screen.getByText('Reduce')).toBeInTheDocument();
      expect(screen.getByText('{{ numbers }}')).toBeInTheDocument();
      expect(screen.getByText('num')).toBeInTheDocument();
      expect(screen.getByText('sum: {{ sum + num }}')).toBeInTheDocument();
      expect(screen.getByText('Initial:')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});

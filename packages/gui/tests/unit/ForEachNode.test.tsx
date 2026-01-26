import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ForEachNode, type ForEachNodeData } from '../../src/client/components/Canvas/ForEachNode';

const createMockNode = (data: Partial<ForEachNodeData> = {}) => ({
  id: 'foreach-1',
  type: 'for_each' as const,
  position: { x: 0, y: 0 },
  data: {
    id: 'foreach-1',
    name: 'Process Orders',
    items: '{{ orders }}',
    itemVariable: 'order',
    status: 'pending' as const,
    ...data,
  },
});

const renderNode = (data: Partial<ForEachNodeData> = {}) => {
  const node = createMockNode(data);
  return render(
    <ReactFlowProvider>
      <ForEachNode
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

describe('ForEachNode', () => {
  it('should render node with name, items, and variable', () => {
    renderNode();

    expect(screen.getByText('Process Orders')).toBeInTheDocument();
    expect(screen.getByText('{{ orders }}')).toBeInTheDocument();
    expect(screen.getByText('order')).toBeInTheDocument();
    expect(screen.getByText('Loop')).toBeInTheDocument();
  });

  it('should render default name when name is not provided', () => {
    renderNode({ name: undefined });

    expect(screen.getByText('For Each')).toBeInTheDocument();
  });

  it('should render default item variable when not provided', () => {
    renderNode({ itemVariable: undefined });

    expect(screen.getByText('item')).toBeInTheDocument();
  });

  it('should display items and variable labels', () => {
    renderNode();

    expect(screen.getByText('Items:')).toBeInTheDocument();
    expect(screen.getByText('Variable:')).toBeInTheDocument();
  });

  describe('status states', () => {
    it('should render pending status', () => {
      renderNode({ status: 'pending' });

      const node = screen.getByText('Process Orders').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render running status with animation', () => {
      renderNode({ status: 'running' });

      const node = screen.getByText('Process Orders').closest('.control-flow-node');
      expect(node).toHaveClass('running');
    });

    it('should render completed status', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Process Orders').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render failed status', () => {
      renderNode({ status: 'failed' });

      const node = screen.getByText('Process Orders').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });
  });

  describe('iteration progress', () => {
    it('should display progress when totalIterations is provided', () => {
      renderNode({
        currentIteration: 5,
        totalIterations: 10,
      });

      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('5 / 10')).toBeInTheDocument();
    });

    it('should display progress bar with correct width', () => {
      const { container } = renderNode({
        currentIteration: 5,
        totalIterations: 10,
      });

      const progressBar = container.querySelector('.bg-orange-400');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should display 0% progress when currentIteration is 0', () => {
      const { container } = renderNode({
        currentIteration: 0,
        totalIterations: 10,
      });

      const progressBar = container.querySelector('.bg-orange-400');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should display 100% progress when completed', () => {
      const { container } = renderNode({
        currentIteration: 10,
        totalIterations: 10,
      });

      const progressBar = container.querySelector('.bg-orange-400');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should not display progress when totalIterations is undefined', () => {
      renderNode({ currentIteration: 5, totalIterations: undefined });

      expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    });
  });

  describe('loop metadata', () => {
    it('should display loop metadata information', () => {
      renderNode();

      expect(screen.getByText('ℹ️')).toBeInTheDocument();
      expect(screen.getByText('Access: loop.index, loop.first, loop.last')).toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('should have pink/red gradient background', () => {
      renderNode();

      const node = screen.getByText('Process Orders').closest('.control-flow-node');
      expect(node).toHaveStyle({
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
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
  });

  describe('selection state', () => {
    it('should apply selected class when selected', () => {
      const node = createMockNode();
      const { container } = render(
        <ReactFlowProvider>
          <ForEachNode
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

  describe('items display', () => {
    it('should display "Not set" when items is empty', () => {
      renderNode({ items: '' });

      expect(screen.getByText('Not set')).toBeInTheDocument();
    });

    it('should display complex template expressions', () => {
      const complexItems = '{{ data.orders.filter(o => o.active) }}';
      renderNode({ items: complexItems });

      expect(screen.getByText(complexItems)).toBeInTheDocument();
    });
  });
});

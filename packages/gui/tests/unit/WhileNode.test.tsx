import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { WhileNode, type WhileNodeData } from '../../src/client/components/Canvas/WhileNode';

const createMockNode = (data: Partial<WhileNodeData> = {}) => ({
  id: 'while-1',
  type: 'while' as const,
  position: { x: 0, y: 0 },
  data: {
    id: 'while-1',
    name: 'Retry API',
    condition: '{{ retries < 3 }}',
    maxIterations: 10,
    status: 'pending' as const,
    ...data,
  },
});

const renderNode = (data: Partial<WhileNodeData> = {}) => {
  const node = createMockNode(data);
  return render(
    <ReactFlowProvider>
      <WhileNode
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

describe('WhileNode', () => {
  it('should render node with name, condition, and max iterations', () => {
    renderNode();

    expect(screen.getByText('Retry API')).toBeInTheDocument();
    expect(screen.getByText('Loop')).toBeInTheDocument();
    expect(screen.getByText('{{ retries < 3 }}')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should render default name when name is not provided', () => {
    renderNode({ name: undefined });

    expect(screen.getByText('While')).toBeInTheDocument();
  });

  it('should display condition label', () => {
    renderNode();

    expect(screen.getByText('Condition:')).toBeInTheDocument();
  });

  it('should display "Not set" when condition is empty', () => {
    renderNode({ condition: '' });

    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('should display max iterations label', () => {
    renderNode();

    expect(screen.getByText('Max Iterations:')).toBeInTheDocument();
  });

  it('should display default max iterations when not provided', () => {
    renderNode({ maxIterations: undefined });

    expect(screen.getByText('100')).toBeInTheDocument();
  });

  describe('status states', () => {
    it('should render pending status', () => {
      renderNode({ status: 'pending' });

      const node = screen.getByText('Retry API').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render running status with animation', () => {
      renderNode({ status: 'running' });

      const node = screen.getByText('Retry API').closest('.control-flow-node');
      expect(node).toHaveClass('running');
    });

    it('should render completed status', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Retry API').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render failed status', () => {
      renderNode({ status: 'failed' });

      const node = screen.getByText('Retry API').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });
  });

  describe('iteration progress', () => {
    it('should display current iteration when provided', () => {
      renderNode({
        currentIteration: 3,
        maxIterations: 10,
      });

      expect(screen.getByText('Iterations')).toBeInTheDocument();
      expect(screen.getByText('3 / 10')).toBeInTheDocument();
    });

    it('should display progress bar with correct width', () => {
      const { container } = renderNode({
        currentIteration: 5,
        maxIterations: 10,
      });

      const progressBar = container.querySelector('.bg-orange-400, .bg-orange-500');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('style', expect.stringContaining('50%'));
    });

    it('should display 0% progress when currentIteration is 0', () => {
      const { container } = renderNode({
        currentIteration: 0,
        maxIterations: 10,
      });

      const progressBar = container.querySelector('.bg-orange-400, .bg-orange-500');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('style', expect.stringContaining('0%'));
    });

    it('should display 100% progress when at max iterations', () => {
      const { container } = renderNode({
        currentIteration: 10,
        maxIterations: 10,
      });

      const progressBar = container.querySelector('.bg-orange-400, .bg-orange-500');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('style', expect.stringContaining('100%'));
    });

    it('should not display progress when currentIteration is undefined', () => {
      renderNode({ currentIteration: undefined });

      expect(screen.queryByText('Iterations')).not.toBeInTheDocument();
    });
  });

  describe('warning message', () => {
    it('should display exit condition warning', () => {
      renderNode();

      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(screen.getByText('Exits when condition becomes false')).toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('should have orange gradient background', () => {
      renderNode();

      const node = screen.getByText('Retry API').closest('.control-flow-node');
      expect(node).toHaveStyle({
        background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
      });
    });

    it('should display condition with monospace font', () => {
      renderNode();

      const conditionElement = screen.getByText('{{ retries < 3 }}');
      expect(conditionElement).toHaveClass('font-mono');
    });
  });

  describe('selection state', () => {
    it('should apply selected class when selected', () => {
      const node = createMockNode();
      const { container } = render(
        <ReactFlowProvider>
          <WhileNode
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

  describe('max iterations display', () => {
    it('should handle custom max iterations', () => {
      renderNode({ maxIterations: 50 });

      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should show progress against custom max iterations', () => {
      const { container } = renderNode({
        currentIteration: 25,
        maxIterations: 50,
      });

      expect(screen.getByText('25 / 50')).toBeInTheDocument();
      const progressBar = container.querySelector('.bg-orange-400, .bg-orange-500');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('style', expect.stringContaining('50%'));
    });
  });
});

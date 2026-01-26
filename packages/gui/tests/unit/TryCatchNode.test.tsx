import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { TryCatchNode, type TryCatchNodeData } from '../../src/client/components/Canvas/TryCatchNode';

const createMockNode = (data: Partial<TryCatchNodeData> = {}) => ({
  id: 'try-1',
  type: 'try' as const,
  position: { x: 0, y: 0 },
  data: {
    id: 'try-1',
    name: 'Resilient API',
    hasCatch: true,
    hasFinally: true,
    status: 'pending' as const,
    ...data,
  },
});

const renderNode = (data: Partial<TryCatchNodeData> = {}) => {
  const node = createMockNode(data);
  return render(
    <ReactFlowProvider>
      <TryCatchNode
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

describe('TryCatchNode', () => {
  it('should render node with name', () => {
    renderNode();

    expect(screen.getByText('Resilient API')).toBeInTheDocument();
    expect(screen.getByText('Error Handling')).toBeInTheDocument();
  });

  it('should render default name when name is not provided', () => {
    renderNode({ name: undefined });

    expect(screen.getByText('Try/Catch')).toBeInTheDocument();
  });

  describe('status states', () => {
    it('should render pending status', () => {
      renderNode({ status: 'pending' });

      const node = screen.getByText('Resilient API').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render running status with animation', () => {
      renderNode({ status: 'running' });

      const node = screen.getByText('Resilient API').closest('.control-flow-node');
      expect(node).toHaveClass('running');
    });

    it('should render completed status', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Resilient API').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render failed status', () => {
      renderNode({ status: 'failed' });

      const node = screen.getByText('Resilient API').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });
  });

  describe('branch indicators', () => {
    it('should always display try branch', () => {
      renderNode();

      expect(screen.getByText('✓ Try')).toBeInTheDocument();
    });

    it('should display catch branch when hasCatch is true', () => {
      renderNode({ hasCatch: true });

      expect(screen.getByText('⚠ Catch')).toBeInTheDocument();
    });

    it('should not display catch branch when hasCatch is false', () => {
      renderNode({ hasCatch: false });

      expect(screen.queryByText('⚠ Catch')).not.toBeInTheDocument();
    });

    it('should display finally branch when hasFinally is true', () => {
      renderNode({ hasFinally: true });

      expect(screen.getByText('⟳ Finally')).toBeInTheDocument();
    });

    it('should not display finally branch when hasFinally is false', () => {
      renderNode({ hasFinally: false });

      expect(screen.queryByText('⟳ Finally')).not.toBeInTheDocument();
    });
  });

  describe('active branch highlighting', () => {
    it('should highlight try branch when active', () => {
      renderNode({ activeBranch: 'try' });

      const tryBranch = screen.getByText('✓ Try');
      expect(tryBranch).toHaveClass('bg-blue-500/30', 'text-blue-200');
    });

    it('should highlight catch branch when active', () => {
      renderNode({ activeBranch: 'catch', hasCatch: true });

      const catchBranch = screen.getByText('⚠ Catch');
      expect(catchBranch).toHaveClass('bg-red-500/30', 'text-red-200');
    });

    it('should highlight finally branch when active', () => {
      renderNode({ activeBranch: 'finally', hasFinally: true });

      const finallyBranch = screen.getByText('⟳ Finally');
      expect(finallyBranch).toHaveClass('bg-purple-500/30', 'text-purple-200');
    });

    it('should not highlight inactive branches', () => {
      renderNode({ activeBranch: 'try' });

      const catchBranch = screen.getByText('⚠ Catch');
      expect(catchBranch).toHaveClass('bg-white/5', 'text-white/60');
    });
  });

  describe('error indicator', () => {
    it('should display error indicator when errorOccurred is true', () => {
      renderNode({ errorOccurred: true });

      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('should not display error indicator when errorOccurred is false', () => {
      renderNode({ errorOccurred: false });

      expect(screen.queryByText('Error occurred')).not.toBeInTheDocument();
    });

    it('should not display error indicator by default', () => {
      renderNode({ errorOccurred: undefined });

      expect(screen.queryByText('Error occurred')).not.toBeInTheDocument();
    });
  });

  describe('info message', () => {
    it('should display finally execution info', () => {
      renderNode();

      expect(screen.getByText('ℹ️')).toBeInTheDocument();
      expect(screen.getByText('Finally always executes')).toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('should have yellow/orange gradient background', () => {
      renderNode();

      const node = screen.getByText('Resilient API').closest('.control-flow-node');
      expect(node).toHaveStyle({
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      });
    });
  });

  describe('selection state', () => {
    it('should apply selected class when selected', () => {
      const node = createMockNode();
      const { container } = render(
        <ReactFlowProvider>
          <TryCatchNode
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

  describe('error indicator styling', () => {
    it('should display error indicator with red styling', () => {
      renderNode({ errorOccurred: true });

      const errorIndicator = screen.getByText('Error occurred').closest('.p-2');
      expect(errorIndicator).toHaveClass('bg-red-500/20', 'border-red-500/30');
    });
  });

  describe('minimal configuration', () => {
    it('should render with only try branch', () => {
      renderNode({ hasCatch: false, hasFinally: false });

      expect(screen.getByText('✓ Try')).toBeInTheDocument();
      expect(screen.queryByText('⚠ Catch')).not.toBeInTheDocument();
      expect(screen.queryByText('⟳ Finally')).not.toBeInTheDocument();
    });

    it('should render with try and catch only', () => {
      renderNode({ hasCatch: true, hasFinally: false });

      expect(screen.getByText('✓ Try')).toBeInTheDocument();
      expect(screen.getByText('⚠ Catch')).toBeInTheDocument();
      expect(screen.queryByText('⟳ Finally')).not.toBeInTheDocument();
    });

    it('should render with try and finally only', () => {
      renderNode({ hasCatch: false, hasFinally: true });

      expect(screen.getByText('✓ Try')).toBeInTheDocument();
      expect(screen.queryByText('⚠ Catch')).not.toBeInTheDocument();
      expect(screen.getByText('⟳ Finally')).toBeInTheDocument();
    });
  });
});

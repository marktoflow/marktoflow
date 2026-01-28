import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { IfElseNode, type IfElseNodeData } from '../../src/client/components/Canvas/IfElseNode';

const createMockNode = (data: Partial<IfElseNodeData> = {}) => ({
  id: 'if-1',
  type: 'if' as const,
  position: { x: 0, y: 0 },
  data: {
    id: 'if-1',
    name: 'Check Count',
    condition: '{{ count > 0 }}',
    status: 'pending' as const,
    ...data,
  },
});

const renderNode = (data: Partial<IfElseNodeData> = {}) => {
  const node = createMockNode(data);
  return render(
    <ReactFlowProvider>
      <IfElseNode
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

describe('IfElseNode', () => {
  it('should render node with name and condition', () => {
    renderNode();

    expect(screen.getByText('Check Count')).toBeInTheDocument();
    expect(screen.getByText('{{ count > 0 }}')).toBeInTheDocument();
    expect(screen.getByText('Conditional')).toBeInTheDocument();
  });

  it('should render default name when name is not provided', () => {
    renderNode({ name: undefined });

    expect(screen.getByText('If/Else')).toBeInTheDocument();
  });

  it('should display condition with monospace font', () => {
    renderNode();

    const conditionElement = screen.getByText('{{ count > 0 }}');
    expect(conditionElement).toHaveClass('font-mono');
  });

  describe('status states', () => {
    it('should render pending status', () => {
      renderNode({ status: 'pending' });

      // Should have Clock icon for pending status
      const node = screen.getByText('Check Count').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render running status with animation', () => {
      renderNode({ status: 'running' });

      const node = screen.getByText('Check Count').closest('.control-flow-node');
      expect(node).toHaveClass('running');
    });

    it('should render completed status', () => {
      renderNode({ status: 'completed' });

      // Status should be completed
      const node = screen.getByText('Check Count').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render failed status', () => {
      renderNode({ status: 'failed' });

      const node = screen.getByText('Check Count').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render skipped status', () => {
      renderNode({ status: 'skipped' });

      const node = screen.getByText('Check Count').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });
  });

  describe('active branch highlighting', () => {
    it('should highlight then branch when active', () => {
      renderNode({ activeBranch: 'then' });

      const thenBranch = screen.getByText('✓ Then');
      expect(thenBranch).toHaveClass('bg-green-500/30', 'text-green-200');
    });

    it('should highlight else branch when active', () => {
      renderNode({ activeBranch: 'else' });

      const elseBranch = screen.getByText('✗ Else');
      expect(elseBranch).toHaveClass('bg-red-500/30', 'text-red-200');
    });

    it('should not highlight branches when no active branch', () => {
      renderNode({ activeBranch: null });

      const thenBranch = screen.getByText('✓ Then');
      const elseBranch = screen.getByText('✗ Else');

      expect(thenBranch).toHaveClass('bg-white/5', 'text-white/60');
      expect(elseBranch).toHaveClass('bg-white/5', 'text-white/60');
    });
  });

  describe('branch outputs', () => {
    it('should display both then and else branches', () => {
      renderNode();

      expect(screen.getByText('✓ Then')).toBeInTheDocument();
      expect(screen.getByText('✗ Else')).toBeInTheDocument();
    });

    it('should have gradient background', () => {
      renderNode();

      const node = screen.getByText('Check Count').closest('.control-flow-node');
      expect(node).toHaveStyle({
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      });
    });
  });

  describe('selection state', () => {
    it('should apply selected class when selected', () => {
      const node = createMockNode();
      const { container } = render(
        <ReactFlowProvider>
          <IfElseNode
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

    it('should not apply selected class when not selected', () => {
      const { container } = renderNode();

      const nodeElement = container.querySelector('.control-flow-node');
      expect(nodeElement).not.toHaveClass('selected');
    });
  });

  describe('condition display', () => {
    it('should display "No condition set" when condition is empty', () => {
      renderNode({ condition: '' });

      expect(screen.getByText('No condition set')).toBeInTheDocument();
    });

    it('should display complex conditions correctly', () => {
      const complexCondition = '{{ priority === "critical" && assignee !== null }}';
      renderNode({ condition: complexCondition });

      expect(screen.getByText(complexCondition)).toBeInTheDocument();
    });
  });

  describe('skipped branch indicators', () => {
    it('should show SKIP badge on skipped then branch', () => {
      renderNode({ skippedBranch: 'then' });

      expect(screen.getByText('SKIP')).toBeInTheDocument();
      const thenBranch = screen.getByText('✓ Then');
      expect(thenBranch).toHaveClass('bg-gray-500/20', 'text-gray-400');
    });

    it('should show SKIP badge on skipped else branch', () => {
      renderNode({ skippedBranch: 'else' });

      expect(screen.getByText('SKIP')).toBeInTheDocument();
      const elseBranch = screen.getByText('✗ Else');
      expect(elseBranch).toHaveClass('bg-gray-500/20', 'text-gray-400');
    });

    it('should highlight active branch with ring when one is active', () => {
      renderNode({ activeBranch: 'then' });

      const thenBranch = screen.getByText('✓ Then');
      expect(thenBranch).toHaveClass('ring-1', 'ring-green-400/50');
    });

    it('should not show SKIP when no branch is skipped', () => {
      renderNode({ skippedBranch: null });

      expect(screen.queryByText('SKIP')).not.toBeInTheDocument();
    });
  });

  describe('completed and failed states', () => {
    it('should show completed class on node', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Check Count').closest('.control-flow-node');
      expect(node).toHaveClass('completed');
    });

    it('should show failed class on node', () => {
      renderNode({ status: 'failed' });

      const node = screen.getByText('Check Count').closest('.control-flow-node');
      expect(node).toHaveClass('failed');
    });
  });
});

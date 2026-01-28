import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ParallelNode, type ParallelNodeData } from '../../src/client/components/Canvas/ParallelNode';

const createMockNode = (data: Partial<ParallelNodeData> = {}) => ({
  id: 'parallel-1',
  type: 'parallel' as const,
  position: { x: 0, y: 0 },
  data: {
    id: 'parallel-1',
    name: 'Fetch Data',
    branches: [
      { id: 'branch-1', name: 'Jira' },
      { id: 'branch-2', name: 'GitHub' },
      { id: 'branch-3', name: 'Slack' },
    ],
    maxConcurrent: 3,
    onError: 'stop' as const,
    status: 'pending' as const,
    ...data,
  },
});

const renderNode = (data: Partial<ParallelNodeData> = {}) => {
  const node = createMockNode(data);
  return render(
    <ReactFlowProvider>
      <ParallelNode
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

describe('ParallelNode', () => {
  it('should render node with name and branches', () => {
    renderNode();

    expect(screen.getByText('Fetch Data')).toBeInTheDocument();
    expect(screen.getByText('Concurrent Execution')).toBeInTheDocument();
    expect(screen.getByText('Jira')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Slack')).toBeInTheDocument();
  });

  it('should render default name when name is not provided', () => {
    renderNode({ name: undefined });

    expect(screen.getByText('Parallel')).toBeInTheDocument();
  });

  it('should display branch count', () => {
    renderNode();

    expect(screen.getByText('Branches:')).toBeInTheDocument();
    const branchCounts = screen.getAllByText('3');
    expect(branchCounts.length).toBeGreaterThan(0);
  });

  it('should display max concurrent limit when provided', () => {
    renderNode({ maxConcurrent: 5 });

    expect(screen.getByText(/Max Concurrent:/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should not display max concurrent when not provided', () => {
    renderNode({ maxConcurrent: undefined });

    expect(screen.queryByText(/Max Concurrent:/)).not.toBeInTheDocument();
  });

  describe('status states', () => {
    it('should render pending status', () => {
      renderNode({ status: 'pending' });

      const node = screen.getByText('Fetch Data').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render running status with animation', () => {
      renderNode({ status: 'running' });

      const node = screen.getByText('Fetch Data').closest('.control-flow-node');
      expect(node).toHaveClass('running');
    });

    it('should render completed status', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Fetch Data').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });
  });

  describe('branch status indicators', () => {
    it('should highlight active branches', () => {
      renderNode({
        activeBranches: ['branch-1', 'branch-2'],
      });

      const jiraBranch = screen.getByText('Jira');
      const githubBranch = screen.getByText('GitHub');

      expect(jiraBranch).toHaveClass('bg-blue-500/30', 'text-blue-200', 'animate-pulse');
      expect(githubBranch).toHaveClass('bg-blue-500/30', 'text-blue-200', 'animate-pulse');
    });

    it('should highlight completed branches', () => {
      renderNode({
        completedBranches: ['branch-1'],
      });

      const jiraBranch = screen.getByText('Jira');
      expect(jiraBranch).toHaveClass('bg-green-500/30', 'text-green-200');
    });

    it('should show inactive branches without highlighting', () => {
      renderNode({
        activeBranches: [],
        completedBranches: [],
      });

      const jiraBranch = screen.getByText('Jira');
      expect(jiraBranch).toHaveClass('bg-white/10', 'text-white/60');
    });

    it('should prioritize completed over active status', () => {
      renderNode({
        activeBranches: ['branch-1'],
        completedBranches: ['branch-1'],
      });

      const jiraBranch = screen.getByText('Jira');
      expect(jiraBranch).toHaveClass('bg-green-500/30', 'text-green-200');
      expect(jiraBranch).not.toHaveClass('animate-pulse');
    });
  });

  describe('branch display', () => {
    it('should display up to 6 branches', () => {
      renderNode({
        branches: [
          { id: 'b1', name: 'Branch 1' },
          { id: 'b2', name: 'Branch 2' },
          { id: 'b3', name: 'Branch 3' },
          { id: 'b4', name: 'Branch 4' },
          { id: 'b5', name: 'Branch 5' },
          { id: 'b6', name: 'Branch 6' },
        ],
      });

      expect(screen.getByText('Branch 1')).toBeInTheDocument();
      expect(screen.getByText('Branch 6')).toBeInTheDocument();
      expect(screen.queryByText('+1')).not.toBeInTheDocument();
    });

    it('should show "+N more" for branches beyond 6', () => {
      renderNode({
        branches: [
          { id: 'b1', name: 'Branch 1' },
          { id: 'b2', name: 'Branch 2' },
          { id: 'b3', name: 'Branch 3' },
          { id: 'b4', name: 'Branch 4' },
          { id: 'b5', name: 'Branch 5' },
          { id: 'b6', name: 'Branch 6' },
          { id: 'b7', name: 'Branch 7' },
          { id: 'b8', name: 'Branch 8' },
        ],
      });

      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.queryByText('Branch 7')).not.toBeInTheDocument();
    });

    it('should use branch id when name is not provided', () => {
      renderNode({
        branches: [{ id: 'branch-xyz', name: undefined }],
      });

      // Should display last 2 characters of id as "Byz"
      expect(screen.getByText('Byz')).toBeInTheDocument();
    });
  });

  describe('error handling display', () => {
    it('should display error handling policy', () => {
      renderNode({ onError: 'stop' });

      expect(screen.getByText('On Error:')).toBeInTheDocument();
      expect(screen.getByText('stop')).toBeInTheDocument();
    });

    it('should display continue policy', () => {
      renderNode({ onError: 'continue' });

      expect(screen.getByText('continue')).toBeInTheDocument();
    });

    it('should display default stop policy when not provided', () => {
      renderNode({ onError: undefined });

      expect(screen.getByText('stop')).toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('should have blue/cyan gradient background', () => {
      renderNode();

      const node = screen.getByText('Fetch Data').closest('.control-flow-node');
      expect(node).toHaveStyle({
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      });
    });
  });

  describe('selection state', () => {
    it('should apply selected class when selected', () => {
      const node = createMockNode();
      const { container } = render(
        <ReactFlowProvider>
          <ParallelNode
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

  describe('empty branches', () => {
    it('should display 0 branches when array is empty', () => {
      renderNode({ branches: [] });

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle undefined branches', () => {
      renderNode({ branches: undefined });

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('failed branches', () => {
    it('should highlight failed branches in red', () => {
      renderNode({
        failedBranches: ['branch-1'],
      });

      const jiraBranch = screen.getByText('Jira');
      expect(jiraBranch).toHaveClass('bg-red-500/30', 'text-red-200');
    });

    it('should prioritize failed over completed and active', () => {
      renderNode({
        activeBranches: ['branch-1'],
        completedBranches: ['branch-1'],
        failedBranches: ['branch-1'],
      });

      const jiraBranch = screen.getByText('Jira');
      expect(jiraBranch).toHaveClass('bg-red-500/30', 'text-red-200');
      expect(jiraBranch).not.toHaveClass('bg-green-500/30');
      expect(jiraBranch).not.toHaveClass('animate-pulse');
    });
  });

  describe('max concurrent exceeded', () => {
    it('should show rate limiting warning when maxConcurrentExceeded is true', () => {
      renderNode({
        maxConcurrent: 2,
        maxConcurrentExceeded: true,
      });

      expect(screen.getByText('Rate limiting active')).toBeInTheDocument();
    });

    it('should highlight max concurrent value in yellow when exceeded', () => {
      renderNode({
        maxConcurrent: 2,
        maxConcurrentExceeded: true,
      });

      const maxValue = screen.getByText('2');
      expect(maxValue).toHaveClass('text-yellow-300');
    });

    it('should not show warning when maxConcurrentExceeded is false', () => {
      renderNode({
        maxConcurrent: 2,
        maxConcurrentExceeded: false,
      });

      expect(screen.queryByText('Rate limiting active')).not.toBeInTheDocument();
    });

    it('should not highlight max concurrent value when not exceeded', () => {
      renderNode({
        maxConcurrent: 2,
        maxConcurrentExceeded: false,
      });

      const maxValue = screen.getByText('2');
      expect(maxValue).not.toHaveClass('text-yellow-300');
    });
  });

  describe('completed and failed states', () => {
    it('should show completed class on node', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Fetch Data').closest('.control-flow-node');
      expect(node).toHaveClass('completed');
    });

    it('should show failed class on node', () => {
      renderNode({ status: 'failed' });

      const node = screen.getByText('Fetch Data').closest('.control-flow-node');
      expect(node).toHaveClass('failed');
    });
  });
});

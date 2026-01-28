import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { SwitchNode, type SwitchNodeData } from '../../src/client/components/Canvas/SwitchNode';

const createMockNode = (data: Partial<SwitchNodeData> = {}) => ({
  id: 'switch-1',
  type: 'switch' as const,
  position: { x: 0, y: 0 },
  data: {
    id: 'switch-1',
    name: 'Route By Severity',
    expression: '{{ incident.severity }}',
    cases: {
      critical: {},
      high: {},
      medium: {},
    },
    hasDefault: true,
    status: 'pending' as const,
    ...data,
  },
});

const renderNode = (data: Partial<SwitchNodeData> = {}) => {
  const node = createMockNode(data);
  return render(
    <ReactFlowProvider>
      <SwitchNode
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

describe('SwitchNode', () => {
  it('should render node with name, expression, and cases', () => {
    renderNode();

    expect(screen.getByText('Route By Severity')).toBeInTheDocument();
    expect(screen.getByText('Multi-Branch Router')).toBeInTheDocument();
    expect(screen.getByText('{{ incident.severity }}')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('should render default name when name is not provided', () => {
    renderNode({ name: undefined });

    expect(screen.getByText('Switch')).toBeInTheDocument();
  });

  it('should display expression label', () => {
    renderNode();

    expect(screen.getByText('Expression:')).toBeInTheDocument();
  });

  it('should display "Not set" when expression is empty', () => {
    renderNode({ expression: '' });

    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  describe('status states', () => {
    it('should render pending status', () => {
      renderNode({ status: 'pending' });

      const node = screen.getByText('Route By Severity').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });

    it('should render running status with animation', () => {
      renderNode({ status: 'running' });

      const node = screen.getByText('Route By Severity').closest('.control-flow-node');
      expect(node).toHaveClass('running');
    });

    it('should render completed status', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Route By Severity').closest('.control-flow-node');
      expect(node).toBeInTheDocument();
    });
  });

  describe('active case highlighting', () => {
    it('should highlight active case', () => {
      renderNode({ activeCase: 'critical' });

      const criticalCase = screen.getByText('critical');
      expect(criticalCase).toHaveClass('bg-purple-500/30', 'text-purple-200');
    });

    it('should not highlight inactive cases', () => {
      renderNode({ activeCase: 'critical' });

      const highCase = screen.getByText('high');
      expect(highCase).toHaveClass('bg-white/5', 'text-white/70');
    });

    it('should highlight default case when active', () => {
      renderNode({ activeCase: 'default' });

      const defaultCase = screen.getByText('default');
      expect(defaultCase).toHaveClass('bg-gray-500/30', 'text-gray-200');
    });
  });

  describe('case display', () => {
    it('should display up to 4 cases', () => {
      renderNode({
        cases: {
          case1: {},
          case2: {},
          case3: {},
          case4: {},
        },
      });

      expect(screen.getByText('case1')).toBeInTheDocument();
      expect(screen.getByText('case2')).toBeInTheDocument();
      expect(screen.getByText('case3')).toBeInTheDocument();
      expect(screen.getByText('case4')).toBeInTheDocument();
      expect(screen.queryByText('+1 more cases')).not.toBeInTheDocument();
    });

    it('should show "+N more cases" when more than 4 cases', () => {
      renderNode({
        cases: {
          case1: {},
          case2: {},
          case3: {},
          case4: {},
          case5: {},
          case6: {},
        },
      });

      expect(screen.getByText('+2 more cases')).toBeInTheDocument();
      expect(screen.queryByText('case5')).not.toBeInTheDocument();
    });

    it('should display case count', () => {
      renderNode({
        cases: {
          critical: {},
          high: {},
          medium: {},
        },
      });

      expect(screen.getByText('3 cases + default')).toBeInTheDocument();
    });

    it('should display singular case label when only one case', () => {
      renderNode({
        cases: {
          single: {},
        },
      });

      expect(screen.getByText('1 case + default')).toBeInTheDocument();
    });

    it('should not show "+ default" when hasDefault is false', () => {
      renderNode({
        cases: {
          critical: {},
        },
        hasDefault: false,
      });

      expect(screen.getByText('1 case')).toBeInTheDocument();
      expect(screen.queryByText('+ default')).not.toBeInTheDocument();
    });
  });

  describe('default case', () => {
    it('should display default case when hasDefault is true', () => {
      renderNode({ hasDefault: true });

      expect(screen.getByText('default')).toBeInTheDocument();
    });

    it('should not display default case when hasDefault is false', () => {
      renderNode({ hasDefault: false });

      expect(screen.queryByText('default')).not.toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('should have purple/magenta gradient background', () => {
      renderNode();

      const node = screen.getByText('Route By Severity').closest('.control-flow-node');
      expect(node).toHaveStyle({
        background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
      });
    });

    it('should display expression with monospace font', () => {
      renderNode();

      const expressionElement = screen.getByText('{{ incident.severity }}');
      expect(expressionElement).toHaveClass('font-mono');
    });
  });

  describe('selection state', () => {
    it('should apply selected class when selected', () => {
      const node = createMockNode();
      const { container } = render(
        <ReactFlowProvider>
          <SwitchNode
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

  describe('empty cases', () => {
    it('should display 0 cases when cases object is empty', () => {
      renderNode({ cases: {} });

      expect(screen.getByText('0 cases + default')).toBeInTheDocument();
    });
  });

  describe('skipped branches', () => {
    it('should show SKIPPED badge on skipped case', () => {
      renderNode({
        skippedBranches: ['high', 'medium'],
        activeCase: 'critical'
      });

      const skippedBadges = screen.getAllByText('SKIPPED');
      expect(skippedBadges).toHaveLength(2);

      const highCase = screen.getByText('high');
      expect(highCase).toHaveClass('line-through', 'text-gray-400');
    });

    it('should not show SKIPPED when no branches are skipped', () => {
      renderNode({ skippedBranches: [] });

      expect(screen.queryByText('SKIPPED')).not.toBeInTheDocument();
    });

    it('should show active case with ring highlight', () => {
      renderNode({ activeCase: 'critical' });

      const criticalCase = screen.getByText('critical');
      expect(criticalCase).toHaveClass('ring-1', 'ring-purple-400/50');
    });
  });

  describe('handle positioning', () => {
    it('should render output handles for all visible cases', () => {
      const { container } = renderNode({
        cases: { critical: {}, high: {}, medium: {} },
        hasDefault: true
      });

      // Should have 4 handles: 3 cases + 1 default
      const handles = container.querySelectorAll('.react-flow__handle-bottom');
      expect(handles.length).toBeGreaterThanOrEqual(3);
    });

    it('should position handles evenly to avoid overlap', () => {
      const { container } = renderNode({
        cases: { case1: {}, case2: {}, case3: {}, case4: {} },
        hasDefault: true
      });

      const handles = container.querySelectorAll('.react-flow__handle-bottom');

      // Each handle should have a unique position
      const positions = Array.from(handles).map(h =>
        (h as HTMLElement).style.left
      );

      // All positions should be different
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(positions.length);
    });
  });

  describe('completed and failed states', () => {
    it('should show completed class on node', () => {
      renderNode({ status: 'completed' });

      const node = screen.getByText('Route By Severity').closest('.control-flow-node');
      expect(node).toHaveClass('completed');
    });

    it('should show failed class on node', () => {
      renderNode({ status: 'failed' });

      const node = screen.getByText('Route By Severity').closest('.control-flow-node');
      expect(node).toHaveClass('failed');
    });
  });
});

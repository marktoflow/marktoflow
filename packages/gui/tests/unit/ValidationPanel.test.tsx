import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ValidationPanel } from '../../src/client/components/Panels/ValidationPanel';

// Mock fetch
global.fetch = vi.fn();

describe('ValidationPanel', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should not render when workflowPath is null', () => {
    const { container } = render(
      <ValidationPanel workflowPath={null} onClose={mockOnClose} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should show loading state while validating', async () => {
    (global.fetch as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ valid: true }),
              }),
            100
          )
        )
    );

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    expect(screen.getByText('Validating workflow...')).toBeInTheDocument();
    // Loader2 is an SVG element, check for the spinner class in the container
    const loader = screen.getByText('Validating workflow...').parentElement;
    expect(loader?.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should call API with dry-run when workflowPath is provided', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        dryRun: true,
        workflow: {
          id: 'test',
          name: 'Test Workflow',
        },
      }),
    });

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/execute/%2Ftest%2Fworkflow.md',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dryRun: true }),
        })
      );
    });
  });

  it('should display success state for valid workflow', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        dryRun: true,
        workflow: {
          id: 'test',
          name: 'Test Workflow',
          version: '1.0.0',
          description: 'Test description',
        },
        steps: [
          {
            id: 'step1',
            action: 'slack.chat.postMessage',
            description: 'Send message',
          },
        ],
      }),
    });

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Workflow is valid')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should display error state for invalid workflow', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        valid: false,
        message: 'Workflow validation failed',
      }),
    });

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument();
      expect(screen.getByText('Workflow validation failed')).toBeInTheDocument();
    });
  });

  it('should display workflow steps', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        dryRun: true,
        workflow: { id: 'test', name: 'Test' },
        steps: [
          {
            id: 'step1',
            action: 'slack.chat.postMessage',
            description: 'Send Slack message',
          },
          {
            id: 'step2',
            action: 'github.rest.issues.create',
            description: 'Create GitHub issue',
          },
        ],
      }),
    });

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Steps (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('slack.chat.postMessage')).toBeInTheDocument();
    expect(screen.getByText('Send Slack message')).toBeInTheDocument();
    expect(screen.getByText('github.rest.issues.create')).toBeInTheDocument();
    expect(screen.getByText('Create GitHub issue')).toBeInTheDocument();
  });

  it('should display warnings', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        dryRun: true,
        workflow: { id: 'test', name: 'Test' },
        warnings: [
          'Step output variable is not used',
          'Missing error handling in step 2',
        ],
      }),
    });

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Warnings (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('Step output variable is not used')).toBeInTheDocument();
    expect(screen.getByText('Missing error handling in step 2')).toBeInTheDocument();
  });

  it('should display required inputs', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        dryRun: true,
        workflow: { id: 'test', name: 'Test' },
        inputs: {
          channel: {
            type: 'string',
            required: true,
          },
          message: {
            type: 'string',
            required: false,
          },
        },
      }),
    });

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Required Inputs (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('channel')).toBeInTheDocument();
    expect(screen.getByText('message')).toBeInTheDocument();
  });

  it('should handle network errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should handle API errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'Workflow not found',
      }),
    });

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('Workflow not found')).toBeInTheDocument();
    });
  });

  it('should show step numbers in correct order', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        workflow: { id: 'test', name: 'Test' },
        steps: [
          { id: '1', action: 'action1' },
          { id: '2', action: 'action2' },
          { id: '3', action: 'action3' },
        ],
      }),
    });

    render(
      <ValidationPanel workflowPath="/test/workflow.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      const stepNumbers = screen.getAllByText(/^[1-3]$/);
      expect(stepNumbers).toHaveLength(3);
      expect(stepNumbers[0]).toHaveTextContent('1');
      expect(stepNumbers[1]).toHaveTextContent('2');
      expect(stepNumbers[2]).toHaveTextContent('3');
    });
  });

  it('should re-validate when workflowPath changes', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        workflow: { id: 'test', name: 'Test' },
      }),
    });

    const { rerender } = render(
      <ValidationPanel workflowPath="/test/workflow1.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ValidationPanel workflowPath="/test/workflow2.md" onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/execute/%2Ftest%2Fworkflow2.md',
      expect.any(Object)
    );
  });
});

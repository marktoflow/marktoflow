import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewWorkflowDialog } from '../../src/client/components/Sidebar/NewWorkflowDialog';

describe('NewWorkflowDialog', () => {
  const mockOnCreate = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when open is false', () => {
    const { container } = render(
      <NewWorkflowDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should render when open is true', () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText('Create New Workflow')).toBeInTheDocument();
    expect(screen.getByText('Choose a template to get started quickly')).toBeInTheDocument();
  });

  it('should render all template options', () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText('Blank Workflow')).toBeInTheDocument();
    expect(screen.getByText('Slack Notification')).toBeInTheDocument();
    expect(screen.getByText('GitHub Pull Request')).toBeInTheDocument();
    expect(screen.getByText('HTTP Request')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Task')).toBeInTheDocument();
  });

  it('should have blank template selected by default', () => {
    const { container } = render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    // Find the blank template button and check if it has selected styling
    const blankButton = screen.getByText('Blank Workflow').closest('button');
    expect(blankButton).toHaveClass('border-accent');
  });

  it('should allow selecting different templates', () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const slackButton = screen.getByText('Slack Notification').closest('button');
    expect(slackButton).toBeDefined();

    if (slackButton) {
      fireEvent.click(slackButton);
      expect(slackButton).toHaveClass('border-accent');
    }
  });

  it('should validate that workflow name is required', async () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const createButton = screen.getByText('Create Workflow');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Workflow name is required')).toBeInTheDocument();
    });

    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it('should trim whitespace from workflow name', async () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const nameInput = screen.getByPlaceholderText('e.g., Daily Standup Reminder');
    fireEvent.change(nameInput, { target: { value: '  Test Workflow  ' } });

    const createButton = screen.getByText('Create Workflow');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledWith('Test Workflow', 'blank');
    });
  });

  it('should call onCreate with correct parameters', async () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const nameInput = screen.getByPlaceholderText('e.g., Daily Standup Reminder');
    fireEvent.change(nameInput, { target: { value: 'My Workflow' } });

    const githubButton = screen.getByText('GitHub Pull Request').closest('button');
    if (githubButton) {
      fireEvent.click(githubButton);
    }

    const createButton = screen.getByText('Create Workflow');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledWith('My Workflow', 'github-pr');
    });
  });

  it('should close dialog after successful creation', async () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const nameInput = screen.getByPlaceholderText('e.g., Daily Standup Reminder');
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    const createButton = screen.getByText('Create Workflow');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should reset form state after creation', async () => {
    const { rerender } = render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const nameInput = screen.getByPlaceholderText('e.g., Daily Standup Reminder') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    const slackButton = screen.getByText('Slack Notification').closest('button');
    if (slackButton) {
      fireEvent.click(slackButton);
    }

    const createButton = screen.getByText('Create Workflow');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    // Reopen dialog
    rerender(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    // Should be reset to default state
    const newNameInput = screen.getByPlaceholderText('e.g., Daily Standup Reminder') as HTMLInputElement;
    expect(newNameInput.value).toBe('');

    const blankButton = screen.getByText('Blank Workflow').closest('button');
    expect(blankButton).toHaveClass('border-accent');
  });

  it('should close on cancel button click', () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it('should close on backdrop click', () => {
    const { container } = render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/60');
    expect(backdrop).toBeInTheDocument();

    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    }
  });

  it('should clear error when user starts typing', async () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    // Trigger validation error
    const createButton = screen.getByText('Create Workflow');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Workflow name is required')).toBeInTheDocument();
    });

    // Start typing
    const nameInput = screen.getByPlaceholderText('e.g., Daily Standup Reminder');
    fireEvent.change(nameInput, { target: { value: 'T' } });

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Workflow name is required')).not.toBeInTheDocument();
    });
  });

  it('should show template descriptions', () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText('Start from scratch with an empty workflow')).toBeInTheDocument();
    expect(screen.getByText('Send messages to Slack channels')).toBeInTheDocument();
    expect(screen.getByText('Create and manage GitHub pull requests')).toBeInTheDocument();
    expect(screen.getByText('Make HTTP API calls and process responses')).toBeInTheDocument();
    expect(screen.getByText('Run workflows on a schedule with cron triggers')).toBeInTheDocument();
  });

  it('should show visual indicator for selected template', () => {
    render(
      <NewWorkflowDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCreate={mockOnCreate}
      />
    );

    const httpButton = screen.getByText('HTTP Request').closest('button');
    if (httpButton) {
      fireEvent.click(httpButton);

      // Should have selected visual indicator
      const indicator = httpButton.querySelector('.bg-accent');
      expect(indicator).toBeInTheDocument();
    }
  });
});

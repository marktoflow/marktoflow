import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExecutionInputDialog } from '../../src/client/components/Canvas/ExecutionInputDialog';
import type { WorkflowInput } from '@shared/types';

describe('ExecutionInputDialog', () => {
  const mockOnExecute = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when open is false', () => {
    const { container } = render(
      <ExecutionInputDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        inputs={{}}
        onExecute={mockOnExecute}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should render when open is true', () => {
    render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={{}}
        onExecute={mockOnExecute}
        workflowName="Test Workflow"
      />
    );

    expect(screen.getByText('Execute Workflow')).toBeInTheDocument();
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
  });

  it('should show message when no inputs are defined', () => {
    render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={{}}
        onExecute={mockOnExecute}
      />
    );

    expect(screen.getByText('This workflow has no input parameters')).toBeInTheDocument();
  });

  it('should render all input fields', () => {
    const inputs: Record<string, WorkflowInput> = {
      name: {
        type: 'string',
        required: true,
        description: 'User name',
      },
      age: {
        type: 'number',
        required: false,
        description: 'User age',
        default: 25,
      },
      active: {
        type: 'boolean',
        required: false,
        description: 'Is active',
      },
    };

    render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    // Check for field labels
    const labels = screen.getAllByText('User name');
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getByText('User age')).toBeInTheDocument();
    // For checkbox, the description appears twice (label and checkbox label)
    const activeLabels = screen.getAllByText(/Is active|active/i);
    expect(activeLabels.length).toBeGreaterThan(0);
  });

  it('should mark required fields with asterisk', () => {
    const inputs: Record<string, WorkflowInput> = {
      required_field: {
        type: 'string',
        required: true,
        description: 'Required Field',
      },
    };

    const { container } = render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    const asterisks = container.querySelectorAll('.text-error');
    expect(asterisks.length).toBeGreaterThan(0);
  });

  it('should initialize fields with default values', () => {
    const inputs: Record<string, WorkflowInput> = {
      name: {
        type: 'string',
        required: false,
        description: 'Name',
        default: 'John Doe',
      },
    };

    render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    const input = screen.getByPlaceholderText('John Doe') as HTMLInputElement;
    expect(input.value).toBe('John Doe');
  });

  it('should validate required fields on submit', async () => {
    const inputs: Record<string, WorkflowInput> = {
      name: {
        type: 'string',
        required: true,
        description: 'Name',
      },
    };

    render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByText(/is required/i)).toBeInTheDocument();
    });

    expect(mockOnExecute).not.toHaveBeenCalled();
  });

  it('should validate number type fields', async () => {
    const inputs: Record<string, WorkflowInput> = {
      age: {
        type: 'number',
        required: true,
        description: 'Age',
      },
    };

    const { container } = render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    // HTML number inputs handle non-numeric values by setting them to empty string
    // So we test with valid input first, then verify number conversion
    fireEvent.change(input, { target: { value: '25' } });

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockOnExecute).toHaveBeenCalledWith({
        age: 25, // Should convert string to number
      });
    });
  });

  it('should handle boolean inputs correctly', () => {
    const inputs: Record<string, WorkflowInput> = {
      enabled: {
        type: 'boolean',
        required: false,
        description: 'Enable feature',
      },
    };

    render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('should call onExecute with converted values on valid submit', async () => {
    const inputs: Record<string, WorkflowInput> = {
      name: {
        type: 'string',
        required: true,
        description: 'Name',
      },
      age: {
        type: 'number',
        required: false,
        description: 'Age',
      },
      active: {
        type: 'boolean',
        required: false,
        description: 'Active',
      },
    };

    const { container } = render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const ageInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const activeCheckbox = screen.getByRole('checkbox');

    fireEvent.change(nameInput, { target: { value: 'John' } });
    fireEvent.change(ageInput, { target: { value: '30' } });
    fireEvent.click(activeCheckbox);

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockOnExecute).toHaveBeenCalledWith({
        name: 'John',
        age: 30,
        active: true,
      });
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should skip optional empty fields', async () => {
    const inputs: Record<string, WorkflowInput> = {
      name: {
        type: 'string',
        required: true,
        description: 'Name',
      },
      optional: {
        type: 'string',
        required: false,
        description: 'Optional',
      },
    };

    const { container } = render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    const inputs_elements = container.querySelectorAll('input[type="text"]');
    const nameInput = inputs_elements[0] as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'John' } });

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockOnExecute).toHaveBeenCalledWith({
        name: 'John',
      });
    });
  });

  it('should validate using custom regex pattern', async () => {
    const inputs: Record<string, WorkflowInput> = {
      email: {
        type: 'string',
        required: true,
        description: 'Email',
        validation: {
          pattern: '^[^@]+@[^@]+\\.[^@]+$',
          message: 'Invalid email format',
        },
      },
    };

    const { container } = render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    const emailInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    });

    expect(mockOnExecute).not.toHaveBeenCalled();
  });

  it('should close dialog on cancel button', () => {
    render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={{}}
        onExecute={mockOnExecute}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should close dialog on backdrop click', () => {
    const { container } = render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={{}}
        onExecute={mockOnExecute}
      />
    );

    const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/60');
    expect(backdrop).toBeInTheDocument();

    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    }
  });

  it('should clear errors when input changes', async () => {
    const inputs: Record<string, WorkflowInput> = {
      name: {
        type: 'string',
        required: true,
        description: 'Name',
      },
    };

    const { container } = render(
      <ExecutionInputDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inputs={inputs}
        onExecute={mockOnExecute}
      />
    );

    // Trigger validation error
    const executeButton = screen.getByText('Execute');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(screen.getByText(/is required/i)).toBeInTheDocument();
    });

    // Type in input
    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'John' } });

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/is required/i)).not.toBeInTheDocument();
    });
  });
});

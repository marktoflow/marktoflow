import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Breadcrumb, type BreadcrumbItem } from '../../src/client/components/common/Breadcrumb';
import { Button } from '../../src/client/components/common/Button';

describe('Breadcrumb', () => {
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    mockOnNavigate.mockClear();
  });

  it('should not render when there is only one item', () => {
    const items: BreadcrumbItem[] = [{ id: '1', name: 'Root' }];

    const { container } = render(
      <Breadcrumb items={items} onNavigate={mockOnNavigate} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when there are multiple items', () => {
    const items: BreadcrumbItem[] = [
      { id: '1', name: 'Root', path: '/root' },
      { id: '2', name: 'Child', path: '/child' },
    ];

    render(<Breadcrumb items={items} onNavigate={mockOnNavigate} />);

    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('should call onNavigate when clicking a breadcrumb', () => {
    const items: BreadcrumbItem[] = [
      { id: '1', name: 'Root', path: '/root' },
      { id: '2', name: 'Child', path: '/child' },
      { id: '3', name: 'Grandchild', path: '/grandchild' },
    ];

    render(<Breadcrumb items={items} onNavigate={mockOnNavigate} />);

    // Click on the first item
    fireEvent.click(screen.getByText('Root'));

    expect(mockOnNavigate).toHaveBeenCalledWith(items[0], 0);
  });

  it('should not call onNavigate when clicking the last item', () => {
    const items: BreadcrumbItem[] = [
      { id: '1', name: 'Root', path: '/root' },
      { id: '2', name: 'Child', path: '/child' },
    ];

    render(<Breadcrumb items={items} onNavigate={mockOnNavigate} />);

    // The last item should be disabled
    const lastButton = screen.getByText('Child').closest('button');
    expect(lastButton).toBeDisabled();
  });

  it('should show home icon on first item', () => {
    const items: BreadcrumbItem[] = [
      { id: '1', name: 'Root' },
      { id: '2', name: 'Child' },
    ];

    render(<Breadcrumb items={items} onNavigate={mockOnNavigate} />);

    // Home icon should be in the first button
    const firstButton = screen.getByText('Root').closest('button');
    expect(firstButton?.querySelector('svg')).toBeInTheDocument();
  });

  it('should show chevron separators between items', () => {
    const items: BreadcrumbItem[] = [
      { id: '1', name: 'Root' },
      { id: '2', name: 'Child' },
      { id: '3', name: 'Grandchild' },
    ];

    const { container } = render(
      <Breadcrumb items={items} onNavigate={mockOnNavigate} />
    );

    // Should have chevrons between items (2 separators for 3 items)
    const separators = container.querySelectorAll('svg.w-4.h-4.text-gray-600');
    expect(separators).toHaveLength(2);
  });
});

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
  });

  it('should apply primary variant by default', () => {
    render(<Button>Primary</Button>);

    const button = screen.getByText('Primary');
    expect(button.className).toContain('bg-primary');
  });

  it('should apply secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);

    const button = screen.getByText('Secondary');
    expect(button.className).toContain('bg-node-bg');
  });

  it('should apply ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);

    const button = screen.getByText('Ghost');
    expect(button.className).toContain('bg-transparent');
  });

  it('should apply destructive variant', () => {
    render(<Button variant="destructive">Destructive</Button>);

    const button = screen.getByText('Destructive');
    expect(button.className).toContain('text-error');
  });

  it('should apply different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    let button = screen.getByText('Small');
    expect(button.className).toContain('text-xs');

    rerender(<Button size="lg">Large</Button>);
    button = screen.getByText('Large');
    expect(button.className).toContain('px-6');
  });
});

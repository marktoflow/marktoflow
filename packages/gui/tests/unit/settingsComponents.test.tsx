import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingToggle } from '../../src/client/components/Settings/controls/SettingToggle';
import { SettingSelect } from '../../src/client/components/Settings/controls/SettingSelect';
import { SettingNumber } from '../../src/client/components/Settings/controls/SettingNumber';

describe('SettingToggle', () => {
  it('should render label and description', () => {
    render(
      <SettingToggle
        label="Show Grid"
        description="Display grid lines"
        checked={true}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Show Grid')).toBeInTheDocument();
    expect(screen.getByText('Display grid lines')).toBeInTheDocument();
  });

  it('should render without description', () => {
    render(
      <SettingToggle label="Toggle" checked={false} onChange={() => {}} />
    );

    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });

  it('should reflect checked state via aria-checked', () => {
    const { rerender } = render(
      <SettingToggle label="Test" checked={true} onChange={() => {}} />
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    rerender(
      <SettingToggle label="Test" checked={false} onChange={() => {}} />
    );

    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('should call onChange with toggled value when clicked', () => {
    const handleChange = vi.fn();
    render(
      <SettingToggle label="Test" checked={true} onChange={handleChange} />
    );

    fireEvent.click(screen.getByRole('switch'));
    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('should call onChange with true when unchecked toggle is clicked', () => {
    const handleChange = vi.fn();
    render(
      <SettingToggle label="Test" checked={false} onChange={handleChange} />
    );

    fireEvent.click(screen.getByRole('switch'));
    expect(handleChange).toHaveBeenCalledWith(true);
  });
});

describe('SettingSelect', () => {
  const options = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ];

  it('should render label and description', () => {
    render(
      <SettingSelect
        label="Theme"
        description="Choose color scheme"
        value="dark"
        options={options}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Choose color scheme')).toBeInTheDocument();
  });

  it('should render all options', () => {
    render(
      <SettingSelect
        label="Theme"
        value="dark"
        options={options}
        onChange={() => {}}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select.querySelectorAll('option')).toHaveLength(3);
  });

  it('should show the current value as selected', () => {
    render(
      <SettingSelect
        label="Theme"
        value="light"
        options={options}
        onChange={() => {}}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('light');
  });

  it('should call onChange with the new value', () => {
    const handleChange = vi.fn();
    render(
      <SettingSelect
        label="Theme"
        value="dark"
        options={options}
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'system' } });
    expect(handleChange).toHaveBeenCalledWith('system');
  });
});

describe('SettingNumber', () => {
  it('should render label and description', () => {
    render(
      <SettingNumber
        label="Grid Size"
        description="Spacing in pixels"
        value={20}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Grid Size')).toBeInTheDocument();
    expect(screen.getByText('Spacing in pixels')).toBeInTheDocument();
  });

  it('should show the current value', () => {
    render(
      <SettingNumber label="Size" value={20} onChange={() => {}} />
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('20');
  });

  it('should call onChange with the new number value', () => {
    const handleChange = vi.fn();
    render(
      <SettingNumber label="Size" value={20} onChange={handleChange} />
    );

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '40' } });
    expect(handleChange).toHaveBeenCalledWith(40);
  });

  it('should respect min and max attributes', () => {
    render(
      <SettingNumber label="Size" value={20} min={5} max={100} onChange={() => {}} />
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.min).toBe('5');
    expect(input.max).toBe('100');
  });

  it('should respect step attribute', () => {
    render(
      <SettingNumber label="Size" value={20} step={5} onChange={() => {}} />
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.step).toBe('5');
  });

  it('should call onChange with 0 for empty string input', () => {
    const handleChange = vi.fn();
    render(
      <SettingNumber label="Size" value={20} onChange={handleChange} />
    );

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } });
    expect(handleChange).toHaveBeenCalledWith(0);
  });
});

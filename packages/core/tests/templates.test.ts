import { describe, it, expect } from 'vitest';
import { TemplateRegistry, HELLO_TEMPLATE } from '../src/templates.js';


describe('TemplateRegistry', () => {
  it('lists built-in templates', () => {
    const registry = new TemplateRegistry();
    const list = registry.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].id).toBe(HELLO_TEMPLATE.id);
  });
});

describe('WorkflowTemplate', () => {
  it('renders template variables', () => {
    const output = HELLO_TEMPLATE.render({ message: 'Hi' });
    expect(output).toContain('Hi');
  });
});

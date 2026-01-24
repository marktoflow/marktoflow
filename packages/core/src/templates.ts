/**
 * Workflow template library for marktoflow.
 */

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse, stringify } from 'yaml';

export enum TemplateCategory {
  CODE_QUALITY = 'code_quality',
  DEPLOYMENT = 'deployment',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  SECURITY = 'security',
  MONITORING = 'monitoring',
  DATA = 'data',
  INTEGRATION = 'integration',
  GENERAL = 'general',
}

export interface TemplateVariable {
  name: string;
  description: string;
  type?: 'string' | 'integer' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: unknown;
  example?: unknown;
  pattern?: string | undefined;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  version?: string;
  author?: string;
  tags?: string[];
  license?: string;
  homepage?: string;
  variables?: TemplateVariable[];
  requirements?: Record<string, unknown>;
  examples?: Array<Record<string, unknown>>;
}

export class WorkflowTemplate {
  public readonly createdAt: Date;

  constructor(
    public metadata: TemplateMetadata,
    public content: string,
    public source: 'builtin' | 'file' | 'registry' = 'builtin',
    public path?: string
  ) {
    this.createdAt = new Date();
  }

  get id(): string {
    return this.metadata.id;
  }

  get name(): string {
    return this.metadata.name;
  }

  get category(): TemplateCategory {
    return this.metadata.category;
  }

  get variables(): TemplateVariable[] {
    return this.metadata.variables ?? [];
  }

  validateVariables(values: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const variable of this.variables) {
      const value = values[variable.name];
      if (value === undefined || value === null) {
        if (variable.required && variable.default === undefined) {
          errors.push(`Variable '${variable.name}' is required`);
        }
        continue;
      }
      if (variable.type) {
        const typeMap: Record<string, string> = {
          string: 'string',
          integer: 'number',
          boolean: 'boolean',
          array: 'object',
          object: 'object',
        };
        const expected = typeMap[variable.type];
        if (expected === 'number' && typeof value !== 'number') {
          errors.push(`Variable '${variable.name}' must be a number`);
        } else if (expected === 'string' && typeof value !== 'string') {
          errors.push(`Variable '${variable.name}' must be a string`);
        } else if (expected === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Variable '${variable.name}' must be a boolean`);
        } else if (variable.type === 'array' && !Array.isArray(value)) {
          errors.push(`Variable '${variable.name}' must be an array`);
        } else if (variable.type === 'object' && typeof value !== 'object') {
          errors.push(`Variable '${variable.name}' must be an object`);
        }
      }
      if (variable.pattern && typeof value === 'string') {
        const regex = new RegExp(variable.pattern);
        if (!regex.test(value)) {
          errors.push(`Variable '${variable.name}' must match pattern ${variable.pattern}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  render(variables: Record<string, unknown> = {}): string {
    const values: Record<string, unknown> = { ...variables };
    for (const variable of this.variables) {
      if (values[variable.name] === undefined && variable.default !== undefined) {
        values[variable.name] = variable.default;
      }
    }

    let result = this.content;
    for (const [name, value] of Object.entries(values)) {
      let strValue = '';
      if (Array.isArray(value) || typeof value === 'object') {
        strValue = stringify(value).trim();
      } else if (typeof value === 'boolean') {
        strValue = String(value).toLowerCase();
      } else {
        strValue = String(value);
      }
      result = result.replace(new RegExp(`\\{\\{\\s*template\\.${name}\\s*\\}\\}`, 'g'), strValue);
    }
    return result;
  }

  instantiate(outputPath: string, variables: Record<string, unknown> = {}, workflowId?: string): string {
    const { valid, errors } = this.validateVariables(variables);
    if (!valid) {
      throw new Error(`Invalid variables: ${errors.join('; ')}`);
    }
    let content = this.render(variables);
    if (workflowId) {
      content = content.replace(/(id:\\s*\")[^\"]*(\")/g, `$1${workflowId}$2`);
      content = content.replace(/(id:\\s*)'[^']*(')/g, `$1'${workflowId}'$2`);
      content = content.replace(/(id:\\s*)(\\S+)/g, `$1${workflowId}`);
    }
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const fs = require('node:fs');
    fs.writeFileSync(outputPath, content);
    return outputPath;
  }

  static fromFile(path: string): WorkflowTemplate {
    const content = readFileSync(path, 'utf8');
    if (content.startsWith('---')) {
      const parts = content.split('---', 3);
      if (parts.length >= 3) {
        const frontmatter = parse(parts[1]) as Record<string, any>;
        const templateMeta = frontmatter?.template ?? {};
        const metadata: TemplateMetadata = {
          id: templateMeta.id ?? path.split('/').pop()?.replace(/\\.md$/, '') ?? 'template',
          name: templateMeta.name ?? path.split('/').pop()?.replace(/\\.md$/, '') ?? 'Template',
          description: templateMeta.description ?? '',
          category: (templateMeta.category as TemplateCategory) ?? TemplateCategory.GENERAL,
          version: templateMeta.version ?? '1.0.0',
          author: templateMeta.author ?? '',
          tags: templateMeta.tags ?? [],
          variables: templateMeta.variables ?? [],
          requirements: templateMeta.requirements ?? {},
        };
        return new WorkflowTemplate(metadata, content, 'file', path);
      }
    }
    const fallback: TemplateMetadata = {
      id: path.split('/').pop()?.replace(/\\.md$/, '') ?? 'template',
      name: path.split('/').pop()?.replace(/\\.md$/, '') ?? 'Template',
      category: TemplateCategory.GENERAL,
    };
    return new WorkflowTemplate(fallback, content, 'file', path);
  }
}

export class TemplateRegistry {
  private templates = new Map<string, WorkflowTemplate>();

  constructor(private templateDirs: string[] = [], loadBuiltins: boolean = true) {
    if (loadBuiltins) {
      for (const template of BUILTIN_TEMPLATES) {
        this.templates.set(template.id, template);
      }
    }
  }

  register(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  unregister(id: string): boolean {
    return this.templates.delete(id);
  }

  get(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  list(category?: TemplateCategory, tags?: string[]): WorkflowTemplate[] {
    let items = Array.from(this.templates.values());
    if (category) {
      items = items.filter((t) => t.category === category);
    }
    if (tags && tags.length > 0) {
      items = items.filter((t) => (t.metadata.tags ?? []).some((tag) => tags.includes(tag)));
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  search(query: string): WorkflowTemplate[] {
    const q = query.toLowerCase();
    return Array.from(this.templates.values()).filter((t) => {
      if (t.name.toLowerCase().includes(q)) return true;
      if ((t.metadata.description ?? '').toLowerCase().includes(q)) return true;
      return (t.metadata.tags ?? []).some((tag) => tag.toLowerCase().includes(q));
    });
  }

  discover(): string[] {
    const discovered: string[] = [];
    for (const dir of this.templateDirs) {
      if (!existsSync(dir)) continue;
      const fs = require('node:fs');
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (!entry.endsWith('.md')) continue;
        const path = `${dir}/${entry}`;
        try {
          const tmpl = WorkflowTemplate.fromFile(path);
          if (!this.templates.has(tmpl.id)) {
            this.templates.set(tmpl.id, tmpl);
            discovered.push(tmpl.id);
          }
        } catch {
          // ignore invalid templates
        }
      }
    }
    return discovered;
  }
}

export const HELLO_TEMPLATE = new WorkflowTemplate(
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'A minimal example workflow template',
    category: TemplateCategory.GENERAL,
    version: '1.0.0',
    author: 'marktoflow',
    tags: ['example', 'starter'],
    variables: [
      {
        name: 'message',
        description: 'Message to print',
        type: 'string',
        required: true,
        default: 'Hello from marktoflow!',
      },
    ],
  },
  `---\nworkflow:\n  id: hello-world\n  name: \"Hello World\"\n  version: \"1.0.0\"\n  description: \"A simple example workflow\"\n\nsteps:\n  - id: greet\n    action: console.log\n    inputs:\n      message: \"{{ template.message }}\"\n---\n\n# Hello World\n\nThis is a simple example workflow.\n`
);

export const BUILTIN_TEMPLATES: WorkflowTemplate[] = [HELLO_TEMPLATE];

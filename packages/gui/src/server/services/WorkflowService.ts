import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join, relative, dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { stringify as yamlStringify } from 'yaml';

// Import from @marktoflow/core for proper parsing
// NOTE: This will be enabled when the package is properly built
// import { parseFile, Workflow } from '@marktoflow/core';

interface WorkflowListItem {
  path: string;
  name: string;
  description?: string;
  version?: string;
}

interface WorkflowMetadata {
  id: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
}

interface WorkflowStep {
  id: string;
  name?: string;
  action?: string;
  workflow?: string;
  inputs: Record<string, unknown>;
  outputVariable?: string;
  conditions?: string[];
  errorHandling?: {
    action: 'stop' | 'continue' | 'retry';
    maxRetries?: number;
    retryDelay?: number;
    fallbackStep?: string;
  };
  timeout?: number;
}

interface Workflow {
  metadata: WorkflowMetadata;
  steps: WorkflowStep[];
  tools?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  triggers?: unknown[];
}

export class WorkflowService {
  private workflowDir: string;

  constructor(workflowDir?: string) {
    this.workflowDir = workflowDir || process.env.WORKFLOW_DIR || process.cwd();
  }

  async listWorkflows(): Promise<WorkflowListItem[]> {
    const workflows: WorkflowListItem[] = [];
    const baseDir = this.workflowDir;

    async function scanDirectory(dir: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          // Skip hidden directories and node_modules
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (
            entry.isFile() &&
            (entry.name.endsWith('.md') || entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))
          ) {
            // Check if it's a workflow file by looking for frontmatter
            try {
              const content = await readFile(fullPath, 'utf-8');
              if (content.includes('workflow:') || content.includes('steps:')) {
                const relativePath = relative(baseDir, fullPath);
                const workflowInfo = extractWorkflowInfo(content, entry.name);
                workflows.push({
                  path: relativePath,
                  ...workflowInfo,
                });
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    await scanDirectory(this.workflowDir);
    return workflows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getWorkflow(workflowPath: string): Promise<Workflow | null> {
    const fullPath = this.resolvePath(workflowPath);

    if (!existsSync(fullPath)) {
      return null;
    }

    try {
      const content = await readFile(fullPath, 'utf-8');
      return this.parseWorkflow(content, workflowPath);
    } catch (error) {
      console.error(`Error parsing workflow ${workflowPath}:`, error);
      return null;
    }
  }

  async createWorkflow(name: string, template?: string): Promise<WorkflowListItem> {
    const filename = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
    const workflowPath = join('workflows', filename);
    const fullPath = join(this.workflowDir, workflowPath);

    // Ensure directory exists
    await mkdir(dirname(fullPath), { recursive: true });

    const content = template || this.generateWorkflowTemplate(name);
    await writeFile(fullPath, content, 'utf-8');

    return {
      path: workflowPath,
      name,
    };
  }

  async updateWorkflow(workflowPath: string, workflow: Workflow): Promise<Workflow> {
    const fullPath = this.resolvePath(workflowPath);

    // Read original file to preserve markdown content
    let markdownContent = '';
    if (existsSync(fullPath)) {
      const originalContent = await readFile(fullPath, 'utf-8');
      const match = originalContent.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
      if (match) {
        markdownContent = match[1];
      }
    }

    const content = this.serializeWorkflow(workflow, markdownContent);
    await writeFile(fullPath, content, 'utf-8');
    return workflow;
  }

  async deleteWorkflow(workflowPath: string): Promise<void> {
    const fullPath = this.resolvePath(workflowPath);
    if (existsSync(fullPath)) {
      await unlink(fullPath);
    }
  }

  async getExecutionHistory(workflowPath: string): Promise<unknown[]> {
    // TODO: Query state store for execution history
    // This will integrate with @marktoflow/core StateStore
    return [];
  }

  private resolvePath(workflowPath: string): string {
    // Handle both absolute and relative paths
    if (workflowPath.startsWith('/')) {
      return workflowPath;
    }
    return join(this.workflowDir, workflowPath);
  }

  private parseWorkflow(content: string, path: string): Workflow {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return {
        metadata: { id: path, name: path },
        steps: [],
      };
    }

    const yaml = frontmatterMatch[1];

    // Parse the YAML manually for now (will use @marktoflow/core parser when integrated)
    const workflow: Workflow = {
      metadata: { id: path, name: path },
      steps: [],
    };

    // Extract workflow metadata
    const workflowSection = yaml.match(/workflow:\s*\n((?:  .*\n)*)/);
    if (workflowSection) {
      const idMatch = workflowSection[1].match(/id:\s*(\S+)/);
      const nameMatch = workflowSection[1].match(/name:\s*["']?(.+?)["']?\s*$/m);
      const versionMatch = workflowSection[1].match(/version:\s*["']?(.+?)["']?\s*$/m);
      const descMatch = workflowSection[1].match(/description:\s*["']?(.+?)["']?\s*$/m);
      const authorMatch = workflowSection[1].match(/author:\s*["']?(.+?)["']?\s*$/m);

      if (idMatch) workflow.metadata.id = idMatch[1].trim();
      if (nameMatch) workflow.metadata.name = nameMatch[1].trim();
      if (versionMatch) workflow.metadata.version = versionMatch[1].trim();
      if (descMatch) workflow.metadata.description = descMatch[1].trim();
      if (authorMatch) workflow.metadata.author = authorMatch[1].trim();

      // Extract tags
      const tagsMatch = workflowSection[1].match(/tags:\s*\[(.*?)\]/);
      if (tagsMatch) {
        workflow.metadata.tags = tagsMatch[1]
          .split(',')
          .map((t) => t.trim().replace(/["']/g, ''))
          .filter(Boolean);
      }
    }

    // Extract steps using regex to find step blocks
    const stepsSection = yaml.match(/steps:\s*\n((?:  - [\s\S]*?)(?=\n\w|$))/);
    if (stepsSection) {
      const stepBlocks = stepsSection[1].split(/\n  - /).filter(Boolean);

      for (const block of stepBlocks) {
        const stepText = block.startsWith('id:') ? block : block;
        const step = this.parseStep(stepText);
        if (step) {
          workflow.steps.push(step);
        }
      }
    }

    // Extract tools
    const toolsMatch = yaml.match(/tools:\s*\n((?:  .*\n)*)/);
    if (toolsMatch) {
      // Simple extraction - will be enhanced with proper YAML parser
      workflow.tools = {};
    }

    // Extract inputs
    const inputsMatch = yaml.match(/inputs:\s*\n((?:  .*\n)*)/);
    if (inputsMatch) {
      workflow.inputs = {};
    }

    return workflow;
  }

  private parseStep(stepText: string): WorkflowStep | null {
    const idMatch = stepText.match(/id:\s*(\S+)/);
    if (!idMatch) return null;

    const step: WorkflowStep = {
      id: idMatch[1],
      inputs: {},
    };

    const nameMatch = stepText.match(/name:\s*["']?(.+?)["']?\s*$/m);
    if (nameMatch) step.name = nameMatch[1];

    const actionMatch = stepText.match(/action:\s*(\S+)/);
    if (actionMatch) step.action = actionMatch[1];

    const workflowMatch = stepText.match(/workflow:\s*(\S+)/);
    if (workflowMatch) step.workflow = workflowMatch[1];

    const outputMatch = stepText.match(/output_variable:\s*(\S+)/);
    if (outputMatch) step.outputVariable = outputMatch[1];

    const timeoutMatch = stepText.match(/timeout:\s*(\d+)/);
    if (timeoutMatch) step.timeout = parseInt(timeoutMatch[1], 10);

    // Parse inputs (simplified)
    const inputsMatch = stepText.match(/inputs:\s*\n((?:      .*\n)*)/);
    if (inputsMatch) {
      const inputLines = inputsMatch[1].split('\n').filter(Boolean);
      for (const line of inputLines) {
        const kvMatch = line.match(/^\s*(\w+):\s*(.+)$/);
        if (kvMatch) {
          let value: unknown = kvMatch[2].trim();
          // Remove quotes if present
          if ((value as string).startsWith("'") && (value as string).endsWith("'")) {
            value = (value as string).slice(1, -1);
          } else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
            value = (value as string).slice(1, -1);
          }
          step.inputs[kvMatch[1]] = value;
        }
      }
    }

    return step;
  }

  private serializeWorkflow(workflow: Workflow, markdownContent: string = ''): string {
    const frontmatter: Record<string, unknown> = {
      workflow: {
        id: workflow.metadata.id,
        name: workflow.metadata.name,
        version: workflow.metadata.version || '1.0.0',
        description: workflow.metadata.description || '',
        author: workflow.metadata.author || '',
        tags: workflow.metadata.tags || [],
      },
    };

    if (workflow.tools && Object.keys(workflow.tools).length > 0) {
      frontmatter.tools = workflow.tools;
    }

    if (workflow.inputs && Object.keys(workflow.inputs).length > 0) {
      frontmatter.inputs = workflow.inputs;
    }

    if (workflow.triggers && workflow.triggers.length > 0) {
      frontmatter.triggers = workflow.triggers;
    }

    // Serialize steps
    frontmatter.steps = workflow.steps.map((step) => {
      const stepObj: Record<string, unknown> = {
        id: step.id,
      };

      if (step.name) stepObj.name = step.name;
      if (step.action) stepObj.action = step.action;
      if (step.workflow) stepObj.workflow = step.workflow;
      if (Object.keys(step.inputs).length > 0) stepObj.inputs = step.inputs;
      if (step.outputVariable) stepObj.output_variable = step.outputVariable;
      if (step.conditions && step.conditions.length > 0) stepObj.conditions = step.conditions;
      if (step.errorHandling) stepObj.error_handling = step.errorHandling;
      if (step.timeout) stepObj.timeout = step.timeout;

      return stepObj;
    });

    const yaml = yamlStringify(frontmatter, {
      indent: 2,
      lineWidth: 0,
      defaultKeyType: 'PLAIN',
      defaultStringType: 'QUOTE_DOUBLE',
    });

    // Generate markdown if not provided
    if (!markdownContent.trim()) {
      markdownContent = `\n# ${workflow.metadata.name}\n\n${workflow.metadata.description || ''}\n`;
    }

    return `---\n${yaml}---${markdownContent}`;
  }

  private generateWorkflowTemplate(name: string): string {
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return `---
workflow:
  id: ${id}
  name: "${name}"
  version: "1.0.0"
  description: ""
  author: ""
  tags: []

inputs: {}

steps:
  - id: step-1
    name: "First Step"
    action: http.request
    inputs:
      url: "https://api.example.com"
      method: "GET"
    output_variable: result
---

# ${name}

Describe your workflow here.

## Steps

### Step 1: First Step

This step makes an HTTP request to the API.
`;
  }
}

function extractWorkflowInfo(
  content: string,
  filename: string
): { name: string; description?: string; version?: string } {
  const nameMatch = content.match(/name:\s*["']?(.+?)["']?\s*$/m);
  const descMatch = content.match(/description:\s*["']?(.+?)["']?\s*$/m);
  const versionMatch = content.match(/version:\s*["']?(.+?)["']?\s*$/m);

  return {
    name: nameMatch?.[1]?.trim() || filename.replace(/\.(md|yaml|yml)$/, '').replace(/-/g, ' '),
    description: descMatch?.[1]?.trim(),
    version: versionMatch?.[1]?.trim(),
  };
}

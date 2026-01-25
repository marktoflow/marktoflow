import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { existsSync } from 'fs';

// TODO: Import from @marktoflow/core once integrated
// import { parseFile, Workflow } from '@marktoflow/core';

interface WorkflowListItem {
  path: string;
  name: string;
  description?: string;
  version?: string;
}

interface Workflow {
  metadata: {
    id: string;
    name: string;
    version?: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
  steps: any[];
  tools?: Record<string, any>;
  inputs?: Record<string, any>;
  triggers?: any[];
}

export class WorkflowService {
  private workflowDir: string;

  constructor(workflowDir?: string) {
    this.workflowDir = workflowDir || process.env.WORKFLOW_DIR || process.cwd();
  }

  async listWorkflows(): Promise<WorkflowListItem[]> {
    const workflows: WorkflowListItem[] = [];

    async function scanDirectory(dir: string, baseDir: string) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDirectory(fullPath, baseDir);
          } else if (
            entry.isFile() &&
            (entry.name.endsWith('.md') || entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))
          ) {
            // Check if it's a workflow file by looking for frontmatter
            const content = await readFile(fullPath, 'utf-8');
            if (content.includes('workflow:') || content.includes('steps:')) {
              const relativePath = relative(baseDir, fullPath);
              const name = extractWorkflowName(content, entry.name);
              workflows.push({
                path: relativePath,
                name,
              });
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await scanDirectory(this.workflowDir, this.workflowDir);
    return workflows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getWorkflow(workflowPath: string): Promise<Workflow | null> {
    const fullPath = join(this.workflowDir, workflowPath);

    if (!existsSync(fullPath)) {
      return null;
    }

    const content = await readFile(fullPath, 'utf-8');
    return this.parseWorkflow(content, workflowPath);
  }

  async createWorkflow(name: string, template?: string): Promise<WorkflowListItem> {
    const filename = name.toLowerCase().replace(/\s+/g, '-') + '.md';
    const workflowPath = `workflows/${filename}`;
    const fullPath = join(this.workflowDir, workflowPath);

    // Ensure directory exists
    await mkdir(dirname(fullPath), { recursive: true });

    const content =
      template ||
      `---
workflow:
  id: ${name.toLowerCase().replace(/\s+/g, '-')}
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
      method: GET
    output_variable: result
---

# ${name}

Description of your workflow goes here.
`;

    await writeFile(fullPath, content, 'utf-8');

    return {
      path: workflowPath,
      name,
    };
  }

  async updateWorkflow(workflowPath: string, workflow: Workflow): Promise<Workflow> {
    const fullPath = join(this.workflowDir, workflowPath);
    const content = this.serializeWorkflow(workflow);
    await writeFile(fullPath, content, 'utf-8');
    return workflow;
  }

  async deleteWorkflow(workflowPath: string): Promise<void> {
    const fullPath = join(this.workflowDir, workflowPath);
    await unlink(fullPath);
  }

  async getExecutionHistory(workflowPath: string): Promise<any[]> {
    // TODO: Query state store for execution history
    return [];
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

    // Simple YAML parsing (TODO: use proper YAML parser from core)
    const yaml = frontmatterMatch[1];
    const workflow: Workflow = {
      metadata: { id: path, name: path },
      steps: [],
    };

    // Extract metadata
    const idMatch = yaml.match(/id:\s*(.+)/);
    const nameMatch = yaml.match(/name:\s*["']?(.+?)["']?\s*$/m);
    const versionMatch = yaml.match(/version:\s*["']?(.+?)["']?\s*$/m);
    const descMatch = yaml.match(/description:\s*["']?(.+?)["']?\s*$/m);
    const authorMatch = yaml.match(/author:\s*["']?(.+?)["']?\s*$/m);

    if (idMatch) workflow.metadata.id = idMatch[1].trim();
    if (nameMatch) workflow.metadata.name = nameMatch[1].trim();
    if (versionMatch) workflow.metadata.version = versionMatch[1].trim();
    if (descMatch) workflow.metadata.description = descMatch[1].trim();
    if (authorMatch) workflow.metadata.author = authorMatch[1].trim();

    // Extract steps (simplified - real implementation uses @marktoflow/core)
    const stepsMatch = yaml.match(/steps:\s*\n([\s\S]*?)(?=\n\w|$)/);
    if (stepsMatch) {
      // Parse basic step structure
      const stepsYaml = stepsMatch[1];
      const stepMatches = stepsYaml.matchAll(/-\s*id:\s*(\S+)/g);
      for (const match of stepMatches) {
        workflow.steps.push({
          id: match[1],
          name: match[1],
          action: 'unknown',
          inputs: {},
        });
      }
    }

    return workflow;
  }

  private serializeWorkflow(workflow: Workflow): string {
    // TODO: Use proper YAML serializer and preserve markdown content
    const yaml = `---
workflow:
  id: ${workflow.metadata.id}
  name: "${workflow.metadata.name}"
  version: "${workflow.metadata.version || '1.0.0'}"
  description: "${workflow.metadata.description || ''}"
  author: "${workflow.metadata.author || ''}"
  tags: ${JSON.stringify(workflow.metadata.tags || [])}

steps:
${workflow.steps.map((step) => `  - id: ${step.id}
    name: "${step.name || step.id}"
    action: ${step.action || 'unknown'}
    inputs: ${JSON.stringify(step.inputs || {})}
    ${step.outputVariable ? `output_variable: ${step.outputVariable}` : ''}`).join('\n')}
---

# ${workflow.metadata.name}

${workflow.metadata.description || ''}
`;

    return yaml;
  }
}

function extractWorkflowName(content: string, filename: string): string {
  const nameMatch = content.match(/name:\s*["']?(.+?)["']?\s*$/m);
  if (nameMatch) {
    return nameMatch[1].trim();
  }

  // Fallback to filename without extension
  return filename.replace(/\.(md|yaml|yml)$/, '').replace(/-/g, ' ');
}

import { Router, type Request, type Response } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export const templateRoutes = Router();

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  path: string;
}

let cachedTemplates: Template[] | null = null;

// Get template list (seeded from examples/)
templateRoutes.get('/', async (req: Request, res: Response) => {
  try {
    if (cachedTemplates) {
      res.json({ templates: filterTemplates(cachedTemplates, req.query) });
      return;
    }

    const examplesDir = join(process.cwd(), 'examples');
    const templates: Template[] = [];

    try {
      const dirs = await readdir(examplesDir, { withFileTypes: true });
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;
        const workflowPath = join(examplesDir, dir.name, 'workflow.md');
        try {
          const content = await readFile(workflowPath, 'utf-8');
          const name = dir.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

          // Extract description from frontmatter
          const descMatch = content.match(/description:\s*['""]?(.+?)['""]?\s*$/m);
          const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);
          const tags = tagsMatch ? tagsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, '')) : [];

          templates.push({
            id: dir.name,
            name,
            description: descMatch?.[1] || `${name} workflow template`,
            category: inferCategory(dir.name, tags),
            tags,
            path: workflowPath,
          });
        } catch {
          // Skip directories without workflow.md
        }
      }
    } catch {
      // examples dir doesn't exist
    }

    // Add built-in templates
    templates.push(
      { id: 'blank', name: 'Blank Workflow', description: 'Start from scratch', category: 'basic', tags: ['starter'], path: '' },
      { id: 'api-integration', name: 'API Integration', description: 'Connect to any REST API', category: 'integration', tags: ['http', 'api'], path: '' },
      { id: 'data-pipeline', name: 'Data Pipeline', description: 'ETL workflow with transform steps', category: 'data', tags: ['transform', 'etl'], path: '' }
    );

    cachedTemplates = templates;
    res.json({ templates: filterTemplates(templates, req.query) });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list templates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get template content
templateRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const templates = cachedTemplates || [];
    const template = templates.find((t) => t.id === req.params.id);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    let content = '';
    if (template.path) {
      content = await readFile(template.path, 'utf-8');
    }

    res.json({ template, content });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get template',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function inferCategory(name: string, tags: string[]): string {
  const all = [name, ...tags].join(' ').toLowerCase();
  if (all.includes('review') || all.includes('pr')) return 'development';
  if (all.includes('slack') || all.includes('notification')) return 'communication';
  if (all.includes('incident') || all.includes('pager')) return 'operations';
  if (all.includes('sprint') || all.includes('standup')) return 'agile';
  if (all.includes('data') || all.includes('etl')) return 'data';
  return 'general';
}

function filterTemplates(templates: Template[], query: any): Template[] {
  let filtered = templates;
  if (query.category) {
    filtered = filtered.filter((t) => t.category === query.category);
  }
  if (query.search) {
    const search = (query.search as string).toLowerCase();
    filtered = filtered.filter((t) =>
      t.name.toLowerCase().includes(search) ||
      t.description.toLowerCase().includes(search) ||
      t.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  }
  return filtered;
}

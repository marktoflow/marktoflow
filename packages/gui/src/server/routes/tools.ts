import { Router, type Router as RouterType } from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const router: RouterType = Router();

// Tool definitions with SDK information and available actions
export interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  sdk?: string;
  actions: ActionDefinition[];
  authType?: 'token' | 'oauth' | 'api_key' | 'basic';
  docsUrl?: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  inputs?: InputSchema[];
  output?: OutputSchema;
}

export interface InputSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: unknown;
}

export interface OutputSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
}

// Load tool definitions from JSON data file
function loadToolDefinitions(): ToolDefinition[] {
  try {
    // Try multiple paths to find the data file
    const possiblePaths = [
      join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'tool-definitions.json'),
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server', 'data', 'tool-definitions.json'),
      join(process.cwd(), 'packages', 'gui', 'src', 'server', 'data', 'tool-definitions.json'),
    ];

    for (const p of possiblePaths) {
      try {
        const content = readFileSync(p, 'utf-8');
        return JSON.parse(content) as ToolDefinition[];
      } catch {
        continue;
      }
    }

    console.warn('Tool definitions file not found, returning empty list');
    return [];
  } catch {
    return [];
  }
}

const tools: ToolDefinition[] = loadToolDefinitions();

// List all available tools
router.get('/', (_req, res) => {
  const toolList = tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    icon: tool.icon,
    category: tool.category,
    description: tool.description,
    sdk: tool.sdk,
    authType: tool.authType,
    actionCount: tool.actions.length,
  }));

  res.json({ tools: toolList });
});

// Get detailed tool schema
router.get('/:toolId', (req, res) => {
  const { toolId } = req.params;
  const tool = tools.find((t) => t.id === toolId);

  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  res.json({ tool });
});

// Get action schema for a specific action
router.get('/:toolId/actions/:actionId', (req, res) => {
  const { toolId, actionId } = req.params;
  const tool = tools.find((t) => t.id === toolId);

  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  const action = tool.actions.find((a) => a.id === actionId);

  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }

  res.json({ action, tool: { id: tool.id, name: tool.name, sdk: tool.sdk } });
});

export { router as toolsRoutes };

/**
 * Auto-detect available AI agents by checking CLI tools, env vars, and running servers.
 */

import { execSync } from 'node:child_process';

export interface DetectedAgent {
  id: string;
  name: string;
  available: boolean;
  method: 'cli' | 'env' | 'server' | 'none';
  configHint: string;
}

interface AgentSpec {
  id: string;
  name: string;
  detect: () => { available: boolean; method: DetectedAgent['method'] };
  configHint: string;
}

function hasCli(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasEnvVar(name: string): boolean {
  return !!process.env[name];
}

function isServerReachable(url: string, timeoutMs = 1000): boolean {
  try {
    execSync(
      `curl -s --max-time ${Math.ceil(timeoutMs / 1000)} -o /dev/null -w "%{http_code}" ${url}`,
      { stdio: ['ignore', 'pipe', 'ignore'], timeout: timeoutMs + 500 }
    );
    return true;
  } catch {
    return false;
  }
}

const AGENT_SPECS: AgentSpec[] = [
  {
    id: 'claude-agent',
    name: 'Claude Agent',
    detect: () => {
      if (hasCli('claude')) return { available: true, method: 'cli' };
      if (hasEnvVar('ANTHROPIC_API_KEY')) return { available: true, method: 'env' };
      return { available: false, method: 'none' };
    },
    configHint: 'Install Claude CLI or set ANTHROPIC_API_KEY',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    detect: () => {
      if (hasEnvVar('OPENAI_API_KEY')) return { available: true, method: 'env' };
      return { available: false, method: 'none' };
    },
    configHint: 'Set OPENAI_API_KEY environment variable',
  },
  {
    id: 'codex',
    name: 'Codex',
    detect: () => {
      if (hasCli('codex')) return { available: true, method: 'cli' };
      return { available: false, method: 'none' };
    },
    configHint: 'Install Codex CLI: npm install -g @openai/codex',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    detect: () => {
      if (hasCli('copilot')) return { available: true, method: 'cli' };
      if (hasEnvVar('GITHUB_TOKEN')) return { available: true, method: 'env' };
      return { available: false, method: 'none' };
    },
    configHint: 'Install GitHub Copilot CLI or set GITHUB_TOKEN',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    detect: () => {
      if (hasCli('opencode')) return { available: true, method: 'cli' };
      return { available: false, method: 'none' };
    },
    configHint: 'Install OpenCode CLI: go install github.com/opencode-ai/opencode@latest',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    detect: () => {
      if (hasCli('ollama')) return { available: true, method: 'cli' };
      if (isServerReachable('http://localhost:11434/api/tags'))
        return { available: true, method: 'server' };
      return { available: false, method: 'none' };
    },
    configHint: 'Install Ollama: https://ollama.com/download',
  },
];

/**
 * Detect all known agents and return their availability status.
 */
export function detectAgents(): DetectedAgent[] {
  return AGENT_SPECS.map((spec) => {
    const { available, method } = spec.detect();
    return {
      id: spec.id,
      name: spec.name,
      available,
      method,
      configHint: spec.configHint,
    };
  });
}

/**
 * Detect a single agent by ID.
 */
export function detectAgent(id: string): DetectedAgent | undefined {
  const spec = AGENT_SPECS.find((s) => s.id === id);
  if (!spec) return undefined;
  const { available, method } = spec.detect();
  return { id: spec.id, name: spec.name, available, method, configHint: spec.configHint };
}

/**
 * Get the list of all known agent IDs.
 */
export function getKnownAgentIds(): string[] {
  return AGENT_SPECS.map((s) => s.id);
}

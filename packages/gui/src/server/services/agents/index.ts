/**
 * Agent Providers Module
 *
 * This module provides a unified interface for AI agent providers,
 * allowing the GUI to work with different backends:
 *
 * - Claude (Anthropic) - Full-featured AI with streaming support
 * - Ollama (Local) - Local LLM support via Ollama
 * - Demo Mode - Simulated responses for testing
 *
 * Usage:
 * ```typescript
 * import { getAgentRegistry } from './agents';
 *
 * const registry = getAgentRegistry();
 * await registry.autoDetectProvider();
 *
 * const result = await registry.processPrompt(
 *   "Add a Slack notification step",
 *   currentWorkflow
 * );
 * ```
 */

export * from './types.js';
export * from './registry.js';
export { ClaudeProvider, createClaudeProvider } from './claude-provider.js';
export { DemoProvider, createDemoProvider } from './demo-provider.js';
export { OllamaProvider, createOllamaProvider } from './ollama-provider.js';

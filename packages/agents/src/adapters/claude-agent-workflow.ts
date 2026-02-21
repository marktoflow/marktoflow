/**
 * Claude Agent Workflow Actions for marktoflow
 *
 * Provides workflow action handlers that expose the full Claude Agent SDK
 * capabilities to markdown workflows, including:
 * - Agentic task execution with built-in tools
 * - Subagent delegation
 * - Custom MCP tool integration
 * - Session management
 * - Streaming with callbacks
 */

import { z } from 'zod';
import {
  ClaudeAgentClient,
  ClaudeAgentOptions,
  BuiltInTool,
  SubagentDefinition,
  AgentResult,
  createCustomTool,
  createMcpServer,
} from './claude-agent.js';

// ============================================================================
// Workflow Action Schemas
// ============================================================================

/**
 * Schema for agent.run action
 */
export const AgentRunSchema = z.object({
  prompt: z.string().describe('The task for the agent to perform'),
  tools: z
    .array(
      z.enum([
        'Read',
        'Write',
        'Edit',
        'Bash',
        'Glob',
        'Grep',
        'WebSearch',
        'WebFetch',
        'Task',
        'TodoWrite',
      ])
    )
    .optional()
    .describe('Built-in tools to enable'),
  model: z.string().optional().describe('Model to use'),
  cwd: z.string().optional().describe('Working directory'),
  permissionMode: z
    .enum(['default', 'acceptEdits', 'bypassPermissions', 'plan'])
    .optional()
    .describe('Permission mode for tool execution'),
  maxTurns: z.number().optional().describe('Maximum conversation turns'),
  maxBudgetUsd: z.number().optional().describe('Maximum spending in USD'),
  systemPrompt: z.string().optional().describe('Custom system prompt'),
  resume: z.string().optional().describe('Session ID to resume'),
});

/**
 * Schema for agent.codeReview action
 */
export const AgentCodeReviewSchema = z.object({
  prompt: z.string().describe('What code to review'),
  focusAreas: z
    .array(z.string())
    .optional()
    .describe('Areas to focus on (security, performance, quality)'),
  severity: z
    .enum(['all', 'critical', 'high', 'medium'])
    .optional()
    .describe('Minimum severity to report'),
  outputFormat: z.enum(['markdown', 'json', 'sarif']).optional().describe('Output format'),
});

/**
 * Schema for agent.codeModify action
 */
export const AgentCodeModifySchema = z.object({
  prompt: z.string().describe('What modifications to make'),
  files: z.array(z.string()).optional().describe('Specific files to modify'),
  dryRun: z.boolean().optional().describe('Preview changes without applying'),
  createBackup: z.boolean().optional().describe('Create backup before modifying'),
});

/**
 * Schema for agent.research action
 */
export const AgentResearchSchema = z.object({
  prompt: z.string().describe('Research topic or question'),
  sources: z
    .array(z.enum(['web', 'codebase', 'docs']))
    .optional()
    .describe('Sources to search'),
  depth: z.enum(['quick', 'thorough', 'comprehensive']).optional().describe('Research depth'),
});

/**
 * Schema for agent.withSubagents action
 */
export const AgentWithSubagentsSchema = z.object({
  prompt: z.string().describe('Main task for orchestration'),
  agents: z
    .record(
      z.object({
        description: z.string(),
        tools: z.array(z.string()).optional(),
        prompt: z.string().optional(),
        model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
      })
    )
    .describe('Subagent definitions'),
});

/**
 * Schema for agent.withMcp action
 */
export const AgentWithMcpSchema = z.object({
  prompt: z.string().describe('Task to perform'),
  mcpServers: z
    .record(
      z.object({
        type: z.enum(['stdio', 'http', 'sse']),
        command: z.string().optional(),
        args: z.array(z.string()).optional(),
        url: z.string().optional(),
        env: z.record(z.string()).optional(),
      })
    )
    .describe('MCP server configurations'),
});

// ============================================================================
// Action Handler Types
// ============================================================================

export type AgentRunInput = z.infer<typeof AgentRunSchema>;
export type AgentCodeReviewInput = z.infer<typeof AgentCodeReviewSchema>;
export type AgentCodeModifyInput = z.infer<typeof AgentCodeModifySchema>;
export type AgentResearchInput = z.infer<typeof AgentResearchSchema>;
export type AgentWithSubagentsInput = z.infer<typeof AgentWithSubagentsSchema>;
export type AgentWithMcpInput = z.infer<typeof AgentWithMcpSchema>;

// ============================================================================
// Workflow Action Handlers
// ============================================================================

/**
 * Create a workflow-compatible Claude Agent client with action handlers
 *
 * Returns an object with methods that can be called from workflow actions:
 * - agent.run
 * - agent.codeReview
 * - agent.codeModify
 * - agent.research
 * - agent.withSubagents
 * - agent.withMcp
 */
export function createAgentActions(baseOptions?: ClaudeAgentOptions) {
  const client = new ClaudeAgentClient(baseOptions);

  return {
    /**
     * Run an agentic task with full capabilities
     *
     * Usage in workflow:
     * ```yaml
     * action: agent.run
     * inputs:
     *   prompt: "Find and fix all TypeScript errors"
     *   tools: [Read, Edit, Bash, Glob]
     *   permissionMode: acceptEdits
     * ```
     */
    async run(inputs: AgentRunInput): Promise<AgentResult> {
      const parsed = AgentRunSchema.parse(inputs);

      return client.run(parsed.prompt, {
        allowedTools: parsed.tools as BuiltInTool[],
        model: parsed.model,
        cwd: parsed.cwd,
        permissionMode: parsed.permissionMode,
        maxTurns: parsed.maxTurns,
        maxBudgetUsd: parsed.maxBudgetUsd,
        systemPrompt: parsed.systemPrompt,
        resume: parsed.resume,
      });
    },

    /**
     * Perform a comprehensive code review
     *
     * Usage in workflow:
     * ```yaml
     * action: agent.codeReview
     * inputs:
     *   prompt: "Review the authentication module for security issues"
     *   focusAreas: [security, performance]
     *   outputFormat: json
     * ```
     */
    async codeReview(inputs: AgentCodeReviewInput): Promise<AgentResult> {
      const parsed = AgentCodeReviewSchema.parse(inputs);

      const focusAreas = parsed.focusAreas || ['security', 'performance', 'quality', 'maintainability'];
      const severity = parsed.severity || 'all';
      const outputFormat = parsed.outputFormat || 'markdown';

      const systemPrompt = `You are an expert code reviewer. Focus on these areas: ${focusAreas.join(', ')}.
Report issues with severity ${severity === 'all' ? 'all levels' : `${severity} and above`}.
Format your response as ${outputFormat}.`;

      return client.codeReview(parsed.prompt, {
        systemPrompt,
        outputFormat:
          outputFormat === 'json'
            ? {
                type: 'json_schema',
                schema: {
                  type: 'object',
                  properties: {
                    issues: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          file: { type: 'string' },
                          line: { type: 'number' },
                          severity: { type: 'string' },
                          category: { type: 'string' },
                          description: { type: 'string' },
                          suggestion: { type: 'string' },
                        },
                      },
                    },
                    summary: { type: 'string' },
                    recommendation: { type: 'string' },
                  },
                },
              }
            : undefined,
      });
    },

    /**
     * Modify code with agent assistance
     *
     * Usage in workflow:
     * ```yaml
     * action: agent.codeModify
     * inputs:
     *   prompt: "Add TypeScript types to all function parameters"
     *   files: [src/utils.ts, src/helpers.ts]
     *   dryRun: false
     * ```
     */
    async codeModify(inputs: AgentCodeModifyInput): Promise<AgentResult> {
      const parsed = AgentCodeModifySchema.parse(inputs);

      let prompt = parsed.prompt;

      if (parsed.files && parsed.files.length > 0) {
        prompt += `\n\nFocus on these files: ${parsed.files.join(', ')}`;
      }

      if (parsed.dryRun) {
        prompt += '\n\nThis is a dry run - describe the changes but do not apply them.';
        return client.analyzeCode(prompt);
      }

      return client.modifyCode(prompt, {
        enableFileCheckpointing: parsed.createBackup,
      });
    },

    /**
     * Research a topic using web and codebase
     *
     * Usage in workflow:
     * ```yaml
     * action: agent.research
     * inputs:
     *   prompt: "What are the best practices for error handling in TypeScript?"
     *   sources: [web, codebase]
     *   depth: thorough
     * ```
     */
    async research(inputs: AgentResearchInput): Promise<AgentResult> {
      const parsed = AgentResearchSchema.parse(inputs);

      const sources = parsed.sources || ['web', 'codebase'];
      const depth = parsed.depth || 'thorough';

      // Determine tools based on sources
      const tools: BuiltInTool[] = [];
      if (sources.includes('web')) {
        tools.push('WebSearch', 'WebFetch');
      }
      if (sources.includes('codebase') || sources.includes('docs')) {
        tools.push('Read', 'Glob', 'Grep');
      }

      // Adjust max turns based on depth
      const maxTurns = depth === 'quick' ? 10 : depth === 'thorough' ? 25 : 50;

      return client.runWithTools(parsed.prompt, tools, { maxTurns });
    },

    /**
     * Orchestrate multiple specialized subagents
     *
     * Usage in workflow:
     * ```yaml
     * action: agent.withSubagents
     * inputs:
     *   prompt: "Analyze and improve the API module"
     *   agents:
     *     analyzer:
     *       description: "Analyze code structure"
     *       tools: [Read, Glob, Grep]
     *     improver:
     *       description: "Suggest and implement improvements"
     *       tools: [Read, Edit, Write]
     * ```
     */
    async withSubagents(inputs: AgentWithSubagentsInput): Promise<AgentResult> {
      const parsed = AgentWithSubagentsSchema.parse(inputs);

      return client.runWithSubagents(parsed.prompt, parsed.agents as Record<string, SubagentDefinition>);
    },

    /**
     * Run with external MCP servers
     *
     * Usage in workflow:
     * ```yaml
     * action: agent.withMcp
     * inputs:
     *   prompt: "Open the browser and navigate to example.com"
     *   mcpServers:
     *     playwright:
     *       type: stdio
     *       command: npx
     *       args: ["@playwright/mcp@latest"]
     * ```
     */
    async withMcp(inputs: AgentWithMcpInput): Promise<AgentResult> {
      const parsed = AgentWithMcpSchema.parse(inputs);

      return client.run(parsed.prompt, {
        mcpServers: parsed.mcpServers,
      });
    },

    /**
     * Generate a simple response (backwards compatible)
     */
    async generate(inputs: { prompt: string; model?: string } | string): Promise<string> {
      return client.generate(inputs);
    },

    /**
     * Resume a previous session
     */
    async resume(inputs: { sessionId: string; prompt: string }): Promise<AgentResult> {
      return client.resumeSession(inputs.sessionId, inputs.prompt);
    },

    /**
     * Get the underlying client for advanced use
     */
    getClient(): ClaudeAgentClient {
      return client;
    },
  };
}

// ============================================================================
// Preset Subagent Configurations
// ============================================================================

/**
 * Preset subagent configurations for common tasks
 */
export const PresetSubagents = {
  /**
   * Code review team
   */
  codeReviewTeam: {
    'code-reviewer': {
      description: 'Review code for quality, correctness, and best practices',
      tools: ['Read', 'Glob', 'Grep'] as BuiltInTool[],
      prompt: `You are a senior code reviewer. Focus on:
- Code quality and readability
- Potential bugs and edge cases
- Design patterns and architecture
- Performance considerations`,
    },
    'security-auditor': {
      description: 'Audit code for security vulnerabilities',
      tools: ['Read', 'Glob', 'Grep'] as BuiltInTool[],
      prompt: `You are a security expert. Look for:
- OWASP Top 10 vulnerabilities
- Injection attacks (SQL, XSS, command)
- Authentication and authorization issues
- Data exposure and privacy concerns
- Cryptographic weaknesses`,
    },
    'test-analyzer': {
      description: 'Analyze test coverage and quality',
      tools: ['Read', 'Glob', 'Grep', 'Bash'] as BuiltInTool[],
      prompt: `You are a testing expert. Analyze:
- Test coverage gaps
- Missing edge case tests
- Test quality and maintainability
- Suggest improvements`,
    },
  },

  /**
   * Documentation team
   */
  documentationTeam: {
    'doc-writer': {
      description: 'Write clear documentation',
      tools: ['Read', 'Write', 'Glob'] as BuiltInTool[],
      prompt: `You are a technical writer. Create:
- Clear, concise documentation
- Code examples and usage guides
- API documentation
- README files`,
    },
    'example-creator': {
      description: 'Create code examples',
      tools: ['Read', 'Write', 'Glob'] as BuiltInTool[],
      prompt: `You are an example creator. Write:
- Working code examples
- Step-by-step tutorials
- Best practice demonstrations`,
    },
  },

  /**
   * Refactoring team
   */
  refactoringTeam: {
    analyzer: {
      description: 'Analyze code for refactoring opportunities',
      tools: ['Read', 'Glob', 'Grep'] as BuiltInTool[],
      prompt: `You analyze code for:
- Code smells and anti-patterns
- Duplication
- Complex functions
- Tight coupling`,
    },
    refactorer: {
      description: 'Implement refactoring changes',
      tools: ['Read', 'Edit', 'Write', 'Glob'] as BuiltInTool[],
      prompt: `You implement refactoring:
- Extract methods and classes
- Simplify complex logic
- Apply design patterns
- Maintain functionality`,
    },
    verifier: {
      description: 'Verify refactoring correctness',
      tools: ['Read', 'Bash', 'Glob'] as BuiltInTool[],
      prompt: `You verify changes:
- Run tests
- Check type safety
- Verify behavior preservation`,
    },
  },
};

// ============================================================================
// MCP Tool Helpers
// ============================================================================

/**
 * Helper to create workflow-integrated MCP tools
 *
 * Example usage:
 * ```typescript
 * const dbTool = await createWorkflowTool(
 *   'query_database',
 *   'Query the application database',
 *   z.object({ query: z.string() }),
 *   async (args) => {
 *     const result = await db.query(args.query);
 *     return JSON.stringify(result);
 *   }
 * );
 * ```
 */
export async function createWorkflowTool<T extends z.ZodTypeAny>(
  name: string,
  description: string,
  schema: T,
  handler: (args: z.infer<T>) => Promise<string>
): Promise<unknown> {
  return createCustomTool(name, description, schema, async (args) => ({
    content: [{ type: 'text', text: await handler(args as z.infer<T>) }],
  }));
}

/**
 * Create an MCP server from workflow tool definitions
 */
export async function createWorkflowMcpServer(
  name: string,
  tools: Array<{
    name: string;
    description: string;
    schema: z.ZodTypeAny;
    handler: (args: unknown) => Promise<string>;
  }>
): Promise<unknown> {
  const mcpTools = await Promise.all(
    tools.map((t) => createWorkflowTool(t.name, t.description, t.schema, t.handler))
  );

  return createMcpServer(name, mcpTools);
}

// ============================================================================
// Export types
// ============================================================================

export type AgentActions = ReturnType<typeof createAgentActions>;

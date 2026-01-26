/**
 * GitHub Copilot Workflow Actions for marktoflow
 *
 * Provides workflow action handlers that expose the full GitHub Copilot SDK
 * capabilities to markdown workflows, including:
 * - Chat with streaming support
 * - Code review and analysis
 * - Custom tools and MCP servers
 * - Custom agents
 * - Session management
 */

import { z } from 'zod';
import {
  GitHubCopilotClient,
  type CopilotClientConfig,
  type CopilotSessionConfig,
  type CopilotResult,
  type CopilotToolDefinition,
  type CopilotAgentConfig,
  type CopilotMcpServerConfig,
  type CopilotAttachment,
} from './github-copilot.js';

// ============================================================================
// Workflow Action Schemas
// ============================================================================

/**
 * Schema for copilot.chat action
 */
export const CopilotChatSchema = z.object({
  prompt: z.string().describe('The message to send to Copilot'),
  model: z.string().optional().describe('Model to use (e.g., gpt-4.1, claude-sonnet-4.5)'),
  systemMessage: z.string().optional().describe('Custom system message'),
  attachments: z
    .array(
      z.object({
        type: z.enum(['file', 'directory']),
        path: z.string(),
        displayName: z.string().optional(),
      })
    )
    .optional()
    .describe('File or directory attachments'),
  streaming: z.boolean().optional().describe('Enable streaming mode'),
  sessionId: z.string().optional().describe('Session ID to resume'),
});

/**
 * Schema for copilot.codeReview action
 */
export const CopilotCodeReviewSchema = z.object({
  prompt: z.string().describe('Code review request'),
  files: z.array(z.string()).optional().describe('Files to review'),
  focusAreas: z
    .array(z.string())
    .optional()
    .describe('Areas to focus on (security, performance, quality)'),
  outputFormat: z.enum(['markdown', 'json']).optional().describe('Output format'),
});

/**
 * Schema for copilot.codeModify action
 */
export const CopilotCodeModifySchema = z.object({
  prompt: z.string().describe('Modification request'),
  files: z.array(z.string()).optional().describe('Files to modify'),
  dryRun: z.boolean().optional().describe('Preview changes without applying'),
});

/**
 * Schema for copilot.withTools action
 */
export const CopilotWithToolsSchema = z.object({
  prompt: z.string().describe('Task for Copilot'),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        parameters: z.record(z.unknown()).optional(),
      })
    )
    .describe('Tool definitions'),
  model: z.string().optional(),
  systemMessage: z.string().optional(),
});

/**
 * Schema for copilot.withAgents action
 */
export const CopilotWithAgentsSchema = z.object({
  prompt: z.string().describe('Task for orchestration'),
  agents: z
    .array(
      z.object({
        name: z.string(),
        displayName: z.string().optional(),
        description: z.string().optional(),
        tools: z.array(z.string()).optional(),
        prompt: z.string(),
      })
    )
    .describe('Custom agent definitions'),
  model: z.string().optional(),
});

/**
 * Schema for copilot.withMcp action
 */
export const CopilotWithMcpSchema = z.object({
  prompt: z.string().describe('Task to perform'),
  mcpServers: z
    .record(
      z.union([
        z.object({
          type: z.enum(['local', 'stdio']).optional(),
          tools: z.union([z.array(z.string()), z.literal('*')]),
          command: z.string(),
          args: z.array(z.string()),
          env: z.record(z.string()).optional(),
        }),
        z.object({
          type: z.enum(['http', 'sse']),
          tools: z.union([z.array(z.string()), z.literal('*')]),
          url: z.string(),
          headers: z.record(z.string()).optional(),
        }),
      ])
    )
    .describe('MCP server configurations'),
  model: z.string().optional(),
});

/**
 * Schema for copilot.listModels action
 */
export const CopilotListModelsSchema = z.object({}).describe('List available models');

/**
 * Schema for copilot.listSessions action
 */
export const CopilotListSessionsSchema = z.object({}).describe('List available sessions');

/**
 * Schema for copilot.deleteSession action
 */
export const CopilotDeleteSessionSchema = z.object({
  sessionId: z.string().describe('Session ID to delete'),
});

// ============================================================================
// Action Handler Types
// ============================================================================

export type CopilotChatInput = z.infer<typeof CopilotChatSchema>;
export type CopilotCodeReviewInput = z.infer<typeof CopilotCodeReviewSchema>;
export type CopilotCodeModifyInput = z.infer<typeof CopilotCodeModifySchema>;
export type CopilotWithToolsInput = z.infer<typeof CopilotWithToolsSchema>;
export type CopilotWithAgentsInput = z.infer<typeof CopilotWithAgentsSchema>;
export type CopilotWithMcpInput = z.infer<typeof CopilotWithMcpSchema>;

// ============================================================================
// Workflow Action Handlers
// ============================================================================

/**
 * Create workflow-compatible Copilot action handlers
 *
 * Returns an object with methods that can be called from workflow actions:
 * - copilot.chat
 * - copilot.codeReview
 * - copilot.codeModify
 * - copilot.withTools
 * - copilot.withAgents
 * - copilot.withMcp
 * - copilot.listModels
 * - copilot.listSessions
 * - copilot.deleteSession
 */
export function createCopilotActions(clientConfig?: CopilotClientConfig) {
  const client = new GitHubCopilotClient(clientConfig);

  return {
    /**
     * Send a chat message to Copilot
     *
     * Usage in workflow:
     * ```yaml
     * action: copilot.chat
     * inputs:
     *   prompt: "Explain this code"
     *   model: gpt-4.1
     *   attachments:
     *     - type: file
     *       path: ./src/index.ts
     * ```
     */
    async chat(inputs: CopilotChatInput): Promise<CopilotResult> {
      const parsed = CopilotChatSchema.parse(inputs);

      const sessionConfig: CopilotSessionConfig = {
        model: parsed.model,
        systemMessage: parsed.systemMessage,
        streaming: parsed.streaming,
      };

      if (parsed.sessionId) {
        return client.resumeAndSend(parsed.sessionId, {
          prompt: parsed.prompt,
          attachments: parsed.attachments as CopilotAttachment[],
        });
      }

      return client.sendWithSession(
        {
          prompt: parsed.prompt,
          attachments: parsed.attachments as CopilotAttachment[],
        },
        sessionConfig
      );
    },

    /**
     * Perform a code review
     *
     * Usage in workflow:
     * ```yaml
     * action: copilot.codeReview
     * inputs:
     *   prompt: "Review for security issues"
     *   files:
     *     - src/auth.ts
     *     - src/api.ts
     *   focusAreas: [security, performance]
     * ```
     */
    async codeReview(inputs: CopilotCodeReviewInput): Promise<CopilotResult> {
      const parsed = CopilotCodeReviewSchema.parse(inputs);

      const focusAreas = parsed.focusAreas || ['security', 'performance', 'quality', 'maintainability'];
      const outputFormat = parsed.outputFormat || 'markdown';

      let prompt = parsed.prompt;

      if (parsed.files && parsed.files.length > 0) {
        prompt += `\n\nFiles to review:\n${parsed.files.map((f) => `- ${f}`).join('\n')}`;
      }

      prompt += `\n\nFocus areas: ${focusAreas.join(', ')}`;
      prompt += `\n\nProvide your review in ${outputFormat} format.`;

      const systemMessage = `You are an expert code reviewer. Focus on these areas: ${focusAreas.join(', ')}.
For each issue found, provide:
- File path and line number (if applicable)
- Severity: critical, high, medium, low
- Category: ${focusAreas.join(', ')}
- Clear description
- Suggested fix

Be thorough but constructive.`;

      const attachments: CopilotAttachment[] =
        parsed.files?.map((f) => ({
          type: 'file' as const,
          path: f,
        })) || [];

      return client.sendWithSession(
        { prompt, attachments },
        { systemMessage, model: 'gpt-4.1' }
      );
    },

    /**
     * Modify code with Copilot assistance
     *
     * Usage in workflow:
     * ```yaml
     * action: copilot.codeModify
     * inputs:
     *   prompt: "Add TypeScript types to all function parameters"
     *   files: [src/utils.ts]
     *   dryRun: true
     * ```
     */
    async codeModify(inputs: CopilotCodeModifyInput): Promise<CopilotResult> {
      const parsed = CopilotCodeModifySchema.parse(inputs);

      let prompt = parsed.prompt;

      if (parsed.files && parsed.files.length > 0) {
        prompt += `\n\nFiles to modify:\n${parsed.files.map((f) => `- ${f}`).join('\n')}`;
      }

      if (parsed.dryRun) {
        prompt += '\n\nThis is a dry run - describe the changes you would make but do not apply them.';
      }

      const attachments: CopilotAttachment[] =
        parsed.files?.map((f) => ({
          type: 'file' as const,
          path: f,
        })) || [];

      return client.sendWithSession(
        { prompt, attachments },
        { model: 'gpt-4.1' }
      );
    },

    /**
     * Run with custom tools
     *
     * Usage in workflow:
     * ```yaml
     * action: copilot.withTools
     * inputs:
     *   prompt: "Get the weather and send a summary"
     *   tools:
     *     - name: get_weather
     *       description: Get weather for a location
     *       parameters:
     *         type: object
     *         properties:
     *           location: { type: string }
     * ```
     */
    async withTools(
      inputs: CopilotWithToolsInput,
      toolHandlers: Record<string, (args: unknown) => Promise<unknown>>
    ): Promise<CopilotResult> {
      const parsed = CopilotWithToolsSchema.parse(inputs);

      const tools: CopilotToolDefinition[] = parsed.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        handler: async (args: unknown) => {
          const handler = toolHandlers[t.name];
          if (!handler) {
            return { error: `No handler for tool: ${t.name}` };
          }
          return handler(args);
        },
      }));

      return client.sendWithSession(
        { prompt: parsed.prompt },
        {
          model: parsed.model,
          systemMessage: parsed.systemMessage,
          tools,
        }
      );
    },

    /**
     * Run with custom agents
     *
     * Usage in workflow:
     * ```yaml
     * action: copilot.withAgents
     * inputs:
     *   prompt: "Analyze and improve this module"
     *   agents:
     *     - name: analyzer
     *       description: Analyze code structure
     *       prompt: You are a code analysis expert...
     *     - name: improver
     *       description: Suggest improvements
     *       prompt: You are a code improvement expert...
     * ```
     */
    async withAgents(inputs: CopilotWithAgentsInput): Promise<CopilotResult> {
      const parsed = CopilotWithAgentsSchema.parse(inputs);

      const customAgents: CopilotAgentConfig[] = parsed.agents.map((a) => ({
        name: a.name,
        displayName: a.displayName,
        description: a.description,
        tools: a.tools || null,
        prompt: a.prompt,
      }));

      return client.sendWithSession(
        { prompt: parsed.prompt },
        {
          model: parsed.model,
          customAgents,
        }
      );
    },

    /**
     * Run with MCP servers
     *
     * Usage in workflow:
     * ```yaml
     * action: copilot.withMcp
     * inputs:
     *   prompt: "Open browser and navigate to example.com"
     *   mcpServers:
     *     playwright:
     *       tools: "*"
     *       command: npx
     *       args: ["@playwright/mcp@latest"]
     * ```
     */
    async withMcp(inputs: CopilotWithMcpInput): Promise<CopilotResult> {
      const parsed = CopilotWithMcpSchema.parse(inputs);

      return client.sendWithSession(
        { prompt: parsed.prompt },
        {
          model: parsed.model,
          mcpServers: parsed.mcpServers as Record<string, CopilotMcpServerConfig>,
        }
      );
    },

    /**
     * List available models
     */
    async listModels() {
      return client.listModels();
    },

    /**
     * List available sessions
     */
    async listSessions() {
      return client.listSessions();
    },

    /**
     * Delete a session
     */
    async deleteSession(inputs: { sessionId: string }) {
      const parsed = CopilotDeleteSessionSchema.parse(inputs);
      return client.deleteSession(parsed.sessionId);
    },

    /**
     * Get authentication status
     */
    async getAuthStatus() {
      return client.getAuthStatus();
    },

    /**
     * Get CLI status
     */
    async getStatus() {
      return client.getStatus();
    },

    /**
     * Get the underlying client for advanced use
     */
    getClient(): GitHubCopilotClient {
      return client;
    },
  };
}

// ============================================================================
// Preset Agent Configurations
// ============================================================================

/**
 * Preset custom agent configurations for common tasks
 */
export const CopilotPresetAgents = {
  /**
   * Code review team
   */
  codeReviewTeam: [
    {
      name: 'code-reviewer',
      displayName: 'Code Reviewer',
      description: 'Review code for quality and best practices',
      prompt: `You are a senior code reviewer. Focus on:
- Code quality and readability
- Potential bugs and edge cases
- Design patterns and architecture
- Performance considerations`,
    },
    {
      name: 'security-auditor',
      displayName: 'Security Auditor',
      description: 'Audit code for security vulnerabilities',
      prompt: `You are a security expert. Look for:
- OWASP Top 10 vulnerabilities
- Injection attacks (SQL, XSS, command)
- Authentication and authorization issues
- Data exposure and privacy concerns`,
    },
    {
      name: 'test-analyzer',
      displayName: 'Test Analyzer',
      description: 'Analyze test coverage and quality',
      prompt: `You are a testing expert. Analyze:
- Test coverage gaps
- Missing edge case tests
- Test quality and maintainability
- Suggest improvements`,
    },
  ],

  /**
   * Documentation team
   */
  documentationTeam: [
    {
      name: 'doc-writer',
      displayName: 'Documentation Writer',
      description: 'Write clear documentation',
      prompt: `You are a technical writer. Create:
- Clear, concise documentation
- Code examples and usage guides
- API documentation
- README files`,
    },
    {
      name: 'example-creator',
      displayName: 'Example Creator',
      description: 'Create code examples',
      prompt: `You create practical code examples:
- Working code examples
- Step-by-step tutorials
- Best practice demonstrations`,
    },
  ],

  /**
   * Refactoring team
   */
  refactoringTeam: [
    {
      name: 'analyzer',
      displayName: 'Code Analyzer',
      description: 'Analyze code for refactoring opportunities',
      prompt: `You analyze code for:
- Code smells and anti-patterns
- Duplication
- Complex functions
- Tight coupling`,
    },
    {
      name: 'refactorer',
      displayName: 'Refactorer',
      description: 'Implement refactoring changes',
      prompt: `You implement refactoring:
- Extract methods and classes
- Simplify complex logic
- Apply design patterns
- Maintain functionality`,
    },
  ],
};

// ============================================================================
// Export types
// ============================================================================

export type CopilotActions = ReturnType<typeof createCopilotActions>;

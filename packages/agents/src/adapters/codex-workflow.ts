/**
 * OpenAI Codex Workflow Actions for marktoflow
 *
 * Provides workflow action handlers that expose the full Codex SDK
 * capabilities to markdown workflows, including:
 * - Code generation and modification
 * - Web search and research
 * - Command execution
 * - Structured output
 * - Thread management (resume conversations)
 */

import { z } from 'zod';
import {
  CodexClient,
  type CodexClientOptions,
} from './codex.js';
import type {
  CodexResult,
  CodexThreadOptions,
  CodexTurnOptions,
  Input,
} from './codex-types.js';

// ============================================================================
// Workflow Action Schemas
// ============================================================================

/**
 * Schema for codex.chat action
 */
export const CodexChatSchema = z.object({
  prompt: z.string().describe('The message to send to Codex'),
  model: z.string().optional().describe('Model to use'),
  workingDirectory: z.string().optional().describe('Working directory for the agent'),
  reasoningEffort: z
    .enum(['minimal', 'low', 'medium', 'high', 'xhigh'])
    .optional()
    .describe('Model reasoning effort level'),
  sandboxMode: z
    .enum(['read-only', 'workspace-write', 'danger-full-access'])
    .optional()
    .describe('Sandbox mode for file system access'),
  webSearch: z.boolean().optional().describe('Enable web search'),
  threadId: z.string().optional().describe('Thread ID to resume'),
});

/**
 * Schema for codex.codeModify action
 */
export const CodexCodeModifySchema = z.object({
  prompt: z.string().describe('Code modification request'),
  workingDirectory: z.string().optional().describe('Working directory'),
  additionalDirectories: z.array(z.string()).optional().describe('Additional directories to access'),
  excludeFiles: z.array(z.string()).optional().describe('Files to exclude from context'),
  reasoningEffort: z
    .enum(['minimal', 'low', 'medium', 'high', 'xhigh'])
    .optional()
    .describe('Reasoning effort level'),
});

/**
 * Schema for codex.codeAnalyze action
 */
export const CodexCodeAnalyzeSchema = z.object({
  prompt: z.string().describe('Code analysis request'),
  workingDirectory: z.string().optional().describe('Working directory'),
  additionalDirectories: z.array(z.string()).optional().describe('Additional directories to access'),
  excludeFiles: z.array(z.string()).optional().describe('Files to exclude from context'),
});

/**
 * Schema for codex.codeReview action
 */
export const CodexCodeReviewSchema = z.object({
  prompt: z.string().describe('Code review request'),
  files: z.array(z.string()).optional().describe('Files to review'),
  focusAreas: z
    .array(z.string())
    .optional()
    .describe('Areas to focus on (security, performance, quality)'),
  workingDirectory: z.string().optional().describe('Working directory'),
});

/**
 * Schema for codex.webSearch action
 */
export const CodexWebSearchSchema = z.object({
  prompt: z.string().describe('Research query'),
  searchMode: z.enum(['cached', 'live']).optional().describe('Web search mode'),
});

/**
 * Schema for codex.execute action
 */
export const CodexExecuteSchema = z.object({
  prompt: z.string().describe('Command execution request'),
  workingDirectory: z.string().optional().describe('Working directory'),
  approvalPolicy: z
    .enum(['never', 'on-request', 'on-failure', 'untrusted'])
    .optional()
    .describe('Command approval policy'),
});

/**
 * Schema for codex.structured action
 */
export const CodexStructuredSchema = z.object({
  prompt: z.string().describe('Task for structured output'),
  schema: z.record(z.unknown()).describe('JSON schema for output'),
  workingDirectory: z.string().optional().describe('Working directory'),
});

/**
 * Schema for codex.resume action
 */
export const CodexResumeSchema = z.object({
  threadId: z.string().describe('Thread ID to resume'),
  prompt: z.string().describe('Follow-up message'),
  workingDirectory: z.string().optional().describe('Working directory'),
});

/**
 * Schema for codex.withImages action
 */
export const CodexWithImagesSchema = z.object({
  prompt: z.string().describe('Task with images'),
  images: z.array(z.string()).describe('Paths to local images'),
  workingDirectory: z.string().optional().describe('Working directory'),
});

// ============================================================================
// Action Handler Types
// ============================================================================

export type CodexChatInput = z.infer<typeof CodexChatSchema>;
export type CodexCodeModifyInput = z.infer<typeof CodexCodeModifySchema>;
export type CodexCodeAnalyzeInput = z.infer<typeof CodexCodeAnalyzeSchema>;
export type CodexCodeReviewInput = z.infer<typeof CodexCodeReviewSchema>;
export type CodexWebSearchInput = z.infer<typeof CodexWebSearchSchema>;
export type CodexExecuteInput = z.infer<typeof CodexExecuteSchema>;
export type CodexStructuredInput = z.infer<typeof CodexStructuredSchema>;
export type CodexResumeInput = z.infer<typeof CodexResumeSchema>;
export type CodexWithImagesInput = z.infer<typeof CodexWithImagesSchema>;

// ============================================================================
// Workflow Action Handlers
// ============================================================================

/**
 * Create workflow-compatible Codex action handlers
 *
 * Returns an object with methods that can be called from workflow actions:
 * - codex.chat
 * - codex.codeModify
 * - codex.codeAnalyze
 * - codex.codeReview
 * - codex.webSearch
 * - codex.execute
 * - codex.structured
 * - codex.resume
 * - codex.withImages
 */
export function createCodexActions(clientConfig?: CodexClientOptions) {
  const client = new CodexClient(clientConfig);

  return {
    /**
     * Send a chat message to Codex
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.chat
     * inputs:
     *   prompt: "Explain how this codebase works"
     *   workingDirectory: ./src
     *   reasoningEffort: medium
     * ```
     */
    async chat(inputs: CodexChatInput): Promise<CodexResult> {
      const parsed = CodexChatSchema.parse(inputs);

      const threadOptions: CodexThreadOptions = {
        model: parsed.model,
        workingDirectory: parsed.workingDirectory || process.cwd(),
        modelReasoningEffort: parsed.reasoningEffort,
        sandboxMode: parsed.sandboxMode || 'workspace-write',
        skipGitRepoCheck: true,
      };

      if (parsed.webSearch) {
        threadOptions.webSearchMode = 'live';
        threadOptions.networkAccessEnabled = true;
      }

      if (parsed.threadId) {
        return client.resumeAndSend(
          parsed.threadId,
          parsed.prompt,
          threadOptions
        );
      }

      return client.sendWithThread(parsed.prompt, threadOptions);
    },

    /**
     * Modify code with Codex assistance
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.codeModify
     * inputs:
     *   prompt: "Add TypeScript types to all functions"
     *   workingDirectory: ./src
     *   reasoningEffort: high
     * ```
     */
    async codeModify(inputs: CodexCodeModifyInput): Promise<CodexResult> {
      const parsed = CodexCodeModifySchema.parse(inputs);

      return client.modifyCode({
        prompt: parsed.prompt,
        workingDirectory: parsed.workingDirectory,
        additionalDirectories: parsed.additionalDirectories,
        excludeFiles: parsed.excludeFiles,
        reasoningEffort: parsed.reasoningEffort,
      });
    },

    /**
     * Analyze code without making changes
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.codeAnalyze
     * inputs:
     *   prompt: "Explain the architecture of this project"
     *   workingDirectory: ./
     * ```
     */
    async codeAnalyze(inputs: CodexCodeAnalyzeInput): Promise<CodexResult> {
      const parsed = CodexCodeAnalyzeSchema.parse(inputs);

      return client.analyzeCode({
        prompt: parsed.prompt,
        workingDirectory: parsed.workingDirectory,
        additionalDirectories: parsed.additionalDirectories,
        excludeFiles: parsed.excludeFiles,
      });
    },

    /**
     * Perform a code review
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.codeReview
     * inputs:
     *   prompt: "Review for security issues"
     *   files:
     *     - src/auth.ts
     *     - src/api.ts
     *   focusAreas: [security, performance]
     * ```
     */
    async codeReview(inputs: CodexCodeReviewInput): Promise<CodexResult> {
      const parsed = CodexCodeReviewSchema.parse(inputs);

      const focusAreas = parsed.focusAreas || [
        'security',
        'performance',
        'quality',
        'maintainability',
      ];

      let prompt = parsed.prompt;

      if (parsed.files && parsed.files.length > 0) {
        prompt += `\n\nFiles to review:\n${parsed.files.map((f) => `- ${f}`).join('\n')}`;
      }

      prompt += `\n\nFocus areas: ${focusAreas.join(', ')}`;

      prompt += `\n\nFor each issue found, provide:
- File path and line number (if applicable)
- Severity: critical, high, medium, low
- Category: ${focusAreas.join(', ')}
- Clear description
- Suggested fix`;

      return client.analyzeCode({
        prompt,
        workingDirectory: parsed.workingDirectory,
      });
    },

    /**
     * Perform web research
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.webSearch
     * inputs:
     *   prompt: "Find best practices for React hooks"
     *   searchMode: live
     * ```
     */
    async webSearch(inputs: CodexWebSearchInput): Promise<CodexResult> {
      const parsed = CodexWebSearchSchema.parse(inputs);

      return client.webSearch({
        prompt: parsed.prompt,
        searchMode: parsed.searchMode,
      });
    },

    /**
     * Execute commands via the agent
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.execute
     * inputs:
     *   prompt: "Run the test suite and fix any failing tests"
     *   workingDirectory: ./
     *   approvalPolicy: never
     * ```
     */
    async execute(inputs: CodexExecuteInput): Promise<CodexResult> {
      const parsed = CodexExecuteSchema.parse(inputs);

      return client.executeCommands({
        prompt: parsed.prompt,
        workingDirectory: parsed.workingDirectory,
        approvalPolicy: parsed.approvalPolicy,
      });
    },

    /**
     * Get structured JSON output
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.structured
     * inputs:
     *   prompt: "List all exported functions in this file"
     *   schema:
     *     type: object
     *     properties:
     *       functions:
     *         type: array
     *         items:
     *           type: object
     *           properties:
     *             name: { type: string }
     *             parameters: { type: array, items: { type: string } }
     *             returnType: { type: string }
     * ```
     */
    async structured<T = unknown>(inputs: CodexStructuredInput): Promise<T> {
      const parsed = CodexStructuredSchema.parse(inputs);

      return client.sendStructured<T>({
        prompt: parsed.prompt,
        schema: parsed.schema,
        threadOptions: {
          workingDirectory: parsed.workingDirectory,
          skipGitRepoCheck: true,
        },
      });
    },

    /**
     * Resume a previous thread
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.resume
     * inputs:
     *   threadId: "{{ previous_result.threadId }}"
     *   prompt: "Now add unit tests for those functions"
     * ```
     */
    async resume(inputs: CodexResumeInput): Promise<CodexResult> {
      const parsed = CodexResumeSchema.parse(inputs);

      return client.resumeAndSend(parsed.threadId, parsed.prompt, {
        workingDirectory: parsed.workingDirectory,
        skipGitRepoCheck: true,
      });
    },

    /**
     * Send with local images
     *
     * Usage in workflow:
     * ```yaml
     * action: codex.withImages
     * inputs:
     *   prompt: "Implement this UI based on the mockup"
     *   images:
     *     - ./mockups/dashboard.png
     *     - ./mockups/sidebar.png
     * ```
     */
    async withImages(inputs: CodexWithImagesInput): Promise<CodexResult> {
      const parsed = CodexWithImagesSchema.parse(inputs);

      const input: Input = [
        { type: 'text', text: parsed.prompt },
        ...parsed.images.map((path) => ({
          type: 'local_image' as const,
          path,
        })),
      ];

      return client.sendWithThread(input, {
        workingDirectory: parsed.workingDirectory,
        skipGitRepoCheck: true,
        sandboxMode: 'workspace-write',
      });
    },

    /**
     * Stream a response (for use in handlers that support streaming)
     *
     * Usage programmatically:
     * ```typescript
     * const actions = createCodexActions();
     * await actions.stream({
     *   prompt: "Explain this code",
     *   onChunk: (chunk) => console.log(chunk),
     * });
     * ```
     */
    async stream(inputs: {
      prompt: string | Input;
      threadOptions?: CodexThreadOptions;
      turnOptions?: CodexTurnOptions;
      onChunk?: (chunk: string) => void;
    }): Promise<CodexResult> {
      return client.stream({
        prompt: inputs.prompt,
        threadOptions: inputs.threadOptions,
        turnOptions: inputs.turnOptions,
        onChunk: inputs.onChunk,
      });
    },

    /**
     * Get the last thread ID (for resuming later)
     */
    getLastThreadId(): string | null {
      return client.getLastThreadId();
    },

    /**
     * Get the underlying client for advanced use
     */
    getClient(): CodexClient {
      return client;
    },
  };
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Preset thread configurations for common tasks
 */
export const CodexPresetConfigs = {
  /**
   * Read-only analysis - safe for reviewing code
   */
  readOnly: {
    sandboxMode: 'read-only' as const,
    skipGitRepoCheck: true,
    modelReasoningEffort: 'medium' as const,
  },

  /**
   * Code modification - can write to workspace
   */
  codeModification: {
    sandboxMode: 'workspace-write' as const,
    skipGitRepoCheck: true,
    modelReasoningEffort: 'high' as const,
  },

  /**
   * Full access - can execute commands
   */
  fullAccess: {
    sandboxMode: 'danger-full-access' as const,
    skipGitRepoCheck: true,
    approvalPolicy: 'never' as const,
    networkAccessEnabled: true,
  },

  /**
   * Research mode - web search enabled
   */
  research: {
    webSearchMode: 'live' as const,
    networkAccessEnabled: true,
    skipGitRepoCheck: true,
    sandboxMode: 'read-only' as const,
  },

  /**
   * High reasoning - for complex tasks
   */
  highReasoning: {
    modelReasoningEffort: 'xhigh' as const,
    skipGitRepoCheck: true,
    sandboxMode: 'workspace-write' as const,
  },
};

/**
 * Preset prompts for common code review tasks
 */
export const CodexReviewPrompts = {
  security: `Review this code for security vulnerabilities including:
- Injection attacks (SQL, XSS, command injection)
- Authentication and authorization issues
- Data exposure and privacy concerns
- Cryptographic weaknesses
- OWASP Top 10 vulnerabilities`,

  performance: `Review this code for performance issues including:
- Algorithm complexity (time and space)
- Database query optimization
- Memory leaks
- Unnecessary computations
- Caching opportunities`,

  quality: `Review this code for quality issues including:
- Code duplication
- Complex functions that should be split
- Poor naming conventions
- Missing error handling
- Lack of documentation`,

  typescript: `Review this TypeScript code for type safety including:
- Missing type annotations
- Use of 'any' type
- Incorrect type assertions
- Missing null checks
- Generic type improvements`,
};

// ============================================================================
// Export types
// ============================================================================

export type CodexActions = ReturnType<typeof createCodexActions>;

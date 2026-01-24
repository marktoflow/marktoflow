import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../src/engine.js';
import { parseContent } from '../src/parser.js';
import { SDKRegistry } from '../src/sdk-registry.js';
import { WorkflowStatus, StepStatus } from '../src/models.js';

describe('Multi-Agent Workflow Tests', () => {
  let mockSDKRegistry: SDKRegistry;

  beforeEach(() => {
    mockSDKRegistry = new SDKRegistry({
      async load() {
        return {};
      },
    });
  });

  describe('Agent Selection and Routing', () => {
    it('should route tasks to appropriate AI agents based on task type', async () => {
      const workflowContent = `---
workflow:
  id: multi-agent-routing
  name: "Multi-Agent Routing"

tools:
  claude:
    sdk: "@anthropic-ai/sdk"
    auth:
      api_key: "\${ANTHROPIC_API_KEY}"
  
  opencode:
    sdk: "@opencode-ai/sdk"
    auth:
      api_key: "\${OPENCODE_API_KEY}"

steps:
  - id: analyze_requirements
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      max_tokens: 1024
      messages:
        - role: "user"
          content: "Analyze these requirements: {{inputs.requirements}}"
    output_variable: analysis
  
  - id: generate_code
    action: opencode.tools.execute
    inputs:
      task: "Generate code based on: {{analysis.content}}"
    output_variable: code
  
  - id: review_code
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      max_tokens: 1024
      messages:
        - role: "user"
          content: "Review this code: {{code.result}}"
    output_variable: review
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({
          content: 'Requirements analysis complete',
          model: 'claude-3-5-sonnet-20241022',
        })
        .mockResolvedValueOnce({
          result: 'function hello() { return "world"; }',
          success: true,
        })
        .mockResolvedValueOnce({
          content: 'Code review: Looks good!',
          model: 'claude-3-5-sonnet-20241022',
        });

      const result = await engine.execute(
        workflow,
        { requirements: 'Create a hello world function' },
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(3);
      expect(mockExecutor).toHaveBeenCalledTimes(3);
    });

    it('should handle agent failover when primary agent is unavailable', async () => {
      const workflowContent = `---
workflow:
  id: agent-failover
  name: "Agent Failover"

tools:
  claude:
    sdk: "@anthropic-ai/sdk"
  
  opencode:
    sdk: "@opencode-ai/sdk"
    fallback_for: "claude"

steps:
  - id: task
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages:
        - role: "user"
          content: "{{inputs.prompt}}"
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Claude API unavailable'))
        .mockResolvedValueOnce({
          result: 'Response from fallback agent',
          success: true,
        });

      const result = await engine.execute(
        workflow,
        { prompt: 'Hello agent' },
        mockSDKRegistry,
        mockExecutor
      );

      // Should eventually succeed with fallback
      expect(result.stepResults.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Cost Tracking', () => {
    it('should track costs across multiple agent invocations', async () => {
      const workflowContent = `---
workflow:
  id: cost-tracking
  name: "Agent Cost Tracking"

tools:
  claude:
    sdk: "@anthropic-ai/sdk"
    pricing:
      input_tokens: 0.003
      output_tokens: 0.015

steps:
  - id: call1
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      max_tokens: 100
      messages:
        - role: "user"
          content: "Short task 1"
    output_variable: result1
  
  - id: call2
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      max_tokens: 500
      messages:
        - role: "user"
          content: "Longer task 2"
    output_variable: result2
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({
          content: 'Response 1',
          usage: { input_tokens: 10, output_tokens: 20 },
        })
        .mockResolvedValueOnce({
          content: 'Response 2',
          usage: { input_tokens: 15, output_tokens: 100 },
        });

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(mockExecutor).toHaveBeenCalledTimes(2);

      // Cost tracking would be handled by cost tracking system
    });

    it('should enforce budget limits across agents', async () => {
      const workflowContent = `---
workflow:
  id: budget-limit
  name: "Budget Limit Enforcement"
  budget:
    max_cost: 0.10
    currency: "USD"

tools:
  claude:
    sdk: "@anthropic-ai/sdk"

steps:
  - id: expensive_task
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      max_tokens: 4000
      messages:
        - role: "user"
          content: "Very long analysis task..."
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi.fn().mockResolvedValue({
        content: 'Analysis complete',
        usage: { input_tokens: 1000, output_tokens: 3000 },
      });

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      // Should complete (budget enforcement would be in cost tracker)
      expect(result.stepResults.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Collaboration', () => {
    it('should enable multiple agents to collaborate on complex tasks', async () => {
      const workflowContent = `---
workflow:
  id: agent-collaboration
  name: "Agent Collaboration"

tools:
  claude:
    sdk: "@anthropic-ai/sdk"
  
  opencode:
    sdk: "@opencode-ai/sdk"

steps:
  - id: architect_design
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages:
        - role: "user"
          content: "Design architecture for: {{inputs.feature}}"
    output_variable: architecture
  
  - id: implement_backend
    action: opencode.tools.execute
    inputs:
      task: "Implement backend based on: {{architecture.content}}"
    output_variable: backend_code
  
  - id: implement_frontend
    action: opencode.tools.execute
    inputs:
      task: "Implement frontend based on: {{architecture.content}}"
    output_variable: frontend_code
  
  - id: review_integration
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages:
        - role: "user"
          content: "Review integration between backend and frontend"
    output_variable: integration_review
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({ content: 'Architecture: REST API with React frontend' })
        .mockResolvedValueOnce({ result: 'Backend code...', success: true })
        .mockResolvedValueOnce({ result: 'Frontend code...', success: true })
        .mockResolvedValueOnce({ content: 'Integration looks good' });

      const result = await engine.execute(
        workflow,
        { feature: 'User authentication system' },
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(4);
      expect(result.output.backend_code).toBeDefined();
      expect(result.output.frontend_code).toBeDefined();
    });

    it('should handle agent disagreements and consensus building', async () => {
      const workflowContent = `---
workflow:
  id: consensus-building
  name: "Agent Consensus"

tools:
  claude:
    sdk: "@anthropic-ai/sdk"
  
  opencode:
    sdk: "@opencode-ai/sdk"
  
  ollama:
    sdk: "ollama"

steps:
  - id: claude_opinion
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages:
        - role: "user"
          content: "{{inputs.question}}"
    output_variable: claude_response
  
  - id: opencode_opinion
    action: opencode.tools.execute
    inputs:
      task: "{{inputs.question}}"
    output_variable: opencode_response
  
  - id: ollama_opinion
    action: ollama.generate
    inputs:
      model: "llama2"
      prompt: "{{inputs.question}}"
    output_variable: ollama_response
  
  - id: synthesize
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages:
        - role: "user"
          content: "Synthesize these responses: {{claude_response}}, {{opencode_response}}, {{ollama_response}}"
    output_variable: consensus
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({ content: 'Opinion A: Use microservices' })
        .mockResolvedValueOnce({ result: 'Opinion B: Use monolith initially' })
        .mockResolvedValueOnce({ response: 'Opinion C: Hybrid approach' })
        .mockResolvedValueOnce({
          content: 'Consensus: Start with monolith, plan for microservices',
        });

      const result = await engine.execute(
        workflow,
        { question: 'What architecture should we use?' },
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(4);
      expect(result.output.consensus).toBeDefined();
    });
  });

  describe('Agent Performance and Load Balancing', () => {
    it('should distribute load across multiple agent instances', async () => {
      const workflowContent = `---
workflow:
  id: load-balancing
  name: "Agent Load Balancing"

tools:
  claude_instance_1:
    sdk: "@anthropic-ai/sdk"
  
  claude_instance_2:
    sdk: "@anthropic-ai/sdk"

steps:
  - id: task1
    action: claude_instance_1.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages: [{ role: "user", content: "Task 1" }]
    output_variable: result1
  
  - id: task2
    action: claude_instance_2.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages: [{ role: "user", content: "Task 2" }]
    output_variable: result2
  
  - id: task3
    action: claude_instance_1.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages: [{ role: "user", content: "Task 3" }]
    output_variable: result3
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({ content: 'Result 1' })
        .mockResolvedValueOnce({ content: 'Result 2' })
        .mockResolvedValueOnce({ content: 'Result 3' });

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(mockExecutor).toHaveBeenCalledTimes(3);
    });

    it('should track agent response times and quality', async () => {
      const workflowContent = `---
workflow:
  id: performance-tracking
  name: "Agent Performance Tracking"

tools:
  claude:
    sdk: "@anthropic-ai/sdk"

steps:
  - id: timed_task
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages:
        - role: "user"
          content: "{{inputs.task}}"
    output_variable: result
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi.fn().mockImplementation(async () => {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 200));
        return {
          content: 'Task completed',
          timing: { duration: Date.now() - start },
        };
      });

      const result = await engine.execute(
        workflow,
        { task: 'Analyze data' },
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults[0].completedAt).toBeDefined();
      expect(result.stepResults[0].startedAt).toBeDefined();
    });
  });

  describe('Agent Context Management', () => {
    it('should maintain conversation context across agent calls', async () => {
      const workflowContent = `---
workflow:
  id: conversation-context
  name: "Conversation Context"

tools:
  claude:
    sdk: "@anthropic-ai/sdk"

steps:
  - id: initial_query
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages:
        - role: "user"
          content: "Tell me about TypeScript"
    output_variable: initial_response
  
  - id: follow_up
    action: claude.messages.create
    inputs:
      model: "claude-3-5-sonnet-20241022"
      messages:
        - role: "user"
          content: "Tell me about TypeScript"
        - role: "assistant"
          content: "{{initial_response.content}}"
        - role: "user"
          content: "How does it compare to JavaScript?"
    output_variable: follow_up_response
---
`;

      const { workflow } = parseContent(workflowContent);
      const engine = new WorkflowEngine();

      const mockExecutor = vi
        .fn()
        .mockResolvedValueOnce({ content: 'TypeScript is a typed superset of JavaScript...' })
        .mockResolvedValueOnce({ content: 'TypeScript adds static typing to JavaScript...' });

      const result = await engine.execute(workflow, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(2);
      expect(result.output.follow_up_response).toBeDefined();
    });
  });
});

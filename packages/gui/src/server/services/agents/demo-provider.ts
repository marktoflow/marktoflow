/**
 * Demo AI agent provider
 * Provides simulated responses for testing without an API key
 */

import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';

export class DemoProvider implements AgentProvider {
  readonly id = 'demo';
  readonly name = 'Demo Mode (No API)';
  readonly capabilities: AgentCapabilities = {
    streaming: false,
    toolUse: false,
    codeExecution: false,
    systemPrompts: false,
    models: ['demo'],
  };

  private ready: boolean = true;

  async initialize(_config: AgentConfig): Promise<void> {
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): { ready: boolean; model?: string; error?: string } {
    return { ready: true, model: 'demo' };
  }

  async processPrompt(prompt: string, workflow: Workflow): Promise<PromptResult> {
    const promptLower = prompt.toLowerCase();
    let explanation = '';
    const modifiedWorkflow = { ...workflow, steps: [...(workflow.steps || [])] };

    // Simulate different responses based on prompt patterns
    if (promptLower.includes('add') && promptLower.includes('slack')) {
      modifiedWorkflow.steps.push({
        id: `slack-${Date.now()}`,
        name: 'Send Slack Notification',
        action: 'slack.chat.postMessage',
        inputs: { channel: '#general', text: 'Workflow completed successfully!' },
        outputVariable: 'slack_result',
      });
      explanation = 'Added a Slack notification step at the end of the workflow.';
    } else if (promptLower.includes('add') && promptLower.includes('github')) {
      modifiedWorkflow.steps.push({
        id: `github-${Date.now()}`,
        name: 'Create GitHub Issue',
        action: 'github.issues.create',
        inputs: { owner: '{{ inputs.owner }}', repo: '{{ inputs.repo }}', title: 'New Issue' },
        outputVariable: 'issue_result',
      });
      explanation = 'Added a GitHub issue creation step.';
    } else if (promptLower.includes('error') || promptLower.includes('retry')) {
      modifiedWorkflow.steps = modifiedWorkflow.steps.map((step) => ({
        ...step,
        errorHandling: { action: 'retry' as const, maxRetries: 3 },
      }));
      explanation = 'Added error handling with 3 retries to all steps.';
    } else if (promptLower.includes('condition')) {
      if (modifiedWorkflow.steps.length > 0) {
        modifiedWorkflow.steps[modifiedWorkflow.steps.length - 1] = {
          ...modifiedWorkflow.steps[modifiedWorkflow.steps.length - 1],
          conditions: ['{{ previous_step.success === true }}'],
        };
        explanation = 'Added a success condition to the last step.';
      }
    } else if (promptLower.includes('remove') || promptLower.includes('delete')) {
      if (modifiedWorkflow.steps.length > 0) {
        const removed = modifiedWorkflow.steps.pop();
        explanation = `Removed the last step "${removed?.name || removed?.id}".`;
      }
    } else {
      explanation = `Demo mode: I understood "${prompt}". In production, this would use Claude or another AI model to intelligently modify the workflow.`;
    }

    return {
      explanation,
      workflow: modifiedWorkflow,
    };
  }

  async getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]> {
    const suggestions: string[] = [];

    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      return [
        'Add a Slack notification step',
        'Add a GitHub integration',
        'Add an HTTP request step',
      ];
    }

    suggestions.push(
      'Add error handling to all steps',
      'Add a notification at the end',
      'Add a condition to the workflow'
    );

    if (selectedStepId) {
      const step = workflow.steps.find((s) => s.id === selectedStepId);
      if (step) {
        suggestions.push(
          `Add retry logic to "${step.name || step.id}"`,
          `Duplicate "${step.name || step.id}"`
        );
      }
    }

    return suggestions.slice(0, 5);
  }
}

export function createDemoProvider(): DemoProvider {
  return new DemoProvider();
}

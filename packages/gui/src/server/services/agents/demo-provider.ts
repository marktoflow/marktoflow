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
import { generateSuggestions, AVAILABLE_SERVICES } from './prompts.js';

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

    // Detect which service is being requested
    const serviceMatch = Object.keys(AVAILABLE_SERVICES).find((s) =>
      promptLower.includes(s.toLowerCase())
    );

    // Simulate different responses based on prompt patterns
    if (promptLower.includes('add') && serviceMatch) {
      const service = AVAILABLE_SERVICES[serviceMatch as keyof typeof AVAILABLE_SERVICES];
      const action = service.commonActions[0];
      const stepId = `${serviceMatch}-${Date.now().toString(36)}`;

      const newStep: any = {
        id: stepId,
        name: `${serviceMatch.charAt(0).toUpperCase() + serviceMatch.slice(1)} Action`,
        action: `${serviceMatch}.${action}`,
        inputs: this.generateDefaultInputs(serviceMatch, action),
        outputVariable: `${serviceMatch}_result`,
      };

      modifiedWorkflow.steps.push(newStep);
      explanation = `Added a ${serviceMatch} step using ${serviceMatch}.${action}. The step is configured with default inputs that you should customize.`;
    } else if (promptLower.includes('error') || promptLower.includes('retry') || promptLower.includes('handling')) {
      const maxRetries = promptLower.match(/(\d+)\s*(retry|retries|times)/)?.[1] || '3';
      modifiedWorkflow.steps = modifiedWorkflow.steps.map((step) => ({
        ...step,
        errorHandling: {
          action: 'retry' as const,
          maxRetries: parseInt(maxRetries),
          retryDelay: 1000,
        },
      }));
      explanation = `Added error handling with ${maxRetries} retries to all ${modifiedWorkflow.steps.length} steps.`;
    } else if (promptLower.includes('condition') || promptLower.includes('if') || promptLower.includes('when')) {
      if (modifiedWorkflow.steps.length > 0) {
        const condition = this.extractCondition(promptLower);
        modifiedWorkflow.steps[modifiedWorkflow.steps.length - 1] = {
          ...modifiedWorkflow.steps[modifiedWorkflow.steps.length - 1],
          conditions: [condition],
        };
        explanation = `Added condition "${condition}" to the last step.`;
      } else {
        explanation = 'No steps to add conditions to. Please add some steps first.';
      }
    } else if (promptLower.includes('remove') || promptLower.includes('delete')) {
      if (modifiedWorkflow.steps.length > 0) {
        // Try to find a specific step to remove
        const stepNameMatch = promptLower.match(/(?:remove|delete)\s+(?:the\s+)?["']?([^"']+)["']?\s+step/);
        if (stepNameMatch) {
          const targetName = stepNameMatch[1].toLowerCase();
          const index = modifiedWorkflow.steps.findIndex(
            (s) =>
              s.id.toLowerCase().includes(targetName) ||
              (s.name && s.name.toLowerCase().includes(targetName))
          );
          if (index >= 0) {
            const removed = modifiedWorkflow.steps.splice(index, 1)[0];
            explanation = `Removed step "${removed.name || removed.id}".`;
          } else {
            const removed = modifiedWorkflow.steps.pop();
            explanation = `Could not find a step matching "${targetName}". Removed the last step "${removed?.name || removed?.id}" instead.`;
          }
        } else {
          const removed = modifiedWorkflow.steps.pop();
          explanation = `Removed the last step "${removed?.name || removed?.id}".`;
        }
      } else {
        explanation = 'No steps to remove.';
      }
    } else if (promptLower.includes('notification') || promptLower.includes('notify')) {
      modifiedWorkflow.steps.push({
        id: `notify-${Date.now().toString(36)}`,
        name: 'Send Notification',
        action: 'slack.chat.postMessage',
        inputs: {
          channel: '#notifications',
          text: 'Workflow "{{ workflow.name }}" completed successfully!',
        },
        outputVariable: 'notification_result',
      });
      explanation = 'Added a Slack notification step at the end of the workflow.';
    } else if (promptLower.includes('http') || promptLower.includes('api') || promptLower.includes('request')) {
      const method = promptLower.includes('post') ? 'POST' : promptLower.includes('put') ? 'PUT' : 'GET';
      modifiedWorkflow.steps.push({
        id: `http-${Date.now().toString(36)}`,
        name: `HTTP ${method} Request`,
        action: 'http.request',
        inputs: {
          method,
          url: '{{ inputs.api_url }}',
          headers: { 'Content-Type': 'application/json' },
        },
        outputVariable: 'api_response',
      });
      explanation = `Added an HTTP ${method} request step. Configure the URL and any required headers.`;
    } else {
      explanation = `Demo mode: I understood "${prompt}". In production mode with Claude or Ollama, this would intelligently analyze your request and modify the workflow accordingly. For now, try commands like:\n- "Add a Slack notification"\n- "Add error handling with 5 retries"\n- "Add a condition to run only on success"\n- "Remove the last step"`;
    }

    return {
      explanation,
      workflow: modifiedWorkflow,
    };
  }

  async getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]> {
    // Use the shared suggestions generator
    return generateSuggestions(workflow, selectedStepId);
  }

  private generateDefaultInputs(service: string, _action: string): Record<string, unknown> {
    const defaults: Record<string, Record<string, unknown>> = {
      slack: { channel: '#general', text: 'Hello from Marktoflow!' },
      github: { owner: '{{ inputs.owner }}', repo: '{{ inputs.repo }}' },
      jira: { projectKey: '{{ inputs.project }}', summary: 'New Issue' },
      gmail: { to: '{{ inputs.email }}', subject: 'Notification', body: 'Hello!' },
      http: { method: 'GET', url: '{{ inputs.url }}' },
      linear: { title: 'New Issue', teamId: '{{ inputs.team_id }}' },
      notion: { parent: { database_id: '{{ inputs.database_id }}' } },
    };
    return defaults[service] || {};
  }

  private extractCondition(prompt: string): string {
    // Try to extract a meaningful condition from the prompt
    if (prompt.includes('success')) {
      return '{{ previous_step.success === true }}';
    }
    if (prompt.includes('fail')) {
      return '{{ previous_step.success === false }}';
    }
    if (prompt.includes('production')) {
      return '{{ inputs.environment === "production" }}';
    }
    return '{{ previous_step.success === true }}';
  }
}

export function createDemoProvider(): DemoProvider {
  return new DemoProvider();
}

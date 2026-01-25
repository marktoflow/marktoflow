// TODO: Import Anthropic SDK when ANTHROPIC_API_KEY is available
// import Anthropic from '@anthropic-ai/sdk';

interface Workflow {
  metadata: any;
  steps: any[];
  tools?: Record<string, any>;
  inputs?: Record<string, any>;
}

interface PromptResult {
  explanation: string;
  workflow?: Workflow;
  diff?: string;
}

interface PromptHistoryItem {
  prompt: string;
  response: string;
  timestamp: Date;
  success: boolean;
}

const SYSTEM_PROMPT = `You are an expert workflow automation assistant for Marktoflow, a markdown-based workflow automation framework.

Your role is to help users modify their workflows based on natural language requests. You should:

1. Understand the current workflow structure (YAML frontmatter with steps, inputs, tools)
2. Make precise modifications based on user requests
3. Explain what changes you made and why

When modifying workflows, follow these conventions:
- Each step has: id, name (optional), action (service.method), inputs, output_variable
- Actions use format: service.method (e.g., slack.chat.postMessage, github.pulls.get)
- Template variables use: {{ variable_name }} syntax
- Error handling can specify: action (stop/continue/retry), max_retries
- Conditions use JavaScript-like expressions

Available services: slack, github, jira, gmail, outlook, linear, notion, discord, airtable, confluence, http, claude, opencode, ollama

Respond with:
1. A brief explanation of the changes
2. The complete modified workflow in valid YAML format

Be concise and precise. Only make the requested changes.`;

export class AIService {
  private history: PromptHistoryItem[] = [];

  async processPrompt(prompt: string, workflow: Workflow): Promise<PromptResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Demo mode: simulate AI response
      return this.simulateResponse(prompt, workflow);
    }

    try {
      // TODO: Use actual Anthropic SDK
      // const anthropic = new Anthropic({ apiKey });
      // const response = await anthropic.messages.create({
      //   model: 'claude-sonnet-4-20250514',
      //   max_tokens: 4096,
      //   system: SYSTEM_PROMPT,
      //   messages: [
      //     {
      //       role: 'user',
      //       content: `Current workflow:\n\`\`\`yaml\n${JSON.stringify(workflow, null, 2)}\n\`\`\`\n\nUser request: ${prompt}`,
      //     },
      //   ],
      // });

      // For now, use simulation
      return this.simulateResponse(prompt, workflow);
    } catch (error) {
      this.history.unshift({
        prompt,
        response: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        success: false,
      });
      throw error;
    }
  }

  async getHistory(): Promise<PromptHistoryItem[]> {
    return this.history.slice(0, 20);
  }

  async getSuggestions(
    workflow: Workflow,
    selectedStepId?: string
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (!workflow || !workflow.steps) {
      return [
        'Add your first step',
        'Import a template workflow',
        'Connect to a service',
      ];
    }

    // Generic suggestions
    suggestions.push(
      'Add error handling to all steps',
      'Add a notification step at the end',
      'Convert steps to a sub-workflow'
    );

    // Step-specific suggestions
    if (selectedStepId) {
      const step = workflow.steps.find((s) => s.id === selectedStepId);
      if (step) {
        if (!step.errorHandling) {
          suggestions.push(`Add retry logic to "${step.name || step.id}"`);
        }
        suggestions.push(
          `Add a condition to "${step.name || step.id}"`,
          `Duplicate "${step.name || step.id}"`
        );
      }
    }

    return suggestions.slice(0, 5);
  }

  private simulateResponse(prompt: string, workflow: Workflow): PromptResult {
    const promptLower = prompt.toLowerCase();
    let explanation = '';
    let modifiedWorkflow = { ...workflow, steps: [...(workflow.steps || [])] };

    // Simple pattern matching for demo purposes
    if (promptLower.includes('add') && promptLower.includes('slack')) {
      const newStep = {
        id: `slack-${Date.now()}`,
        name: 'Send Slack Notification',
        action: 'slack.chat.postMessage',
        inputs: {
          channel: '#general',
          text: 'Workflow completed successfully!',
        },
        outputVariable: 'slack_result',
      };
      modifiedWorkflow.steps.push(newStep);
      explanation = 'Added a new Slack notification step at the end of the workflow. The message will be sent to #general channel.';
    } else if (promptLower.includes('add') && promptLower.includes('error')) {
      modifiedWorkflow.steps = modifiedWorkflow.steps.map((step) => ({
        ...step,
        errorHandling: {
          action: 'retry',
          maxRetries: 3,
        },
      }));
      explanation = 'Added error handling with 3 retries to all steps in the workflow.';
    } else if (promptLower.includes('add') && promptLower.includes('condition')) {
      if (modifiedWorkflow.steps.length > 0) {
        modifiedWorkflow.steps[modifiedWorkflow.steps.length - 1] = {
          ...modifiedWorkflow.steps[modifiedWorkflow.steps.length - 1],
          conditions: ['{{ previous_step.success === true }}'],
        };
        explanation = 'Added a condition to the last step to only run if the previous step succeeded.';
      } else {
        explanation = 'No steps to add conditions to. Please add some steps first.';
      }
    } else if (promptLower.includes('remove') || promptLower.includes('delete')) {
      if (modifiedWorkflow.steps.length > 0) {
        const removed = modifiedWorkflow.steps.pop();
        explanation = `Removed the last step "${removed?.name || removed?.id}" from the workflow.`;
      } else {
        explanation = 'No steps to remove.';
      }
    } else {
      explanation = `I understood your request: "${prompt}". In a full implementation, I would analyze the workflow and make the appropriate modifications. For now, this is running in demo mode without an API key.`;
    }

    this.history.unshift({
      prompt,
      response: explanation,
      timestamp: new Date(),
      success: true,
    });

    return {
      explanation,
      workflow: modifiedWorkflow,
    };
  }
}

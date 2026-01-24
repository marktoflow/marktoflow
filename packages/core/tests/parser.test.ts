import { describe, it, expect } from 'vitest';
import { parseContent, extractVariableReferences, ParseError } from '../src/parser.js';

describe('Parser', () => {
  describe('parseContent', () => {
    it('should parse a minimal workflow', () => {
      const content = `---
workflow:
  id: test-workflow
  name: "Test Workflow"

steps:
  - id: step1
    action: slack.chat.postMessage
    inputs:
      channel: "#general"
      text: "Hello"
---

# Test Workflow

This is a test.
`;

      const result = parseContent(content);

      expect(result.workflow.metadata.id).toBe('test-workflow');
      expect(result.workflow.metadata.name).toBe('Test Workflow');
      expect(result.workflow.steps).toHaveLength(1);
      expect(result.workflow.steps[0].action).toBe('slack.chat.postMessage');
    });

    it('should parse tools configuration', () => {
      const content = `---
workflow:
  id: test-tools
  name: "Test Tools"

tools:
  slack:
    sdk: "@slack/web-api"
    auth:
      token: "\${SLACK_TOKEN}"

steps:
  - id: step1
    action: slack.chat.postMessage
    inputs:
      channel: "#general"
---
`;

      const result = parseContent(content);

      expect(result.workflow.tools).toBeDefined();
      expect(result.workflow.tools['slack']).toBeDefined();
      expect(result.workflow.tools['slack'].sdk).toBe('@slack/web-api');
    });

    it('should parse steps from markdown code blocks', () => {
      const content = `---
workflow:
  id: markdown-steps
  name: "Markdown Steps"
---

# Workflow

## Step 1

\`\`\`yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "Hello"
output_variable: result
\`\`\`

## Step 2

\`\`\`yaml
action: jira.createIssue
inputs:
  project: TEST
  summary: "{{result.text}}"
\`\`\`
`;

      const result = parseContent(content);

      expect(result.workflow.steps).toHaveLength(2);
      expect(result.workflow.steps[0].action).toBe('slack.chat.postMessage');
      expect(result.workflow.steps[1].action).toBe('jira.createIssue');
    });

    it('should throw ParseError for missing frontmatter', () => {
      const content = `# No Frontmatter

Just some markdown.
`;

      expect(() => parseContent(content)).toThrow(ParseError);
    });

    it('should parse triggers', () => {
      const content = `---
workflow:
  id: with-triggers
  name: "With Triggers"

triggers:
  - type: schedule
    config:
      cron: "0 9 * * 1-5"
  - type: webhook
    config:
      path: /webhooks/my-hook

steps:
  - id: step1
    action: test.action
---
`;

      const result = parseContent(content);

      expect(result.workflow.triggers).toHaveLength(2);
      expect(result.workflow.triggers?.[0].type).toBe('schedule');
      expect(result.workflow.triggers?.[1].type).toBe('webhook');
    });

    it('should handle snake_case to camelCase conversion', () => {
      const content = `---
workflow:
  id: snake-case
  name: "Snake Case"

steps:
  - id: step1
    action: test.action
    output_variable: my_result
    error_handling:
      action: continue
      max_retries: 5
---
`;

      const result = parseContent(content);

      expect(result.workflow.steps[0].outputVariable).toBe('my_result');
      expect(result.workflow.steps[0].errorHandling?.action).toBe('continue');
      expect(result.workflow.steps[0].errorHandling?.maxRetries).toBe(5);
    });
  });

  describe('extractVariableReferences', () => {
    it('should extract simple variable references', () => {
      const refs = extractVariableReferences('Hello {{name}}!');
      expect(refs).toEqual(['name']);
    });

    it('should extract multiple variable references', () => {
      const refs = extractVariableReferences('{{first}} and {{second}}');
      expect(refs).toEqual(['first', 'second']);
    });

    it('should extract nested path references', () => {
      const refs = extractVariableReferences('Result: {{result.data.id}}');
      expect(refs).toEqual(['result.data.id']);
    });

    it('should return empty array for no references', () => {
      const refs = extractVariableReferences('No variables here');
      expect(refs).toEqual([]);
    });
  });
});

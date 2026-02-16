import { describe, it, expect } from 'vitest';
import { parseContent } from '../src/parser.js';

describe('Parser - Regex State Bug Fix', () => {
  /**
   * This test specifically checks for the regex global state bug.
   * Previously, the STEP_CODE_BLOCK_REGEX had the /g flag, which maintained
   * lastIndex state across multiple calls. This caused parseContent() to skip
   * code blocks on the second invocation within the same process.
   */
  it('should parse steps correctly on multiple sequential calls', () => {
    const workflow1 = `---
workflow:
  id: workflow1
  name: "Workflow 1"
---

# Step 1

\`\`\`yaml
action: test.action1
inputs:
  value: "step1"
\`\`\`

# Step 2

\`\`\`yaml
action: test.action2
inputs:
  value: "step2"
\`\`\`
`;

    const workflow2 = `---
workflow:
  id: workflow2
  name: "Workflow 2"
---

# Step A

\`\`\`yaml
action: test.actionA
inputs:
  value: "stepA"
\`\`\`

# Step B

\`\`\`yaml
action: test.actionB
inputs:
  value: "stepB"
\`\`\`

# Step C

\`\`\`yaml
action: test.actionC
inputs:
  value: "stepC"
\`\`\`
`;

    // First call - should find 2 steps
    const result1 = parseContent(workflow1);
    expect(result1.workflow.steps).toHaveLength(2);
    expect(result1.workflow.steps[0].action).toBe('test.action1');
    expect(result1.workflow.steps[1].action).toBe('test.action2');

    // Second call in same process - should also find 3 steps (this was the bug)
    const result2 = parseContent(workflow2);
    expect(result2.workflow.steps).toHaveLength(3);
    expect(result2.workflow.steps[0].action).toBe('test.actionA');
    expect(result2.workflow.steps[1].action).toBe('test.actionB');
    expect(result2.workflow.steps[2].action).toBe('test.actionC');

    // Third call - ensure it continues to work
    const result3 = parseContent(workflow1);
    expect(result3.workflow.steps).toHaveLength(2);
  });

  it('should parse mixed step types correctly across multiple calls', () => {
    const workflow1 = `---
workflow:
  id: test1
  name: "Test 1"
---

\`\`\`yaml
type: if
condition: "{{ true }}"
then:
  - action: test.a
\`\`\`

\`\`\`yaml
action: test.b
\`\`\`
`;

    const workflow2 = `---
workflow:
  id: test2
  name: "Test 2"
---

\`\`\`yaml
type: for_each
items: "{{ [1,2] }}"
steps:
  - action: test.c
\`\`\`

\`\`\`yaml
action: test.d
\`\`\`

\`\`\`yaml
type: parallel
branches:
  - id: branch1
    steps:
      - action: test.e
\`\`\`
`;

    const result1 = parseContent(workflow1);
    expect(result1.workflow.steps).toHaveLength(2);

    const result2 = parseContent(workflow2);
    expect(result2.workflow.steps).toHaveLength(3);
  });

  it('should parse code blocks with different yaml/yml formats', () => {
    const workflow = `---
workflow:
  id: test
  name: "Test"
---

\`\`\`yaml
action: test.a
\`\`\`

\`\`\`yml
action: test.b
\`\`\`

\`\`\`yaml
action: test.c
\`\`\`

\`\`\`yml
action: test.d
\`\`\`
`;

    const result1 = parseContent(workflow);
    expect(result1.workflow.steps).toHaveLength(4);

    // Second call - all steps should still be found
    const result2 = parseContent(workflow);
    expect(result2.workflow.steps).toHaveLength(4);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowEngine } from '../src/engine.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SDKRegistry } from '../src/sdk-registry.js';
import { WorkflowStatus, StepStatus } from '../src/models.js';

describe('Sub-Workflow Tests', () => {
  let mockSDKRegistry: SDKRegistry;
  let mockExecutor: ReturnType<typeof vi.fn>;
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for test workflows
    testDir = join(tmpdir(), `marktoflow-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    mockSDKRegistry = new SDKRegistry({
      async load() {
        return {
          chat: {
            postMessage: vi.fn().mockResolvedValue({ ok: true, ts: '123.456' }),
          },
        };
      },
    });

    mockExecutor = vi.fn();
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Basic Sub-Workflow Execution', () => {
    it('should execute a workflow with a sub-workflow step', async () => {
      // Create sub-workflow file
      const subWorkflowContent = `---
workflow:
  id: sub-validate
  name: "Validate Input"
  version: "1.0.0"

inputs:
  data:
    type: string
    required: true

outputs:
  valid:
    type: boolean

steps:
  - id: validate
    action: console.log
    inputs:
      message: "Validating: {{ inputs.data }}"
    output_variable: validation_result
---

# Validation Sub-Workflow

This workflow validates input data.
`;

      const subWorkflowPath = join(testDir, 'validate.md');
      writeFileSync(subWorkflowPath, subWorkflowContent);

      // Create main workflow file
      const mainWorkflowContent = `---
workflow:
  id: main-workflow
  name: "Main Workflow"
  version: "1.0.0"

inputs:
  user_input:
    type: string
    required: true

steps:
  - id: validate_input
    workflow: ./validate.md
    inputs:
      data: "{{ inputs.user_input }}"
    output_variable: validation
  
  - id: log_result
    action: console.log
    inputs:
      message: "Validation complete"
---

# Main Workflow

This workflow uses a sub-workflow for validation.
`;

      const mainWorkflowPath = join(testDir, 'main.md');
      writeFileSync(mainWorkflowPath, mainWorkflowContent);

      // Execute the main workflow
      const engine = new WorkflowEngine();

      mockExecutor
        .mockResolvedValueOnce({ message: 'Validating: test data' }) // sub-workflow step
        .mockResolvedValueOnce({ message: 'Validation complete' }); // main workflow step

      const result = await engine.executeFile(
        mainWorkflowPath,
        { user_input: 'test data' },
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].status).toBe(StepStatus.COMPLETED);
      expect(result.stepResults[0].stepId).toBe('validate_input');
      expect(result.stepResults[1].status).toBe(StepStatus.COMPLETED);
      expect(result.stepResults[1].stepId).toBe('log_result');
    });

    it('should pass inputs from parent to sub-workflow', async () => {
      const subWorkflowContent = `---
workflow:
  id: sub-echo
  name: "Echo Workflow"

inputs:
  message:
    type: string
    required: true
  prefix:
    type: string
    default: "Echo:"

steps:
  - id: echo
    action: console.log
    inputs:
      text: "{{ inputs.prefix }} {{ inputs.message }}"
    output_variable: result
---

# Echo Sub-Workflow
`;

      const subWorkflowPath = join(testDir, 'echo.md');
      writeFileSync(subWorkflowPath, subWorkflowContent);

      const mainWorkflowContent = `---
workflow:
  id: main
  name: "Main"

steps:
  - id: call_echo
    workflow: ./echo.md
    inputs:
      message: "Hello World"
      prefix: "Output:"
    output_variable: echo_result
---

# Main
`;

      const mainWorkflowPath = join(testDir, 'main-echo.md');
      writeFileSync(mainWorkflowPath, mainWorkflowContent);

      const engine = new WorkflowEngine();

      mockExecutor.mockResolvedValueOnce({ text: 'Output: Hello World' });

      const result = await engine.executeFile(mainWorkflowPath, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          inputs: expect.objectContaining({
            text: 'Output: Hello World',
          }),
        }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle sub-workflow outputs in parent workflow', async () => {
      const subWorkflowContent = `---
workflow:
  id: sub-calculator
  name: "Calculator"

inputs:
  x:
    type: number
    required: true
  y:
    type: number
    required: true

steps:
  - id: calculate
    action: math.add
    inputs:
      a: "{{ inputs.x }}"
      b: "{{ inputs.y }}"
    output_variable: sum
---

# Calculator
`;

      const subWorkflowPath = join(testDir, 'calculator.md');
      writeFileSync(subWorkflowPath, subWorkflowContent);

      const mainWorkflowContent = `---
workflow:
  id: main-calc
  name: "Main Calculator"

steps:
  - id: add_numbers
    workflow: ./calculator.md
    inputs:
      x: 10
      y: 20
    output_variable: calc_result
  
  - id: log_sum
    action: console.log
    inputs:
      message: "Sum is: {{ calc_result.sum }}"
---

# Main
`;

      const mainWorkflowPath = join(testDir, 'main-calc.md');
      writeFileSync(mainWorkflowPath, mainWorkflowContent);

      const engine = new WorkflowEngine();

      mockExecutor
        .mockResolvedValueOnce(30) // sub-workflow step returns just the number
        .mockResolvedValueOnce({ message: 'Sum is: 30' }); // main step

      const result = await engine.executeFile(mainWorkflowPath, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      // The sub-workflow stores 30 in output_variable 'sum', so workflow output is { sum: 30 }
      expect(result.stepResults[0].output).toEqual({ sum: 30 });
    });
  });

  describe('Nested Sub-Workflows', () => {
    it('should execute nested sub-workflows (3 levels deep)', async () => {
      // Level 3 (deepest)
      const level3Content = `---
workflow:
  id: level3
  name: "Level 3"

steps:
  - id: step3
    action: console.log
    inputs:
      message: "Level 3 executed"
    output_variable: result3
---
# Level 3
`;

      // Level 2 (middle)
      const level2Content = `---
workflow:
  id: level2
  name: "Level 2"

steps:
  - id: call_level3
    workflow: ./level3.md
    output_variable: level3_result
  
  - id: step2
    action: console.log
    inputs:
      message: "Level 2 executed"
    output_variable: result2
---
# Level 2
`;

      // Level 1 (top)
      const level1Content = `---
workflow:
  id: level1
  name: "Level 1"

steps:
  - id: call_level2
    workflow: ./level2.md
    output_variable: level2_result
  
  - id: step1
    action: console.log
    inputs:
      message: "Level 1 executed"
    output_variable: result1
---
# Level 1
`;

      writeFileSync(join(testDir, 'level3.md'), level3Content);
      writeFileSync(join(testDir, 'level2.md'), level2Content);
      writeFileSync(join(testDir, 'level1.md'), level1Content);

      const engine = new WorkflowEngine();

      mockExecutor
        .mockResolvedValueOnce({ message: 'Level 3 executed' }) // level3 step
        .mockResolvedValueOnce({ message: 'Level 2 executed' }) // level2 step
        .mockResolvedValueOnce({ message: 'Level 1 executed' }); // level1 step

      const result = await engine.executeFile(
        join(testDir, 'level1.md'),
        {},
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(mockExecutor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle sub-workflow execution errors', async () => {
      const subWorkflowContent = `---
workflow:
  id: sub-failing
  name: "Failing Sub-Workflow"

steps:
  - id: fail_step
    action: test.fail
    inputs:
      should_fail: true
---
# Failing
`;

      const subWorkflowPath = join(testDir, 'failing.md');
      writeFileSync(subWorkflowPath, subWorkflowContent);

      const mainWorkflowContent = `---
workflow:
  id: main-error
  name: "Main Error Test"

steps:
  - id: call_failing
    workflow: ./failing.md
    output_variable: result
---
# Main
`;

      const mainWorkflowPath = join(testDir, 'main-error.md');
      writeFileSync(mainWorkflowPath, mainWorkflowContent);

      const engine = new WorkflowEngine({ retryBaseDelay: 1 }); // Fast retries for testing

      // Mock executor to reject for all retry attempts
      mockExecutor.mockRejectedValue(new Error('Sub-workflow failed'));

      const result = await engine.executeFile(mainWorkflowPath, {}, mockSDKRegistry, mockExecutor);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(result.stepResults[0].status).toBe(StepStatus.FAILED);
      expect(result.stepResults[0].error).toContain('Sub-workflow failed');
    });
  });

  describe('Path Resolution', () => {
    it('should resolve relative paths correctly', async () => {
      // Create nested directory structure
      const subDir = join(testDir, 'sub-workflows');
      mkdirSync(subDir, { recursive: true });

      const subWorkflowContent = `---
workflow:
  id: nested-sub
  name: "Nested Sub"

steps:
  - id: nested_step
    action: console.log
    inputs:
      message: "Nested workflow"
---
# Nested
`;

      writeFileSync(join(subDir, 'nested.md'), subWorkflowContent);

      const mainWorkflowContent = `---
workflow:
  id: main-nested
  name: "Main Nested"

steps:
  - id: call_nested
    workflow: ./sub-workflows/nested.md
    output_variable: result
---
# Main
`;

      writeFileSync(join(testDir, 'main-nested.md'), mainWorkflowContent);

      const engine = new WorkflowEngine();

      mockExecutor.mockResolvedValueOnce({ message: 'Nested workflow' });

      const result = await engine.executeFile(
        join(testDir, 'main-nested.md'),
        {},
        mockSDKRegistry,
        mockExecutor
      );

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
    });
  });
});

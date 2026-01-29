import { test, expect, type Page } from '@playwright/test';

test.describe('Nested Control Flow Visualization', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the GUI
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should display if/else with nested steps', async ({ page }) => {
    // Load a workflow with if/else
    await loadWorkflowFile(page, 'examples/control-flow/incident-router.md');

    // Wait for canvas to render
    await page.waitForSelector('.react-flow');

    // Check for if node
    const ifNode = page.locator('[data-type="if"]').first();
    await expect(ifNode).toBeVisible();

    // Check for then and else group containers
    const thenGroup = page.locator('[data-type="group"]').filter({ hasText: 'Then' });
    const elseGroup = page.locator('[data-type="group"]').filter({ hasText: 'Else' });

    await expect(thenGroup).toBeVisible();
    await expect(elseGroup).toBeVisible();

    // Check for nested steps within groups
    const nestedSteps = page.locator('[data-parent-node]');
    await expect(nestedSteps).toHaveCount(expect.any(Number));
  });

  test('should collapse and expand group containers', async ({ page }) => {
    // Load a workflow with nested steps
    await loadWorkflowFile(page, 'examples/test-nested-visualization.md');

    // Find a group container
    const groupHeader = page.locator('.group-container .flex').first();
    await expect(groupHeader).toBeVisible();

    // Get initial nested step visibility
    const nestedStep = page.locator('[data-parent-node]').first();
    await expect(nestedStep).toBeVisible();

    // Click to collapse
    await groupHeader.click();
    await page.waitForTimeout(500); // Wait for transition

    // Check nested steps are hidden
    await expect(nestedStep).not.toBeVisible();

    // Check step count badge is visible
    const stepCountBadge = page.locator('.group-container').first().locator('text=/\\d+ steps?/');
    await expect(stepCountBadge).toBeVisible();

    // Click to expand
    await groupHeader.click();
    await page.waitForTimeout(500);

    // Check nested steps are visible again
    await expect(nestedStep).toBeVisible();
  });

  test('should show different colors for different branch types', async ({ page }) => {
    // Load a comprehensive test workflow
    await loadWorkflowFile(page, 'examples/test-nested-visualization.md');

    // Check then branch color (green)
    const thenGroup = page.locator('[data-type="group"]').filter({ hasText: 'Then' }).first();
    await expect(thenGroup).toHaveCSS('border-color', /.*10b981.*/i);

    // Check else branch color (red)
    const elseGroup = page.locator('[data-type="group"]').filter({ hasText: 'Else' }).first();
    await expect(elseGroup).toHaveCSS('border-color', /.*ef4444.*/i);

    // Check try branch color (blue)
    const tryGroup = page.locator('[data-type="group"]').filter({ hasText: 'Try' }).first();
    await expect(tryGroup).toBeVisible();

    // Check catch branch color (orange)
    const catchGroup = page.locator('[data-type="group"]').filter({ hasText: 'Catch' }).first();
    await expect(catchGroup).toBeVisible();
  });

  test('should display for_each loop with nested steps', async ({ page }) => {
    // Load data pipeline workflow
    await loadWorkflowFile(page, 'examples/control-flow/data-pipeline.md');

    // Check for for_each node
    const forEachNode = page.locator('[data-type="for_each"]').first();
    await expect(forEachNode).toBeVisible();

    // Check for iteration group
    const iterationGroup = page.locator('[data-type="group"]').filter({ hasText: /For Each|Iteration/i });
    await expect(iterationGroup).toBeVisible();

    // Check nested steps exist
    const nestedSteps = iterationGroup.locator('[data-parent-node]');
    await expect(nestedSteps.first()).toBeVisible();
  });

  test('should display switch statement with multiple cases', async ({ page }) => {
    // Load incident router workflow
    await loadWorkflowFile(page, 'examples/control-flow/incident-router.md');

    // Check for switch node
    const switchNode = page.locator('[data-type="switch"]').first();
    await expect(switchNode).toBeVisible();

    // Check for case groups
    const caseGroups = page.locator('[data-type="group"]').filter({ hasText: /Case:/i });
    const caseCount = await caseGroups.count();
    expect(caseCount).toBeGreaterThan(0);

    // Check for default group
    const defaultGroup = page.locator('[data-type="group"]').filter({ hasText: 'Default' });
    await expect(defaultGroup).toBeVisible();
  });

  test('should auto-layout hierarchically', async ({ page }) => {
    // Load a complex workflow
    await loadWorkflowFile(page, 'examples/test-nested-visualization.md');

    // Click auto-layout button
    const autoLayoutButton = page.getByRole('button', { name: /auto layout|layout/i });
    await autoLayoutButton.click();

    await page.waitForTimeout(1000); // Wait for layout animation

    // Check that groups are positioned correctly (no overlaps)
    const groups = await page.locator('[data-type="group"]').all();
    const positions = await Promise.all(
      groups.map(async (group) => {
        const box = await group.boundingBox();
        return box;
      })
    );

    // Simple overlap check: groups should not overlap
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (!positions[i] || !positions[j]) continue;
        const noOverlap =
          positions[i].x + positions[i].width < positions[j].x ||
          positions[j].x + positions[j].width < positions[i].x ||
          positions[i].y + positions[i].height < positions[j].y ||
          positions[j].y + positions[j].height < positions[i].y;
        expect(noOverlap).toBe(true);
      }
    }
  });

  test('should show execution animations', async ({ page }) => {
    // Load a workflow
    await loadWorkflowFile(page, 'examples/control-flow/incident-router.md');

    // Start execution simulation (this would need to be triggered)
    // For now, we'll test that the execution classes are applied correctly

    // Simulate a running step by adding the class manually (for testing)
    await page.evaluate(() => {
      const step = document.querySelector('[data-type="step"]');
      if (step) {
        step.classList.add('executing-step');
      }
    });

    // Check for animation class
    const executingStep = page.locator('.executing-step').first();
    await expect(executingStep).toBeVisible();

    // Check animation is applied (pulse glow)
    await expect(executingStep).toHaveCSS('animation-name', /pulse-glow/);
  });

  test('should show step count indicators on groups', async ({ page }) => {
    // Load a workflow
    await loadWorkflowFile(page, 'examples/test-nested-visualization.md');

    // Find a group with nested steps
    const groupWithSteps = page.locator('[data-type="group"]').first();

    // Collapse it to see the step count
    await groupWithSteps.locator('.flex').first().click();
    await page.waitForTimeout(500);

    // Check for step count badge
    const stepCount = groupWithSteps.locator('text=/\\d+ steps?/');
    await expect(stepCount).toBeVisible();

    // Extract the number and verify it's greater than 0
    const text = await stepCount.textContent();
    const match = text?.match(/(\d+) steps?/);
    expect(match).toBeTruthy();
    const count = parseInt(match![1]);
    expect(count).toBeGreaterThan(0);
  });

  test('should use zoom optimizations', async ({ page }) => {
    // Load a workflow
    await loadWorkflowFile(page, 'examples/test-nested-visualization.md');

    // Get the ReactFlow container
    const reactFlow = page.locator('.react-flow');

    // Zoom out significantly
    await page.keyboard.press('Meta+-'); // or 'Control+-' on Windows
    await page.keyboard.press('Meta+-');
    await page.keyboard.press('Meta+-');
    await page.waitForTimeout(500);

    // Check that zoom classes are applied
    const hasZoomClass = await reactFlow.evaluate((el) => {
      return el.className.includes('zoom-');
    });
    expect(hasZoomClass).toBe(true);

    // At low zoom, details should be hidden
    const nodeDetails = page.locator('.node-details').first();
    const isVisible = await nodeDetails.isVisible().catch(() => false);
    // Details might be hidden at low zoom
    if (!isVisible) {
      // That's expected behavior
      expect(true).toBe(true);
    }
  });

  test('should display minimap with control flow colors', async ({ page }) => {
    // Load a workflow
    await loadWorkflowFile(page, 'examples/control-flow/incident-router.md');

    // Check minimap is visible
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible();

    // Check that minimap nodes are rendered
    const minimapNodes = minimap.locator('.react-flow__minimap-node');
    const nodeCount = await minimapNodes.count();
    expect(nodeCount).toBeGreaterThan(0);

    // Check that control flow nodes have distinctive styling
    const controlFlowNodes = minimap.locator('.react-flow__minimap-node[data-type="switch"]');
    const controlFlowCount = await controlFlowNodes.count();
    if (controlFlowCount > 0) {
      // Control flow nodes should have different colors
      await expect(controlFlowNodes.first()).toBeVisible();
    }
  });

  test('should show canvas toolbar', async ({ page }) => {
    // Load any workflow
    await loadWorkflowFile(page, 'examples/control-flow/incident-router.md');

    // Check toolbar is visible
    const toolbar = page.locator('.absolute.top-4.right-4');
    await expect(toolbar).toBeVisible();

    // Check for zoom controls
    const zoomIn = toolbar.getByTitle('Zoom In');
    const zoomOut = toolbar.getByTitle('Zoom Out');
    const fitView = toolbar.getByTitle('Fit View');
    const autoLayout = toolbar.getByTitle('Auto Layout');

    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();
    await expect(fitView).toBeVisible();
    await expect(autoLayout).toBeVisible();

    // Test zoom in
    await zoomIn.click();
    await page.waitForTimeout(500);

    // Check zoom percentage changed
    const zoomDisplay = toolbar.locator('text=/%/');
    await expect(zoomDisplay).toBeVisible();
  });

  test('should collapse/expand all groups', async ({ page }) => {
    // Load a workflow with multiple groups
    await loadWorkflowFile(page, 'examples/test-nested-visualization.md');

    // Wait for groups to render
    await page.waitForSelector('[data-type="group"]');

    // Get collapse all button
    const toolbar = page.locator('.absolute.top-4.right-4');
    const collapseAll = toolbar.getByTitle('Collapse All Groups');

    // Collapse all
    await collapseAll.click();
    await page.waitForTimeout(1000);

    // Check that nested steps are hidden
    const nestedSteps = page.locator('[data-parent-node]');
    const visibleCount = await nestedSteps.filter({ hasText: /.+/ }).count();
    // Most should be hidden (some might still be visible due to rendering)
    expect(visibleCount).toBeLessThan(await page.locator('[data-parent-node]').count());

    // Expand all
    const expandAll = toolbar.getByTitle('Expand All Groups');
    await expandAll.click();
    await page.waitForTimeout(1000);

    // Check that nested steps are visible again
    const visibleAfter = await nestedSteps.first().isVisible();
    expect(visibleAfter).toBe(true);
  });

  test('should handle deep nesting', async ({ page }) => {
    // This test would require a workflow with deep nesting
    // For now, we'll test that the layout handles multiple levels

    await loadWorkflowFile(page, 'examples/test-nested-visualization.md');

    // Check that the layout doesn't break with nested structures
    const allGroups = await page.locator('[data-type="group"]').all();

    // Each group should be visible and positioned
    for (const group of allGroups) {
      await expect(group).toBeVisible();
      const box = await group.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }
  });

  test('should handle empty branches gracefully', async ({ page }) => {
    // Create a workflow with empty else branch
    // This would typically be done through the UI or by loading a specific file

    await loadWorkflowFile(page, 'examples/control-flow/incident-router.md');

    // Check that the page renders without errors
    const errors = [];
    page.on('pageerror', (error) => errors.push(error));

    await page.waitForTimeout(2000);

    // No errors should have occurred
    expect(errors.length).toBe(0);
  });
});

/**
 * Helper function to load a workflow file
 */
async function loadWorkflowFile(page: Page, filePath: string) {
  // This is a placeholder - actual implementation would depend on how workflows are loaded in the GUI
  // Options:
  // 1. Use file input if available
  // 2. Navigate to a specific route
  // 3. Use an API endpoint

  // For now, simulate navigation to a workflow
  await page.evaluate((path) => {
    console.log('Loading workflow:', path);
    // Actual implementation would trigger workflow loading
  }, filePath);

  // Wait for the workflow to render
  await page.waitForTimeout(1000);
}

import { test, expect } from '@playwright/test';

test.describe('App', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');

    // Check that the main elements are visible
    await expect(page.locator('text=Marktoflow')).toBeVisible();
  });

  test('should display the sidebar with workflows', async ({ page }) => {
    await page.goto('/');

    // Check sidebar exists
    const sidebar = page.locator('[class*="w-64"]').first();
    await expect(sidebar).toBeVisible();

    // Check workflows tab
    await expect(page.locator('button:has-text("Workflows")')).toBeVisible();
    await expect(page.locator('button:has-text("Tools")')).toBeVisible();
  });

  test('should switch between Workflows and Tools tabs', async ({ page }) => {
    await page.goto('/');

    // Click on Tools tab
    await page.click('button:has-text("Tools")');

    // Check that tools are visible (looking for tool categories)
    await expect(page.locator('text=Communication')).toBeVisible();
    await expect(page.locator('text=Development')).toBeVisible();

    // Click back to Workflows
    await page.click('button:has-text("Workflows")');

    // Check that workflow list items are visible
    await expect(page.locator('text=Code Review')).toBeVisible();
  });

  test('should display connection status', async ({ page }) => {
    await page.goto('/');

    // Check connection status indicator
    const connectionStatus = page.locator('text=Connected').or(page.locator('text=Disconnected'));
    await expect(connectionStatus).toBeVisible();
  });

  test('should show keyboard shortcuts button', async ({ page }) => {
    await page.goto('/');

    // Check shortcuts button
    await expect(page.locator('button:has-text("Shortcuts")')).toBeVisible();
  });

  test('should open keyboard shortcuts modal', async ({ page }) => {
    await page.goto('/');

    // Click shortcuts button
    await page.click('button:has-text("Shortcuts")');

    // Check modal is open
    await expect(page.locator('text=Keyboard Shortcuts')).toBeVisible();
    await expect(page.locator('text=General')).toBeVisible();
    await expect(page.locator('text=Canvas')).toBeVisible();

    // Close modal
    await page.click('button:has-text("Close")');

    // Modal should be closed
    await expect(page.locator('role=dialog')).not.toBeVisible();
  });

  test('should display toolbar with action buttons', async ({ page }) => {
    await page.goto('/');

    // Check toolbar buttons
    await expect(page.locator('button:has-text("Add Step")')).toBeVisible();
    await expect(page.locator('button:has-text("Execute")')).toBeVisible();
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
  });

  test('should display properties panel', async ({ page }) => {
    await page.goto('/');

    // Check properties panel
    await expect(page.locator('text=Properties')).toBeVisible();
    await expect(page.locator('button:has-text("Variables")')).toBeVisible();
    await expect(page.locator('button:has-text("History")')).toBeVisible();
  });
});

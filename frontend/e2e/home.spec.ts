import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/AgentSims/);
});

test('home page has content', async ({ page }) => {
  await page.goto('/');
  // Verify the app renders without crashing
  await expect(page.locator('#root')).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect the breadcrumb to contain "Chat Name"
  expect(await page.locator('.line-clamp-1').innerText()).toContain('Chat Name');
});

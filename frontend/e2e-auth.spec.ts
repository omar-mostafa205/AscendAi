import { test, expect } from '@playwright/test';

test('unauth root redirects to login', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  expect(page.url()).toContain('/login');
});

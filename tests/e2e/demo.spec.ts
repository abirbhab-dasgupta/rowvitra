import { expect, test } from '@playwright/test';

test('demo workspace exposes health, repair, editor, visual lab, export', async ({ page }) => {
  test.skip(process.env.ENABLE_PUBLIC_DEMO !== 'true', 'Enable demo and start Python processor for full test');
  await page.goto('/demo');
  await expect(page.getByText(/messy-sales.csv/i).first()).toBeVisible();
  for (const name of ['Data health', 'AI Repair', 'Data editor', 'Visual Lab', 'Exports']) {
    await expect(page.getByRole('button', { name, exact: true }).first()).toBeVisible();
  }
});

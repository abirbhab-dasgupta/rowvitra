import { expect, test } from '@playwright/test';

test('landing page preserves the visual identity and navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Rowvitra/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your data');
  await expect(page.getByRole('link', { name: /Start Exploring/ }).first()).toHaveAttribute('href', '/sign-up');
  await expect(page.locator('img[src*="hero-art"]')).toBeVisible();
});

test('email authentication forms are accessible', async ({ page }) => {
  await page.goto('/sign-up');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /Create account/ })).toBeVisible();
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: /Continue with Google/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Forgot password/ })).toHaveCount(0);
  await expect(page.getByText(/Verify your email/i)).toHaveCount(0);
});

test('anonymous visitors are redirected away from private dashboard', async ({ page }) => {
  test.skip(!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET, 'Requires configured Better Auth and database');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/sign-in/);
});


test('responsive landing has no horizontal overflow and accessible mobile navigation', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.getByRole('button', {name:'Open navigation'}).click();
  await expect(page.getByRole('navigation', {name:'Mobile navigation'}).getByRole('link', {name:'Pricing'})).toBeVisible();
  await page.getByRole('button', {name:'Close navigation'}).click();
});

test('reduced motion disables decorative landing animations', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const animation = await page.locator('.land-art').evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});

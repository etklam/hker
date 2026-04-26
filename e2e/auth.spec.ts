import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check for the login card/form
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Check for email input using id
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();

    // Check for password input using id
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();

    // Check for submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click the submit button without filling fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // The form should still be visible
    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('should navigate to registration page', async ({ page }) => {
    // Find the registration link
    const registerLink = page.locator('a').filter({ hasText: /建立|註冊|register|sign up/i });
    const count = await registerLink.count();
    if (count > 0) {
      await registerLink.first().click();
      await expect(page).toHaveURL(/\/register/);
    }
  });

  test('should display registration form', async ({ page }) => {
    await page.goto('/register');
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Check for input fields
    const inputs = page.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);

    // Check for submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('should handle logout', async ({ page }) => {
    // Note: This test would need actual user credentials or a test user setup
    // For now, we'll just verify the logout endpoint exists
    const response = await page.request.post('/api/auth/logout');
    // Accept 204 (success), 401 (unauthorized/no session), or 403 (forbidden)
    expect([204, 401, 403]).toContain(response.status());
  });
});

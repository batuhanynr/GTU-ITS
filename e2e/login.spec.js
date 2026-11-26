import { expect, test } from '@playwright/test';

test('a rejected sign-in can be retried and a temporary password must be changed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'E-posta' }).fill(process.env.BOOTSTRAP_ADMIN_EMAIL);
    const password = page.getByLabel('Şifre', { exact: true });
    const submit = page.getByRole('button', { name: 'Giriş', exact: true });

    await password.fill('incorrect-password');
    await submit.click();
    await expect(page.getByText('Geçersiz e-posta veya şifre.', { exact: true })).toBeVisible();
    await expect(submit).toBeEnabled();

    await password.fill(process.env.BOOTSTRAP_ADMIN_PASSWORD);
    await submit.click();
    await expect(page.getByRole('heading', { name: 'Şifre Değiştirme' })).toBeVisible();
});

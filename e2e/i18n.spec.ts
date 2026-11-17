import { expect, test } from '@playwright/test';
import { ids, mockBackend } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test('Arabic covers every route and analytics report, then switches to English', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('ai_vision_lang', 'ar'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const paths = [
    '/',
    '/sites',
    '/cameras',
    `/cameras/${ids.camera}/zones`,
    '/live',
    `/live/${ids.camera}`,
    '/analytics',
    '/sessions',
    `/sessions/${ids.session}`,
    '/missing-page',
  ];
  async function checkArabic() {
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.loading-state')).toHaveCount(0);
    const untranslated = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const values: string[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent || !parent.checkVisibility() || parent.closest('code, script, style')) continue;
        values.push(node.textContent?.trim() ?? '');
      }
      for (const element of document.querySelectorAll('[aria-label], [title], [placeholder]')) {
        if (!element.checkVisibility() || element.closest('.lang-switch-btn')) continue;
        for (const attribute of ['aria-label', 'title', 'placeholder']) {
          values.push(element.getAttribute(attribute) ?? '');
        }
      }
      const result: string[] = [];
      for (const value of values) {
        const remaining = value
          .replace(
            /Main Mall \(test fixture\)|Main entrance|Entrance zone|mall-entrance-test\.mp4|video-test-01|cameras\/cam1\/analytics|fixture|test-video|session-test|cam-?1/gi,
            '',
          )
          .replace(
            /NILETRONIX|AI Vision|MQTT|REST|UTC|CORS|API|Africa\/Cairo|EN|Europe\/London/g,
            '',
          )
          .replace(/[a-f\d]{8}-[a-f\d-]{27,}/gi, '');
        if (/[a-zA-Z]{2}/.test(remaining)) result.push(value);
      }
      return [...new Set(result)];
    });
    expect(untranslated).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator('main h1, main .state-view h2').first()).toBeVisible();
    await checkArabic();
    await expect(page).toHaveTitle(/[\u0600-\u06ff]/);
    if (path === '/') {
      await page.screenshot({
        path: `artifacts/arabic-${testInfo.project.name}.png`,
        fullPage: true,
      });
    }
    if (['/sites', '/cameras', `/cameras/${ids.camera}/zones`].includes(path)) {
      await page
        .getByRole('button', { name: /^إضافة/ })
        .first()
        .click();
      await checkArabic();
      await page.getByRole('button', { name: 'إغلاق النافذة', exact: true }).click();
    }
    if (path === '/analytics') {
      for (const tab of ['الإشغال', 'حركة المرور', 'مدة المكوث', 'عكس السير', 'الموظفون']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await checkArabic();
      }
    }
  }
  await page.locator('.lang-switch-btn').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page).toHaveTitle('Page not found · AI Vision');
  expect(errors).toEqual([]);
});

test('Arabic registry forms validate and retain translated success and confirmation messages', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('ai_vision_lang', 'ar'));
  await page.goto('/sites');
  await page.getByRole('button', { name: 'إضافة موقع', exact: true }).first().click();
  await page.getByRole('button', { name: 'حفظ موقع', exact: true }).click();
  await expect(page.getByText('كود الموقع مطلوب.')).toBeVisible();
  await page.getByLabel('الاسم *', { exact: true }).fill('موقع التجربة');
  await page.getByLabel('كود الموقع *').fill('AR');
  await page.getByRole('button', { name: 'حفظ موقع', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'تم إنشاء الموقع بنجاح.' }),
  ).toBeVisible();
  await page
    .getByRole('row', { name: /موقع التجربة/ })
    .getByRole('button', { name: /إلغاء/ })
    .click();
  await page.getByRole('button', { name: 'تأكيد', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'تم إلغاء تفعيل موقع التجربة.' }),
  ).toBeVisible();
});

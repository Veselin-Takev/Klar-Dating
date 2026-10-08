import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('WCAG 2.2 AA release gate', () => {
  test('public entry has no detectable WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    expect(
      results.violations,
      results.violations.map(violation => {
        const targets = violation.nodes.flatMap(node => node.target).join(', ');
        return `${violation.id}: ${violation.help} [${targets}]`;
      }).join('\n'),
    ).toEqual([]);
  });

  test('public entry reflows at 320 CSS pixels without horizontal page scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });

  test('interactive controls expose a visible keyboard focus indicator', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Willkommen bei Klar' })).toBeVisible();

    await page.keyboard.press('Tab');
    const control = page.locator(':focus');
    await expect(control).toBeVisible();

    const outline = await control.evaluate(element => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });

    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});

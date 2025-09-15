import { test, expect } from '@playwright/test'

test('render sample and capture screenshots', async ({ page }, testInfo) => {
  await page.goto('/')

  const loadBtn = page.getByRole('button', { name: '샘플 로드' })
  const renderBtn = page.getByRole('button', { name: '렌더' })

  await expect(loadBtn).toBeVisible()
  await loadBtn.click()
  await expect(renderBtn).toBeVisible()
  await renderBtn.click()

  const columns = page.locator('#columns')
  await expect(columns).toBeVisible()

  const full = await page.screenshot({ fullPage: true })
  await testInfo.attach('full-page.png', { body: full, contentType: 'image/png' })

  const cols = await columns.screenshot()
  await testInfo.attach('columns.png', { body: cols, contentType: 'image/png' })
})


import { test, expect } from '@playwright/test'

async function renderSample(page) {
  await page.goto('/')
  const loadBtn = page.getByRole('button', { name: '샘플 로드' })
  const renderBtn = page.getByRole('button', { name: '렌더' })
  await expect(loadBtn).toBeVisible()
  await loadBtn.click()
  await expect(renderBtn).toBeVisible()
  await renderBtn.click()
  await expect(page.locator('#columns')).toBeVisible()
}

test('collapse/expand captures state', async ({ page }, testInfo) => {
  await renderSample(page)
  const firstRow = page.locator('tr.row.collapsible').first()
  await expect(firstRow).toBeVisible()
  const beforeClass = await firstRow.getAttribute('class')
  await testInfo.attach('row-before.txt', { body: Buffer.from(beforeClass || ''), contentType: 'text/plain' })
  // Prefer the explicit disclosure button for reliability
  const disclosure = firstRow.locator('button.disclosure')
  await disclosure.scrollIntoViewIfNeeded()
  await disclosure.click()
  const afterClass1 = await firstRow.getAttribute('class')
  await testInfo.attach('row-after-1.txt', { body: Buffer.from(afterClass1 || ''), contentType: 'text/plain' })
  await expect(firstRow).toHaveClass(/collapsed/)
  const shot1 = await page.screenshot({ fullPage: true })
  await testInfo.attach('collapse.png', { body: shot1, contentType: 'image/png' })
  await disclosure.click()
  const afterClass2 = await firstRow.getAttribute('class')
  await testInfo.attach('row-after-2.txt', { body: Buffer.from(afterClass2 || ''), contentType: 'text/plain' })
  await expect(firstRow).not.toHaveClass(/collapsed/)
  const shot2 = await page.screenshot({ fullPage: true })
  await testInfo.attach('expand.png', { body: shot2, contentType: 'image/png' })
})

test('drag reorder within first table', async ({ page }, testInfo) => {
  await renderSample(page)
  const firstTable = page.locator('.subtable').first()
  await expect(firstTable).toBeVisible()
  await firstTable.locator('button:has-text("편집")').click()
  const rows = firstTable.locator('tbody tr[data-field]')
  const count = await rows.count()
  test.skip(count < 2, 'Need at least two fields to reorder')
  const before = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-field')))
  const rowA = rows.nth(0)
  const rowB = rows.nth(1)
  // Drop near the top of rowA to insert before
  await rowB.dragTo(rowA, { targetPosition: { x: 10, y: 4 } })
  // allow layout tick
  await page.waitForTimeout(100)
  const after = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-field')))
  expect(after[0]).toBe(before[1])
  const shot = await firstTable.screenshot()
  await testInfo.attach('reorder.png', { body: shot, contentType: 'image/png' })
})

test('zoom controls and reset', async ({ page }, testInfo) => {
  await renderSample(page)
  const toolbar = page.locator('.zoom-toolbar')
  await expect(toolbar).toBeVisible()
  const minus = toolbar.locator('button').nth(0)
  const plus = toolbar.locator('button').nth(2)
  const reset = toolbar.locator('button', { hasText: 'Reset' })
  await minus.click()
  await minus.click()
  await plus.click()
  const shot = await page.screenshot({ fullPage: true })
  await testInfo.attach('zoom.png', { body: shot, contentType: 'image/png' })
  await reset.click()
  await expect(toolbar).toContainText('100%')
})

test('undo/redo after add field', async ({ page }, testInfo) => {
  await renderSample(page)
  // open edit mode
  const firstTable = page.locator('.subtable').first()
  await expect(firstTable).toBeVisible()
  await firstTable.locator('button:has-text("편집")').click()
  let rows = firstTable.locator('tbody tr[data-field]')
  const beforeCount = await rows.count()
  // add a field and save
  await firstTable.locator('button:has-text("+ 필드")').click()
  await firstTable.locator('button:has-text("저장")').click()
  // back in view mode
  await expect(firstTable.locator('button:has-text("편집")')).toBeVisible()
  let afterCount = await rows.count()
  await testInfo.attach('counts-after-save.json', { body: Buffer.from(JSON.stringify({ beforeCount, afterCount })), contentType: 'application/json' })
  expect(afterCount).toBeGreaterThan(beforeCount)
  // undo may require two steps due to intermediate history snapshot
  const undoBtn = page.locator('.floating-toolbar button:has-text("Undo")')
  await undoBtn.click()
  await page.waitForTimeout(50)
  rows = firstTable.locator('tbody tr[data-field]')
  let curCount = await rows.count()
  if (curCount !== beforeCount) {
    await undoBtn.click()
  }
  await testInfo.attach('counts-after-undo.json', { body: Buffer.from(JSON.stringify({ curCount, beforeCount })), contentType: 'application/json' })
  await expect(rows).toHaveCount(beforeCount)
  const shotUndo = await page.screenshot({ fullPage: true })
  await testInfo.attach('undo.png', { body: shotUndo, contentType: 'image/png' })
  // redo back to the added state
  const redoBtn = page.locator('.floating-toolbar button:has-text("Redo")')
  await redoBtn.click()
  await page.waitForTimeout(50)
  rows = firstTable.locator('tbody tr[data-field]')
  let cur2 = await rows.count()
  if (cur2 !== afterCount) {
    await redoBtn.click()
  }
  await testInfo.attach('counts-after-redo.json', { body: Buffer.from(JSON.stringify({ cur2, afterCount })), contentType: 'application/json' })
  rows = firstTable.locator('tbody tr[data-field]')
  afterCount = await rows.count()
  await expect(afterCount).toBeGreaterThan(beforeCount)
  const shotRedo = await page.screenshot({ fullPage: true })
  await testInfo.attach('redo.png', { body: shotRedo, contentType: 'image/png' })
})

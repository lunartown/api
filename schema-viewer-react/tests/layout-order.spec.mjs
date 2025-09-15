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

const row = (page, parentType, field) => page.locator(`tbody tr.row.collapsible[data-parent="${parentType}"][data-field="${field}"]`)
const disclosureBtn = (r) => r.locator('button.disclosure')

test('instance layout: sibling stacked below deepest nephew', async ({ page }, testInfo) => {
  await renderSample(page)
  // Expand profile and its child contact
  const userProfile = row(page, 'User', 'profile')
  await expect(userProfile).toBeVisible()
  await disclosureBtn(userProfile).click()
  // Wait for Profile instance table to appear
  await expect(page.locator('.subtable[data-instance="User.profile"]')).toBeVisible()
  const profileContact = row(page, 'Profile', 'contact')
  await expect(profileContact).toBeVisible()
  await disclosureBtn(profileContact).click()

  // Expand settings as sibling of profile
  const userSettings = row(page, 'User', 'settings')
  await expect(userSettings).toBeVisible()
  await disclosureBtn(userSettings).click()
  await expect(page.locator('.subtable[data-instance="User.settings"]')).toBeVisible()

  // Wait until layout stabilizes and verify stacking
  await page.waitForFunction(() => window.getComputedStyle(document.body).opacity !== '0')
  const getPos = async () => await page.evaluate(() => {
    const q=id=>Array.from(document.querySelectorAll('.subtable')).find(e=>e.getAttribute('data-instance')===id)
    const top=el=>el?.getBoundingClientRect().top
    const bottom=el=>el?.getBoundingClientRect().bottom
    const ac=q('User.profile.contact')
    const b=q('User.settings')
    return { contactBottom: bottom(ac) ?? null, settingsTop: top(b) ?? null }
  })
  // allow a couple of frames for our layout stabilizer to push
  let ok = false
  for (let i = 0; i < 8; i++) {
    const { contactBottom, settingsTop } = await getPos()
    if (contactBottom != null && settingsTop != null && settingsTop > contactBottom + 1) { ok = true; break }
    await page.waitForTimeout(50)
  }
  const finalPos = await getPos()
  await testInfo.attach('layout-pos.json', { body: Buffer.from(JSON.stringify(finalPos, null, 2)), contentType: 'application/json' })
  expect(ok, `settingsTop(${finalPos.settingsTop}) should be > contactBottom(${finalPos.contactBottom})`).toBeTruthy()
})

test('collapsing parent hides all descendant instances', async ({ page }) => {
  await renderSample(page)
  // Expand profile -> contact
  const userProfile = row(page, 'User', 'profile')
  await disclosureBtn(userProfile).click()
  await expect(page.locator('.subtable[data-instance="User.profile"]')).toBeVisible()
  const profileContact = row(page, 'Profile', 'contact')
  await disclosureBtn(profileContact).click()
  await expect(page.locator('.subtable[data-instance="User.profile.contact"]')).toBeVisible()

  // Collapse profile at root
  await disclosureBtn(userProfile).click()
  // Descendants should disappear
  await expect(page.locator('.subtable[data-instance^="User.profile"]')).toHaveCount(0)
})


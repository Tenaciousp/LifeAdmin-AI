// Optional browser QA: start Vite with VITE_LIFEADMIN_LOCAL=true, then run with
// Playwright available in the Node environment. Screenshots are QA evidence.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.env.HOMEADMIN_QA_URL || "http://127.0.0.1:5174");
    await page.getByRole("heading", { name: "A clearer picture. A better next step." }).waitFor();
    await page.getByRole("heading", { name: "No bills yet" }).waitFor();
    await page.getByRole("heading", { name: "No saved plans" }).waitFor();
    await page.getByRole("heading", { name: "No forecast yet" }).waitFor();
    await page.getByRole("heading", { name: "No dates to review" }).waitFor();
    await page.getByRole("button", { name: "Save bill", exact: true }).click();
    await page.getByText("Choose a bill category.", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Bill category").getAttribute("aria-invalid"), "true");
    assert.equal(await page.getByText("Choose a specific bill.", { exact: true }).count(), 0);
    await page.screenshot({ path: "/tmp/homeadmin-overview-ipad.png", fullPage: false });
    await page.getByLabel("Bill category").selectOption("water_services");
    await page.getByRole("button", { name: "Save bill", exact: true }).click();
    await page.getByText("Choose a specific bill.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Water", exact: true }).click();
    await page.getByRole("button", { name: "Save bill", exact: true }).click();
    await page.getByText("Choose what you need help with.", { exact: true }).waitFor();
    await page.getByLabel("What would you like help with?").selectOption("water_usage");
    await page.getByLabel("Bill name", { exact: true }).fill("Water at home");
    await page.getByLabel("Country / region of this bill").selectOption("Canada");
    await page.getByLabel("Bill currency").selectOption("CAD");
    await page.getByRole("textbox", { name: "Bill amount (useful)", exact: true }).fill("45.00");
    await page.getByLabel("Payment frequency").selectOption("Monthly");
    await page.getByLabel("State, province or municipality").fill("Ontario");
    await page.getByLabel("How is your water bill calculated?").selectOption("Metered");
    await page.getByLabel("Next payment date").fill("2026-11-01");
    await page.screenshot({ path: "/tmp/homeadmin-water-ipad.png", fullPage: false });
    await page.getByRole("button", { name: "Save bill", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Bill saved on this device." }).waitFor();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page.getByText("CAD", { exact: false }).first().waitFor();
    assert.match(await page.locator("#overview").innerText(), /45\.00/);
    await page.reload();
    await page.getByRole("heading", { name: "A clearer picture. A better next step." }).waitFor();
    assert.match(await page.locator("#overview").innerText(), /45\.00/);
    assert.equal(await page.locator('#bill-form').isVisible(), false, 'Returning users should not have to pass an expanded entry form.');
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const collapsedViolations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(n => n.target) })));
    assert.deepEqual(collapsedViolations, [], 'Returning-user home accessibility');
    await page.getByRole('button', { name: 'Add a bill', exact: true }).click();
    assert.equal(await page.locator('#bill-entry-heading').evaluate(node => node === document.activeElement), true);
    await page.getByLabel('Bill name', { exact: true }).fill('Unsaved household example');
    await page.getByLabel('Additional notes', { exact: false }).fill('Keep these notes while looking at saved work.');
    await page.getByRole('button', { name: 'Hide bill details', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Continue unsaved bill', exact: true }).getAttribute('aria-expanded'), 'false');
    await page.getByRole('link', { name: 'Bills', exact: true }).click();
    await page.getByRole('button', { name: 'Continue unsaved bill', exact: true }).click();
    assert.equal(await page.getByLabel('Bill name', { exact: true }).inputValue(), 'Unsaved household example');
    assert.match(await page.getByLabel('Additional notes', { exact: false }).inputValue(), /Keep these notes/);
    page.once('dialog', async dialog => { assert.match(dialog.message(), /Replace unsaved bill details/); await dialog.dismiss(); });
    await page.getByRole('button', { name: 'Water', exact: true }).click();
    assert.equal(await page.getByLabel('Bill name', { exact: true }).inputValue(), 'Unsaved household example');
    page.once('dialog', async dialog => { assert.match(dialog.message(), /Replace unsaved bill details/); await dialog.accept(); });
    await page.getByRole('button', { name: 'Clear unsaved entry', exact: true }).click();
    assert.equal(await page.getByLabel('Bill name', { exact: true }).inputValue(), '');
    assert.equal(await page.locator('#saved-bills li').count(), 1);
    await page.getByRole('button', { name: 'Hide bill details', exact: true }).click();
    await page.getByRole("button", { name: "Active bills: 1. View bills", exact: true }).click();
    await page.getByLabel("Search saved bills").fill("no matching bill");
    assert.equal(await page.getByRole("button", { name: "Edit", exact: true }).count(), 0);
    await page.getByLabel("Search saved bills").fill("");
    const manageBill = page.locator("#saved-bills details").filter({ hasText: "Manage bill" });
    assert.equal(await manageBill.evaluate(node => node.open), false, "Secondary bill actions start collapsed.");
    await manageBill.locator('summary').click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Hide bill details', exact: true }).click();
    await page.getByRole('button', { name: 'Add a bill', exact: true }).click();
    assert.equal(await page.getByLabel('Bill name', { exact: true }).inputValue(), '', 'Add must start a new bill after hiding an unchanged existing bill.');
    await page.getByRole('heading', { name: 'Add a bill', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Hide bill details', exact: true }).click();
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      if (!await manageBill.evaluate(node => node.open)) await manageBill.locator("summary").click();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      assert.equal(await page.getByLabel("Country / region of this bill").inputValue(), "Canada");
      assert.equal(await page.getByLabel("Bill currency").inputValue(), "CAD");
      for (const fontSize of [16, 32]) {
        await page.evaluate(value => { document.documentElement.style.fontSize = value + 'px'; }, fontSize);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Entry overflow at ' + width + '/' + fontSize);
        const entryViolations = await page.locator('#bill-entry').evaluate(async node => (await axe.run(node, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(n => n.target) })));
        assert.deepEqual(entryViolations, [], 'Entry accessibility at ' + width + '/' + fontSize);
        await page.locator('#bill-entry').screenshot({ path: '/tmp/homeadmin-entry-' + width + '-' + fontSize + '.png' });
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = '16px'; });
      await page.screenshot({ path: "/tmp/homeadmin-water-" + width + ".png", fullPage: false });
      await page.getByRole("button", { name: "Cancel edit", exact: true }).click();
    }
    assert.deepEqual(errors, []);
    console.log("PASS: water entry, international currency, forecast, reload persistence and 320/390/768/1024px entry layouts at 100%/200% text, disclosure and unsaved-entry recovery; no browser errors.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

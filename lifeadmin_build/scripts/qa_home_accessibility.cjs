// Optional QA dependencies: playwright@1.56.1 and axe-core, outside the app bundle.
// Serve the bundled local build and set HOMEADMIN_QA_URL if using another port.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const results = [];
    for (const width of [390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(process.env.HOMEADMIN_QA_URL || 'http://127.0.0.1:5174');
      await page.getByRole('button', { name: 'Save bill', exact: true }).waitFor();
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      for (const expanded of [false, true]) {
        if (expanded) await page.getByText('Calendar privacy and how updates work', { exact: true }).click();
        const report = await page.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
        const violations = report.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) }));
        assert.deepEqual(violations, [], JSON.stringify({ width, expanded, violations }));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        results.push({ width, expanded, height: await page.evaluate(() => document.documentElement.scrollHeight), violations });
      }
    }
    console.log(JSON.stringify({ scope: 'Empty home with collapsed/expanded calendar explanation; automated checks only', results }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

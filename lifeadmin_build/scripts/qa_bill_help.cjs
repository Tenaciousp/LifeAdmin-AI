// Synthetic-only guided journey. No AI service is contacted and no real AI
// output is claimed by this test; returned text is an explicitly entered fixture.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
    const base = process.env.HOMEADMIN_QA_URL || "http://127.0.0.1:5174";
    const external = [], errors = [];
    await page.route("**/*", route => {
      if (new URL(route.request().url()).origin !== new URL(base).origin) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole("button", { name: "Water", exact: true }).click();
    await page.getByLabel("What would you like help with?").selectOption("check_bill");
    await page.getByLabel("Bill name", { exact: true }).fill("Synthetic water case");
    await page.getByLabel("Water company (useful)", { exact: true }).fill("Example Water");
    await page.getByLabel("Country / region of this bill").selectOption("Canada");
    await page.getByLabel("Bill currency").selectOption("CAD");
    await page.locator("summary").filter({ hasText: "More bill details (optional)" }).click();
    await page.getByLabel("Customer reference (optional)", { exact: true }).fill("TEST-REF-SECRET");
    await page.getByRole("button", { name: "Save bill", exact: true }).click();
    await page.getByRole("heading", { name: "Help with Synthetic water case", exact: true }).waitFor();
    await page.getByRole("radio", { name: /^Reply to my provider/ }).check();
    const chosenAi = page.getByRole("radio", { name: /^Use my chosen AI service/ });
    await chosenAi.check();
    assert.equal(await chosenAi.isChecked(), true, "The AI-assisted route must be selected before preparing a request.");
    await page.getByRole("button", { name: "Continue to details", exact: true }).click();
    console.log("Guided bill-help selectors after continuing", JSON.stringify(await page.locator("label").evaluateAll(labels => labels.map(label => label.textContent?.trim()).filter(Boolean))));
    await page.getByLabel("What outcome do you want?").fill("Explain the estimated meter reading and remaining balance.");
    await page.getByLabel("Provider message to respond to").fill("We used an estimated reading. Please send the actual reading and date.");
    await page.locator("label").filter({ hasText: /^Response language/ }).locator("select").selectOption("French");
    await page.getByRole("button", { name: "Review AI request", exact: true }).click();
    await page.getByRole("heading", { name: "Review, copy and open your AI", exact: true }).waitFor({ timeout: 5000 }).catch(async () => {
      const alert = await page.getByRole("alert").textContent().catch(() => "no validation message");
      throw new Error("AI request review did not open: " + alert);
    });
    const requestField = page.locator("label").filter({ hasText: /^Prepared AI request/ }).locator("textarea");
    const request = await requestField.inputValue();
    assert.match(request, /actual reading and date/); assert.match(request, /French/);
    assert.match(request, /Water and sewerage/); assert.doesNotMatch(request, /TEST-REF-SECRET/);
    const open = page.getByRole("link", { name: "Open ChatGPT", exact: true });
    assert.equal(await open.getAttribute("href"), "https://chatgpt.com/");
    await page.getByRole("button", { name: "Save progress for later", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Progress saved on this device." }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Resume bill help", exact: true }).click();
    assert.equal(await page.locator("label").filter({ hasText: /^Prepared AI request/ }).locator("textarea").inputValue(), request);
    await page.getByRole("button", { name: "I have an answer to review", exact: true }).click();
    await page.getByLabel("Result subject", { exact: true }).fill("Synthetic reading query");
    await page.getByLabel("Message text", { exact: true }).fill("Synthetic reviewed reply. Please confirm the revised calculation.");
    assert.equal(await page.getByRole("button", { name: "Save reviewed result", exact: true }).isDisabled(), true);
    for (const width of [390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
      await page.getByRole("heading", { name: "Paste and review your AI answer", exact: true }).scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "Guided review overflow at " + width);
      await page.screenshot({ path: "/tmp/homeadmin-help-" + width + ".png" });
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = "16px"; });
    await page.getByRole("checkbox", { name: /^I have checked the facts/ }).check();
    await page.getByRole("button", { name: "Save reviewed result", exact: true }).click();
    await page.getByRole("heading", { name: "Synthetic water case · Reply", exact: true }).waitFor();
    await page.getByText("AI-service answer supplied and reviewed by you.", { exact: false }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Open plan", exact: true }).click();
    await page.getByText("Synthetic reviewed reply. Please confirm the revised calculation.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Plan, letter or reply", exact: true }).click();
    await page.getByRole("radio", { name: /^Make a plan/ }).check();
    await page.getByRole("radio", { name: /^Start from an offline draft/ }).check();
    await page.getByRole("button", { name: "Continue to details", exact: true }).click();
    await page.getByRole("button", { name: "Prepare offline draft", exact: true }).click();
    assert.ok((await page.getByLabel("Plan text", { exact: true }).inputValue()).length > 100);
    await page.getByRole("checkbox", { name: /^I have checked the facts/ }).check();
    await page.getByRole("button", { name: "Save reviewed result", exact: true }).click();
    await page.getByRole("heading", { name: "Saved plans (2)", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Open plan", exact: true }).count(), 2);
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    console.log("PASS: chosen-AI reply request, private reference exclusion, saved progress reload, review gate, separate persisted results, offline plan, 200% text at phone/tablet widths, no external requests.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

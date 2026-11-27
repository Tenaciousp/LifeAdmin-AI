if (process.argv.includes('--local-state')) {
  import('./qa_broadband_states.mjs').then(m => m.runBroadbandStates()).catch(e => { console.error(e); process.exitCode = 1; });
} else {
// Synthetic-only guided bill journey. No AI provider or live price service is contacted.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true, ...(process.env.HOMEADMIN_CHROMIUM_PATH ? { executablePath: process.env.HOMEADMIN_CHROMIUM_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
    const base = process.env.HOMEADMIN_QA_URL || "http://127.0.0.1:5174";
    const external = [], errors = [];
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
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
    await page.getByLabel("Bill amount", { exact: true }).fill("45.00");
    await page.locator("summary").filter({ hasText: "More bill details (optional)" }).click();
    await page.getByLabel("Customer reference (optional)", { exact: true }).fill("TEST-REF-SECRET");
    await page.getByRole("button", { name: "Save bill and continue to AI help", exact: true }).click();
    await page.getByRole("heading", { name: "Help with Synthetic water case", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Check your bill details", exact: true }).waitFor();
    assert.equal(await page.getByText("Step 1 of 3", { exact: true }).count(), 1);
    assert.match(await page.getByLabel("Your request to the AI").inputValue(), /Compare suitable alternatives/,
      "The saved bill should open with the main savings action ready.");
    const aiChoice = page.getByLabel("AI service to use", { exact: true });
    assert.equal(await aiChoice.getAttribute("aria-describedby"), "preferred-ai-guidance",
      "Subscription guidance should be announced as a description, separate from the AI control name.");
    assert.equal(await aiChoice.inputValue(), "copilot",
      "Copilot is the first-use default.");
    assert.equal(await page.getByText("Choose an AI service you already use or subscribe to. HomeAdmin starts with Copilot and adds no AI subscription or API charge. Your selected service is saved only on this device; HomeAdmin does not check or store your account or payment details. Your AI provider's own plan and limits still apply.", { exact: true }).count(), 1,
      "The AI choice must explain existing subscriptions, HomeAdmin cost and local-only preference storage.");

    // Bill corrections preserve the current AI request and resume at the same stage.
    await page.getByRole("button", { name: "Edit bill details and return here", exact: true }).click();
    assert.equal(await page.getByLabel("Bill name", { exact: true }).inputValue(), "Synthetic water case");
    await page.getByLabel("Bill amount", { exact: true }).fill("46.00");
    await page.getByRole("button", { name: "Save and return to AI help", exact: true }).click();
    await page.getByRole("heading", { name: "Check your bill details", exact: true }).waitFor();
    assert.equal(await page.getByText("Step 1 of 3", { exact: true }).count(), 1,
      "Bill editing must return to the current workflow stage.");
    assert.match(await page.getByRole("group", { name: "Check the details to include" }).innerText(), /46\.00/);

    // The primary route moves directly from reviewed bill facts to a prepared request and chosen AI link.
    await aiChoice.selectOption("gemini");
    await page.getByRole("button", { name: "Prepare comparison question", exact: true }).click();
    await page.getByRole("heading", { name: "Your AI question is ready", exact: true }).waitFor();
    assert.equal(await page.getByText("Step 2 of 3", { exact: true }).count(), 1);
    assert.equal(await page.getByText("Your question asks Gemini (Google, free option) to look for current offers and dated sources if that AI supports web search. HomeAdmin cannot verify an answer returned from another AI: open cited provider pages and confirm prices, terms and eligibility. Check the facts below, copy the question, open Gemini (Google, free option), then return with the answer. Nothing is sent until you paste and send it.", { exact: true }).count(), 1,
      "External AI research must be described as conditional, with explicit source verification.");
    const requestField = page.getByLabel("Prepared AI request", { exact: true });
    const request = await requestField.inputValue();
    assert.match(request, /Compare suitable alternatives/);
    assert.match(request, /official source links and the exact date/i);
    assert.match(request, /payment options instead of alternative suppliers/i);
    assert.doesNotMatch(request, /TEST-REF-SECRET/);
    const openAi = page.getByRole("link", { name: "2. Open Gemini (Google, free option)", exact: true });
    assert.equal(await openAi.getAttribute("href"), "https://gemini.google.com/");
    await page.getByRole("button", { name: "1. Copy question", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Question copied and progress saved." }).waitFor();
    await page.getByRole("button", { name: "Save progress for later", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Progress saved on this device." }).waitFor();
    await page.reload();
    const savedHelp = page.getByRole("region", { name: "Continue your bill help", exact: true });
    await savedHelp.getByText("Plan · Saved at step 2 of 3: Get AI answer", { exact: true }).waitFor();
    assert.doesNotMatch(await savedHelp.innerText(), /TEST-REF-SECRET|46\.00/);
    await savedHelp.getByRole("button", { name: "Continue saved help for Synthetic water case", exact: true }).click();
    assert.equal(await page.getByLabel("Prepared AI request", { exact: true }).inputValue(), request,
      "Reopening saved help must keep the prepared prompt.");

    await page.getByRole("button", { name: "3. I have an answer to review", exact: true }).click();
    await page.getByRole("heading", { name: "Paste and review your AI answer", exact: true }).waitFor();
    await page.getByLabel("Plan text", { exact: true }).fill("## My bill at a glance\nCAD 46 monthly for Example Water.\n## Best next action\nAsk the existing water company to check the reading.\n## Alternatives to consider\nNo household supplier switch. Check metering and payment support.\n## Estimated savings\nNot available: no verified like-for-like prices.\n## Editable provider email\nSubject: Please check my water bill\nMessage: Please explain the current bill.");
    const factCheck = page.getByRole("checkbox", { name: /^I have checked the answer/ });
    const save = page.getByRole("button", { name: "Save reviewed result", exact: true });
    assert.equal(await save.isDisabled(), true, "The review check is required before saving.");
    await factCheck.check();
    await page.getByLabel("Plan text", { exact: true }).fill("Edited synthetic plan.");
    assert.equal(await factCheck.isChecked(), false, "Editing the answer resets its review check.");
    await page.getByLabel("Plan text", { exact: true }).fill("Edited synthetic plan with no verified saving claimed.");
    await factCheck.check();
    await save.click();
    await page.getByRole("heading", { name: "Synthetic water case · Plan", exact: true, level: 2 }).waitFor();
    await page.getByText("AI-service answer supplied and reviewed by you.", { exact: false }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Open plan", exact: true }).click();
    await page.getByText("Edited synthetic plan with no verified saving claimed.", { exact: true }).waitFor();

    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    for (const width of [390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "Result overflow at " + width);
      const violations = await page.locator("#local-plan-heading").evaluate(async node => (await axe.run(node.parentElement, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(n => n.target) })));
      assert.deepEqual(violations, [], "Saved result accessibility at " + width);
      await page.screenshot({ path: "/tmp/homeadmin-guided-result-" + width + ".png" });
    }
    const { workflowPrompt } = await import("../artifacts/adminpilot-ai/src/lib/offline/bill-workflow.mjs");
    const { fieldsFor } = await import("../artifacts/adminpilot-ai/src/lib/offline/bill-types.mjs");
    const dualFuelFields = fieldsFor("energy_water", "reduce_price", { utility_type: "Dual fuel" });
    for (const label of ["Annual electricity use (kWh)", "Annual gas use (kWh)", "Electricity unit rate (p/kWh)", "Gas unit rate (p/kWh)"]) {
      assert.equal(dualFuelFields.some(field => field.label === label), true, "Missing dual-fuel detail: " + label);
    }
    const energyPrompt = workflowPrompt({ category_id: "energy_water", goal_id: "reduce_price", details: { utility_type: "Dual fuel", provider: "Example Energy", currency: "GBP", electricity_usage: "2700", gas_usage: "11500" } }, { output: "plan", method: "chosen_ai", step: 2, fieldKeys: [], tone: "Polite and clear", language: "English", brief: "Compare current alternatives", incoming: "" });
    assert.match(energyPrompt, /each fuel from its own annual kWh consumption/i);
    assert.match(energyPrompt, /do not invent missing rates/i);
    assert.deepEqual(external, [], "This journey must not make an unapproved external request.");
    assert.deepEqual(errors, [], "No browser errors should occur during the journey.");
    console.log("PASS: saved bill details -> preselected savings request -> prepared AI prompt and link -> saved progress -> reviewed result; edit resume and 390/768/1024 accessibility checks.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

}

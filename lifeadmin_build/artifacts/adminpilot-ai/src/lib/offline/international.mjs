// A conservative provider-query route until jurisdiction-specific playbooks have
// been reviewed. No UK rights, ombudsmen or switching rules are implied overseas.
export function internationalResult(task) {
  const d = task.details;
  const provider = d.provider || "my provider";
  const request = {
    reduce_price: "Please itemise my current charges and explain lower-cost options for the same service, including eligibility, fees and changes to cover or service.",
    prepare_renewal: "Please confirm my renewal date, proposed price, notice deadline, renewal method and any fees. Explain alternatives before renewing my agreement.",
    cancel_switch: "Please explain the cancellation or transfer process, notice period, final charges, equipment returns and any service interruption. Do not change my account until I confirm.",
    check_bill: "Please explain the calculation of this bill, including the billing period, rates, taxes, discounts, readings and any change from my previous bill.",
    challenge_charge: "Please investigate the charge described below, explain the calculation and correct any confirmed error. Please provide a reference and your complaint or review procedure.",
    contact_provider: "Please answer the question below and explain the next steps and response times.",
  }[task.goal_id] || "Please explain this payment and the available next steps.";
  const facts = Object.entries(d).filter(([key, value]) => !key.startsWith("diary_") && String(value).trim()).map(([key, value]) => "- " + key.replaceAll("_", " ") + ": " + value);
  if (task.notes) facts.push("- Additional notes: " + task.notes);
  const message = "Hello,\n\n" + request + "\n\nBill: " + (task.title || task.category) + "\n" + facts.join("\n") + "\n\nPlease confirm the rules and options applying to my location. I will review your response before approving changes.\n\nThank you.";
  return {
    next_steps: "1. Review the supplied " + task.category + " details for " + (d.country_name || d.country) + ". Confirm the local state, province or municipality where rules differ.\n2. " + request + "\n3. Contact " + provider + " through the official details on your bill. Keep the response and reference.\n4. Compare the full cost and service implications before deciding. This is general provider-query guidance, not a verified local legal or financial assessment.",
    things_to_check: facts.join("\n") + "\n- Confirm local taxes, currency, provider terms and applicable consumer protections through official local sources.\n- Do not apply UK-specific cancellation periods, regulator routes, eligibility or switching rules to this bill.",
    approval_checklist: "- Check the country, currency, amount and dates.\n- Confirm fees, service continuity and any minimum term in writing.\n- Approve every message, cancellation, switch or payment change yourself. Nothing has been sent.",
    provider_message: message,
    provider_email: { subject: Array.from(provider + " bill enquiry").slice(0, 140).join(""), body: message, kind: "provider" },
  };
}

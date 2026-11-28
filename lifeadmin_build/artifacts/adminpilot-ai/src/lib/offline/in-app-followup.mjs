const MAX_REQUEST = 20000;
export function composeInAppFollowUp({ originalRequest, currentAnswer, followUpQuestion }) {
  for (const [name, value] of Object.entries({ originalRequest, currentAnswer, followUpQuestion })) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  }
  const prompt = [
    "Continue the user's existing HomeAdmin bill task. Keep claims grounded in supplied context. Do not invent prices, eligibility, provider terms or sources. Ask for missing facts instead of guessing.",
    "Original request:", originalRequest.trim(), "Current answer to revise:", currentAnswer.trim(),
    "User follow-up:", followUpQuestion.trim(),
    "Return the complete revised answer, preserving useful content and marking uncertain facts clearly. Do not send messages or make account changes."
  ].join("\n\n");
  if (prompt.length > MAX_REQUEST) throw new Error("The follow-up and answer exceed the 20,000 character limit. Shorten the answer or question before sending.");
  return prompt;
}

export async function requestInAppFollowUp({
  prompt, output, method, provider, apiKey, liveComparison,
  generateDraft, generateComparison, generateCustomer,
}) {
  if (method === "customer_api") {
    return generateCustomer(prompt, output, provider, apiKey, liveComparison === true);
  }
  if (method === "gemini_api") {
    return liveComparison === true
      ? generateComparison(prompt)
      : generateDraft(prompt, output);
  }
  throw new Error("Choose an in-app AI service before asking a follow-up.");
}

export function retainProviderEmail(current, refreshed) {
  return {
    messageSubject: typeof current?.messageSubject === "string" && current.messageSubject.trim()
      ? current.messageSubject
      : refreshed.messageSubject,
    messageBody: typeof current?.messageBody === "string" && current.messageBody.trim()
      ? current.messageBody
      : refreshed.messageBody,
  };
}

export async function runAndClearEphemeralInput(operation, clearInput) {
  try {
    return await operation();
  } finally {
    clearInput();
  }
}

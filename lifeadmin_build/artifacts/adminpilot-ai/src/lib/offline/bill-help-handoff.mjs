// Copy and save are one explicit user action. Assistant navigation stays a
// separate, visible link so popup policy cannot prevent clipboard access.
export async function copyAndSaveBillHelp({ copyPrompt, saveProgress }) {
  let copyPromise;
  try { copyPromise = Promise.resolve(copyPrompt()); }
  catch (error) { copyPromise = Promise.reject(error); }
  const copyResult = copyPromise.then(() => ({ ok: true }), error => ({ ok: false, error }));
  await saveProgress();
  const copied = await copyResult;
  return { saved: true, copied: copied.ok, error: copied.ok ? null : copied.error };
}

export function copyAndSaveBillHelp(options: {
  copyPrompt: () => Promise<void>;
  saveProgress: () => Promise<void>;
}): Promise<{ saved: true; copied: boolean; error: unknown | null }>;

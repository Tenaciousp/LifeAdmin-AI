export function isNativeDevice(): boolean;
export function exportDeviceBackup(text: string): Promise<"saved" | "requested">;
export function chooseDeviceBackup(): Promise<string | null>;

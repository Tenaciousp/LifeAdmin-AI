import { Capacitor, registerPlugin } from "@capacitor/core";
import { parseBackup } from "./storage.mjs";

const files = registerPlugin("LifeAdminFiles");
export const isNativeDevice = () => Capacitor.isNativePlatform();
function nativeFiles() {
  if (!Capacitor.isPluginAvailable("LifeAdminFiles")) throw new Error("Native backup file handling is unavailable. Existing records have not changed.");
  return files;
}
export async function exportDeviceBackup(text) {
  parseBackup(text);
  if (isNativeDevice()) {
    await nativeFiles().exportBackup({ snapshot: text });
    return "saved";
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "lifeadmin-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "requested";
}
export async function chooseDeviceBackup() {
  if (!isNativeDevice()) return null;
  const result = await nativeFiles().importBackup();
  parseBackup(result.snapshot);
  return result.snapshot;
}

export async function copyDeviceText(text) {
  if (typeof text !== "string" || text.length > 262144) throw new Error("Plan text is too large to copy.");
  if (isNativeDevice()) { await nativeFiles().copyText({ text }); return; }
  if (!navigator.clipboard?.writeText) throw new Error("Copy is unavailable. Select the text and copy manually.");
  await navigator.clipboard.writeText(text);
}

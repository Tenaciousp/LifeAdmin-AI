import { Capacitor, registerPlugin } from "@capacitor/core";
import { openLocalStore } from "./storage.mjs";
import { openNativeStore } from "./native-store.mjs";

const nativeStorage = registerPlugin("LifeAdminStorage");
export function openDeviceStore() {
  if (!Capacitor.isNativePlatform()) return openLocalStore();
  if (!Capacitor.isPluginAvailable("LifeAdminStorage")) throw new Error("Native device storage is unavailable. Reopen the app or contact support. Existing records have not been replaced.");
  return openNativeStore(nativeStorage);
}

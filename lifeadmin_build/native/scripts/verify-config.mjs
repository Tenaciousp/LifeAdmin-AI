import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const config = JSON.parse(await readFile(new URL("../capacitor.config.json", import.meta.url), "utf8"));
assert.equal(config.appId, "uk.co.tenaciouspl.lifeadmin");
assert.equal(config.appName, "LifeAdmin");
assert.equal(config.webDir, "../artifacts/adminpilot-ai/dist-local/public");
assert.equal(config.server, undefined, "Native release must use bundled assets, without a remote server.");
assert.equal(config.plugins, undefined, "Plugin configuration requires explicit review.");
console.log("Native config points to the offline package with no remote-server override.");

const nativeFile = relative => readFile(new URL("../" + relative, import.meta.url), "utf8");
assert.match(await nativeFile("android/app/src/main/java/uk/co/tenaciouspl/lifeadmin/MainActivity.java"), /registerPlugin\(LifeAdminStoragePlugin\.class\)/);
assert.match(await nativeFile("ios/App/App/SceneDelegate.swift"), /LifeAdminViewController\(\)/);
assert.match(await nativeFile("ios/App/App/LifeAdminViewController.swift"), /registerPluginInstance\(LifeAdminStoragePlugin\(\)\)/);
const project = await nativeFile("ios/App/App.xcodeproj/project.pbxproj");
assert.match(project, /LifeAdminStoragePlugin\.swift in Sources/);
assert.match(project, /LifeAdminViewController\.swift in Sources/);
console.log("Native repository is registered on both platforms.");

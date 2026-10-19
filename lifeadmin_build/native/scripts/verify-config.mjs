import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const config = JSON.parse(await readFile(new URL("../capacitor.config.json", import.meta.url), "utf8"));
assert.equal(config.appId, "uk.co.tenaciouspl.lifeadmin");
assert.equal(config.appName, "HomeAdmin");
assert.equal(config.webDir, "../artifacts/adminpilot-ai/dist-local/public");
assert.equal(config.server, undefined, "Native release must use bundled assets, without a remote server.");
assert.equal(config.plugins, undefined, "Plugin configuration requires explicit review.");
console.log("Native config points to the offline package with no remote-server override.");

const nativeFile = relative => readFile(new URL("../" + relative, import.meta.url), "utf8");
assert.match(await nativeFile("android/app/src/main/java/uk/co/tenaciouspl/lifeadmin/MainActivity.java"), /registerPlugin\(LifeAdminStoragePlugin\.class\)/);
assert.match(await nativeFile("ios/App/App/SceneDelegate.swift"), /LifeAdminViewController\(\)/);
assert.match(await nativeFile("ios/App/App/LifeAdminViewController.swift"), /registerPluginInstance\(LifeAdminStoragePlugin\(\)\)/);
const project = await nativeFile("ios/App/App.xcodeproj/project.pbxproj");
const appleTargets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([0-9.]+);/g)];
assert.ok(appleTargets.length > 0, "Apple deployment targets must be declared.");
for (const [, target] of appleTargets) {
  const [major, minor = 0] = target.split(".").map(Number);
  assert.ok(major > 16 || (major === 16 && minor >= 4),
    "The bundled Tailwind 4 UI requires iOS 16.4 or later.");
}
assert.match(project, /LifeAdminStoragePlugin\.swift in Sources/);
assert.match(project, /LifeAdminViewController\.swift in Sources/);
console.log("Native repository is registered on both platforms.");

assert.match(await nativeFile("android/app/src/main/java/uk/co/tenaciouspl/lifeadmin/MainActivity.java"), /registerPlugin\(LifeAdminFilesPlugin\.class\)/);
assert.match(await nativeFile("ios/App/App/LifeAdminViewController.swift"), /registerPluginInstance\(LifeAdminFilesPlugin\(\)\)/);
assert.match(project, /LifeAdminFilesPlugin\.swift in Sources/);
console.log("Native backup file handling is registered on both platforms.");


assert.match(await nativeFile("android/app/src/main/java/uk/co/tenaciouspl/lifeadmin/MainActivity.java"), /registerPlugin\(LifeAdminCalendarPlugin\.class\)/);
assert.match(await nativeFile("ios/App/App/LifeAdminViewController.swift"), /registerPluginInstance\(LifeAdminCalendarPlugin\(\)\)/);
assert.match(project, /LifeAdminCalendarPlugin\.swift in Sources/);
assert.match(project, /PrivacyInfo\.xcprivacy in Resources/);
const info = await nativeFile("ios/App/App/Info.plist");
for (const key of ["NSCalendarsUsageDescription", "NSCalendarsFullAccessUsageDescription"]) assert.ok(info.includes(key));
const android = await nativeFile("android/app/src/main/AndroidManifest.xml");
for (const permission of ["READ_CALENDAR", "WRITE_CALENDAR"]) assert.ok(android.includes(permission));
assert.match(await nativeFile("ios/App/App/PrivacyInfo.xcprivacy"), /CA92\.1/);
console.log("Optional calendar adapters and permission descriptions are registered. Runtime delivery remains a separate acceptance check.");

const teams = [...project.matchAll(/DEVELOPMENT_TEAM = ([A-Z0-9]+);/g)];
assert.equal(teams.length, 4, "App and UI-test Debug/Release settings must each declare a team.");
for (const [, team] of teams) assert.equal(team, "C8T85FCR6R", "Unexpected Apple signing team.");
console.log("Apple app and UI-test signing use the approved developer team.");


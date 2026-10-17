import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const native = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(native, "..");
const platform = process.argv[2];
if (!["android", "ios"].includes(platform)) throw new Error("Choose android or ios.");
if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Native tooling requires Node 22 or later.");
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + " failed.");
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
run(npm, ["run", "build:local"], root);
run(process.execPath, ["scripts/verify_local_bundle.mjs"], root);
run(process.execPath, ["scripts/verify-config.mjs"], native);
const cli = path.resolve(native, "node_modules/@capacitor/cli/bin/capacitor");
if (!existsSync(path.resolve(native, platform))) throw new Error("Native project is missing. Run npm exec cap add " + platform + " from native, then rerun sync.");
run(process.execPath, [cli, "sync", platform], native);
console.log("Development assets synchronized. This is not a signed release or device acceptance.");

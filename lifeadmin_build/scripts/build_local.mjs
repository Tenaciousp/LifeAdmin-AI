import { spawnSync } from "node:child_process";
const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["--workspace", "@workspace/adminpilot-ai", "run", "build"], { stdio: "inherit", env: { ...process.env, VITE_LIFEADMIN_LOCAL: "true", LIFEADMIN_LOCAL_BUILD: "true" } });
if (result.error) throw result.error;
process.exit(result.status ?? 1);

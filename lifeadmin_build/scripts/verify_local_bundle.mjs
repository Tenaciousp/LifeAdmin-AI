import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("artifacts/adminpilot-ai/dist-local/public");
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(full));
    else if (entry.name.endsWith(".js")) result.push(full);
  }
  return result;
}
const assets = await files(root);
if (!assets.length) throw new Error("Local build has no JavaScript assets.");
const forbidden = ["/api/auth/", "/api/tasks", "/api/notes", "/api/agent", "/api/checkout", "/api/products", "/api/analytics"];
for (const file of assets) {
  const source = await readFile(file, "utf8");
  for (const endpoint of forbidden) if (source.includes(endpoint)) throw new Error("Hosted endpoint in local bundle: " + endpoint);
}
const all = (await Promise.all(assets.map(file => readFile(file, "utf8")))).join("\n");
for (const required of ["lifeadmin-device-v1", "Export backup", "Restore backup"]) {
  if (!all.includes(required)) throw new Error("Local build is missing " + required);
}
console.log("Local package contains device storage and backup controls, with no hosted customer API endpoints.");

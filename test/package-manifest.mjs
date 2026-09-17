import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const patchPath = path.join(root, "cordis.patch.yml");

assert.equal(packageJson.dsh?.bundle?.patch, "./cordis.patch.yml");
assert.ok(fs.existsSync(patchPath), "cordis.patch.yml must be shipped with the package");

const patch = fs.readFileSync(patchPath, "utf8");
assert.match(patch, /id:\s*dsh-system-monitor/);
assert.match(patch, /name:\s*dsh-system-monitor/);

console.log("ALL PASS");

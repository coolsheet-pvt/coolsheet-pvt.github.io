import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const app = fs.readFileSync(path.join(root,"js/app.js"),"utf8");
const backend = fs.readFileSync(path.join(root,"pvt-tmy-api/server.py"),"utf8");

assert.match(app, /REQUIRED_TMY_CONTRACT = "2\.1"/);
assert.match(app, /health\?\.status !== "ready"/);
assert.match(app, /modelBLongwavePolicy !== "frozen-prohibited"/);
assert.match(app, /relativeHumidityPct/);
assert.match(app, /infraredHorizontalWm2/);
assert.match(app, /processKey === "outdoor_pool"/);
assert.match(backend, /"modelBLongwavePolicy": "frozen-prohibited"/);
assert.match(backend, /row\.get\("IR\(h\)"/);

const modelStart = app.indexOf("function calculatePvtThermalSample");
const modelEnd = app.indexOf("function calculatePvtThermalHourly", modelStart);
assert.ok(modelStart >= 0 && modelEnd > modelStart, "protected model block markers missing");
const protectedModelBlock = app.slice(modelStart, modelEnd);
assert.doesNotMatch(protectedModelBlock, /relativeHumidity|infraredHorizontal|IR\(h\)/,
  "new weather fields must not enter Models A/B");
console.log("Weather 2.1 release-gate and RH/IR separation tests passed.");

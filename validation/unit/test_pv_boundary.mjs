import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const app = fs.readFileSync(path.join(root,"js/app.js"),"utf8");
const html = fs.readFileSync(path.join(root,"index.html"),"utf8");

const match = app.match(/function calcPvAcDeliveryFactor\([^]*?\n\}/);
assert.ok(match,"AC delivery helper missing");
const clamp = (v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const calc = new Function("clamp",`${match[0]}; return calcPvAcDeliveryFactor;`)(clamp);
assert.equal(calc(14,96),0.8256);
assert.equal(calc(0,100),1);
assert.ok(calc(20,95) < calc(10,95));

assert.match(html,/id="pvtCoolingSensitivityEnable"\s*\/>/,
  "cooling sensitivity must be off by default");
assert.match(html,/id="pvSystemLossPct"[^>]*value="14"/);
assert.match(html,/id="pvInverterEfficiencyPct"[^>]*value="96"/);
assert.match(app,/const pvtPanelTempC = pvtCoolingSensitivityEnable \? exploratoryPvtPanelTempC : pvPanelTempC/);
assert.match(app,/E_pvt_dc_kWh/);
assert.match(app,/PVT estimated net AC electricity/);
console.log("PV cooling sensitivity and DC/AC boundary tests passed.");

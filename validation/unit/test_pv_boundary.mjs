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

assert.match(html,/id="pvtCoolingSensitivityEnable"\s+checked\s*\/>/,
  "PVT cooling effect must be included by default for the annual PVT result");
assert.match(app,/INPUT_DEFAULTS_VERSION\s*=\s*"2026-07-pvt-cooling-default-on"/,
  "Saved browser inputs must be migrated when the PVT cooling default changes");
assert.match(app,/data\.pvtCoolingSensitivityEnable\s*=\s*true/,
  "Old saved inputs must not keep the PVT cooling effect disabled by accident");
assert.match(html,/id="pvSystemLossPct"[^>]*value="14"/);
assert.match(html,/id="pvInverterEfficiencyPct"[^>]*value="96"/);
assert.match(html,/id="etaPvPercent"[^>]*value="20"/,
  "Panel efficiency should be presented as a familiar percentage");
assert.match(html,/pv-technical-details/,
  "Technical PV inputs should stay available in a collapsed section");
assert.match(app,/if \(!testingMode\)[^]*?temperatureToggle\.checked = true[^]*?coolingToggle\.checked = true/,
  "Normal mode should keep the recommended temperature and cooling models enabled");
assert.match(app,/const pvtPanelTempC = pvtCoolingSensitivityEnable \? exploratoryPvtPanelTempC : pvPanelTempC/);
assert.match(app,/E_pvt_dc_kWh/);
assert.match(app,/const pvt_ac_kWh = pvt_dc_kWh \* pvAcDeliveryFactor/,
  "Estimated net AC should remain available as a separate detailed value");
assert.match(app,/const pv_kWh = pvt_dc_kWh;/,
  "Headline PVT electricity should reproduce the original gross module-yield result");
assert.match(app,/pvtNetAcKWh: E_pvt_ac_kWh/,
  "Export state should keep the net AC boundary separate from headline electricity");
assert.match(app,/PVT estimated net AC electricity/);
assert.match(app,/annual-summary-item annual-electricity-summary/,
  "Related electricity results should share one annual summary card");
assert.match(app,/annual-electricity-breakdown[^]*?<span>PV-only baseline<\/span>[^]*?<span>Cooling gain<\/span>/,
  "The combined electricity card should explain the baseline and cooling gain");
assert.match(app,/annual-finance-grid[^]*?<span>PVT supply value<\/span>[^]*?<span>Avg daytime outlet temp<\/span>/,
  "Supply value and average outlet temperature should share one annual summary card");
assert.match(app,/function applySuggestedFlowRate\(nextFlowRate\)[^]*?void calcAnnualPVT\(\)/,
  "The winter flow suggestion should update the input and immediately recalculate");
assert.doesNotMatch(app,/Open PVGIS validation result/,
  "The redundant PVGIS validation-result action should not appear in annual results");
assert.match(app,/Open PVGIS tool/,
  "The direct PVGIS tool action should remain available");
assert.doesNotMatch(app,/PVGIS ERA5,[^]*?Open for economics, levelised costs, and calculation detail/,
  "The extra PVGIS model detail should not clutter the annual results card");
console.log("PV cooling effect and DC/AC boundary tests passed.");

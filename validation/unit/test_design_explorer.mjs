// Deterministic tests for the interactive PVT design explorer calculations.
import assert from "node:assert/strict";
import fs from "node:fs";

const APP = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");

function extract(name, kind="func"){
  const re = kind === "func"
    ? new RegExp(`function\\s+${name}\\s*\\(`)
    : new RegExp(`const\\s+${name}\\s*=`);
  const match = re.exec(APP);
  if (!match) throw new Error(`Could not extract ${name}`);
  const start = match.index;
  if (kind === "const"){
    let depth = 0;
    for (let i = start; i < APP.length; i++){
      const char = APP[i];
      if ("([{".includes(char)) depth++;
      else if (")]}".includes(char)) depth--;
      else if (char === ";" && depth === 0) return APP.slice(start, i + 1);
    }
  }
  const open = APP.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < APP.length; i++){
    if (APP[i] === "{") depth++;
    else if (APP[i] === "}" && --depth === 0) return APP.slice(start, i + 1);
  }
  throw new Error(`Could not close ${name}`);
}

const code = [
  extract("clamp"),
  extract("isFiniteNumber"),
  extract("MONTH_DAYS", "const"),
  extract("monthFromDayN"),
  extract("calculateThermalStorage"),
  extract("calculatePvtThermalSample"),
  extract("calculatePvtThermalHourly"),
  extract("aggregateMonthly"),
  extract("calculateHourlyEnergyBalance"),
  extract("calculateStorageMonthlyEnergyBalance"),
  extract("buildDesignExplorerHourlySeries"),
  extract("calculateDesignExplorerScenario"),
  extract("findDesignExplorerTargetArea")
].join("\n");

const mod = new Function(`${code}\nreturn {calculatePvtThermalHourly,calculateDesignExplorerScenario,findDesignExplorerTargetArea};`)();

const met = [];
for (let day = 1; day <= 2; day++){
  for (let hour = 0; hour < 24; hour++){
    met.push({ dayN:day, hourN:hour, dni:0, dhi:0, ta:20, vwind:2 });
  }
}
const demandHourly = met.map(record => record.hourN >= 8 && record.hourN < 16 ? 50 : 0);
const calculator = { calculate: (_dayN, solarHour) => ({
  totalIrradiance: solarHour >= 8 && solarHour < 16 ? 800 : 0
}) };
const state = {
  areaM2: 100,
  demandHourly,
  met,
  calculator,
  mains: { annualAvgC:18, byDay:{1:18,2:18} },
  flowRateLpsPerM2:0.02,
  thermalModel:"A",
  a0:0.5,
  a1:0,
  a2:0,
  storageVolumeLitres:0,
  cache:new Map()
};

const result = mod.calculateDesignExplorerScenario(100, state, { includeHourly:true });
assert.equal(result.thermalKWh, 640);
assert.equal(result.balance.metBySupply, 640);
assert.equal(result.balance.unmet, 160);
assert.equal(result.coverage, 0.8);
assert.equal(result.hourly.supply.length, 48);
assert.equal(result.hourly.supply[8], 40);
assert.equal(result.hourly.matched[8], 40);
assert.equal(result.hourly.unmet[8], 10);
assert.equal(result.hourly.excess[8], 0);

const recommendation = mod.findDesignExplorerTargetArea(50, state);
assert.equal(recommendation.achievable, true);
assert.ok(Math.abs(recommendation.scenario.areaM2 - 62.5) < 0.1, `expected about 62.5 m2, got ${recommendation.scenario.areaM2}`);
assert.ok(recommendation.scenario.coverage >= 0.5);

const storageState = { ...state, storageVolumeLitres:1000, cache:new Map() };
const storageResult = mod.calculateDesignExplorerScenario(100, storageState, { includeHourly:true });
assert.equal(storageResult.coverage, 0.8);
assert.equal(storageResult.hourly.storageSoc.length, 48);
assert.match(APP, /function buildDesignExplorerHeatmap\(/);
assert.match(APP, /function renderDesignExplorerHeatmap\(/);

console.log("PVT design explorer hourly recalculation and target-area search passed.");

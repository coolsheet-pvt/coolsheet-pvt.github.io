import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "validation", "field-data", "soac-mar-2026");
const sourceDashboard = readFileSync(path.join(sourceDir, "CoolSheet_Dashboard_SOAC_Mar2026_WindCorrected.htm"));
const sourceHash = createHash("sha256").update(sourceDashboard).digest("hex");
assert.equal(sourceHash, "61b527e0652e4ffe79f564629c64d9c5d71398f7bd04a974f63613ebb397f788");

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map(line => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => {
      const raw = values[index] ?? "";
      const numeric = Number(raw);
      return [header, raw !== "" && Number.isFinite(numeric) ? numeric : null];
    }));
  });
}

const rows = parseCsv(readFileSync(path.join(sourceDir, "soac_timeseries.csv"), "utf8"));
assert.equal(rows.length, 5472);

const AREA_M2 = 534.733164;
const CP = 4184;
const ETA0 = 0.4112;
const STEP_HOURS = 5 / 60;
const result = { modelA: 0, modelB: 0, modelBWind: 0 };

for (const row of rows) {
  const G = Number(row.G) || 0;
  const inlet = Number(row.T_in);
  const ambient = Number(row.T_amb);
  const flow = Number(row.flow) || 0;
  const reducedTemperature = G > 0 ? (inlet - ambient) / G : 0;
  const etaA = G > 0
    ? Math.min(1, Math.max(0, 0.279952866 - 10.52839866 * reducedTemperature - 0.008135537 * 2))
    : 0;
  const modelB = loss => {
    const massFlowKgS = flow * 1000 / 3600;
    if (!(G > 0 && massFlowKgS > 0 && Number.isFinite(inlet) && Number.isFinite(ambient))) return 0;
    return Math.max(0, AREA_M2 * (ETA0 * G - loss * (inlet - ambient)) / (1 + AREA_M2 * loss / (2 * massFlowKgS * CP))) / 1000;
  };

  result.modelA += (flow > 1 ? etaA * G * AREA_M2 / 1000 : 0) * STEP_HOURS;
  result.modelB += modelB(10.358) * STEP_HOURS;
  result.modelBWind += modelB(12.106) * STEP_HOURS;
}

assert.ok(Math.abs(result.modelA - 5522.2685) < 0.001);
assert.ok(Math.abs(result.modelB - 9494.4446) < 0.001);
assert.ok(Math.abs(result.modelBWind - 8894.6601) < 0.001);

const validationPage = readFileSync(path.join(root, "pages", "soac-field-validation.html"), "utf8");
const homePage = readFileSync(path.join(root, "index.html"), "utf8");
assert.match(validationPage, /the core thermal equation is credible/i);
assert.match(validationPage, /5,888\.4 kWh/);
assert.match(validationPage, /thermal field-performance factor/i);
assert.match(homePage, /pages\/soac-field-validation\.html/);

console.log("SOAC field-validation source, calculations, and page wiring passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
import { computeCoolSheetPvOnly } from "../scripts/compute_pv_external_benchmark.mjs";

const reference = JSON.parse(fs.readFileSync("validation/reference/pv_external_validation.json", "utf8"));
assert.equal(reference.schemaVersion, 2);
assert.equal(reference.scenario.areaM2 * reference.scenario.moduleEfficiencyStc, reference.scenario.dcCapacityKw);
assert.equal(reference.scenario.combinedAcDeliveryLossPct, 17.44);
assert.equal(reference.locations.length, 5);
assert.deepEqual(reference.locations.map(location => location.city), ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"]);

const matchedDifferences = [];
const allDifferences = [];
for (const location of reference.locations) {
  const actual = computeCoolSheetPvOnly(location.city.toLowerCase());
  assert.ok(Math.abs(actual.annual_ac_kwh - location.coolsheet.annualAcKWh) < 1e-6, `${location.city} CoolSheet annual AC drifted`);
  assert.equal(actual.monthly_ac_kwh.length, 12);
  const pvgisDifference = (location.pvgis.annualAcKWh / actual.annual_ac_kwh - 1) * 100;
  const pvwattsDifference = (location.pvwatts.annualAcKWh / actual.annual_ac_kwh - 1) * 100;
  const cecDifference = (location.cecRegionalBenchmark.annualAcKWh / actual.annual_ac_kwh - 1) * 100;
  assert.ok(Math.abs(pvgisDifference - location.pvgis.differenceVsCoolSheetPct) < 0.01);
  assert.ok(Math.abs(pvwattsDifference - location.pvwatts.differenceVsCoolSheetPct) < 0.01);
  assert.ok(Math.abs(cecDifference - location.cecRegionalBenchmark.differenceVsCoolSheetPct) < 0.01);
  assert.ok(Math.abs(location.cecRegionalBenchmark.annualAcKWh - location.cecRegionalBenchmark.averageDailyKWhPerKw * 4 * 365) < 1e-9);
  matchedDifferences.push(Math.abs(pvgisDifference), Math.abs(pvwattsDifference));
  allDifferences.push(Math.abs(pvgisDifference), Math.abs(pvwattsDifference), Math.abs(cecDifference));
}

const matchedMeanAbsoluteDifference = matchedDifferences.reduce((sum, value) => sum + value, 0) / matchedDifferences.length;
const allMeanAbsoluteDifference = allDifferences.reduce((sum, value) => sum + value, 0) / allDifferences.length;
assert.ok(Math.abs(matchedMeanAbsoluteDifference - reference.summary.matchedModelMeanAbsoluteDifferencePct) < 0.01);
assert.ok(Math.abs(allMeanAbsoluteDifference - reference.summary.allReferenceMeanAbsoluteDifferencePct) < 0.01);
assert.equal(reference.summary.matchedModelComparisonCount, 10);
assert.equal(reference.summary.allReferenceComparisonCount, 15);
assert.ok(Math.max(...matchedDifferences) <= 4.54);
assert.ok(Math.max(...allDifferences) <= 8.23);

const appSource = fs.readFileSync("js/app.js", "utf8");
const homePage = fs.readFileSync("index.html", "utf8");
const validationPage = fs.readFileSync("pages/pv-external-validation.html", "utf8");
const validationHub = fs.readFileSync("pages/validation-hub.html", "utf8");
assert.match(appSource, /\(1 - \(1 - nonInverterLoss\) \* inverterEfficiency\) \* 100/);
assert.match(homePage, /pages\/pv-external-validation\.html/);
assert.match(homePage, /pages\/validation-hub\.html/);
assert.match(homePage, /AUD\/ft&sup2;; non-SI/);
assert.match(homePage, /About, sources and privacy/);
assert.doesNotMatch(homePage, /Need to add disclaimer later/);
assert.match(appSource, /pvOnlyNetAcKWh/);
assert.match(validationPage, /Easy procedure/);
assert.match(validationPage, /Check your current CoolSheet setup/);
assert.match(validationPage, /No result is invented or estimated/);
assert.doesNotMatch(validationPage, /Australian units/);
assert.match(validationPage, /Australian CEC benchmark/);
assert.match(validationPage, /<option>Brisbane<\/option>/);
assert.match(validationPage, /<option>Adelaide<\/option>/);
assert.match(validationPage, /does not provide adjustable tilt or detailed loss settings/);
assert.match(validationPage, /Shading, faults, downtime or panel ageing/i);
assert.match(validationPage, /extra electricity claimed from PVT water cooling/i);
assert.match(validationHub, /Strong benchmark agreement/);
assert.match(validationHub, /Preliminary field evidence/);
assert.match(validationHub, /Not yet fully validated/);

console.log("PV external comparison and page wiring passed.");

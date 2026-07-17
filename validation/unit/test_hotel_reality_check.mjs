// Regression tests for the optional hotel meter-calibration workflow.
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
  extract("isFiniteNumber"),
  extract("getInputNumberValue"),
  extract("HOTEL_METER_FUEL_INPUT_IDS", "const"),
  extract("GJ_TO_KWH", "const"),
  extract("getHotelRealityCheck")
].join("\n");

const fields = new Map();
globalThis.document = { getElementById: id => fields.get(id) || null };
const mod = new Function(`${code}\nreturn { getHotelRealityCheck, GJ_TO_KWH };`)();

function setField(id, value, checked=false){ fields.set(id, { value:String(value), checked }); }
function clearFields(){ fields.clear(); }
function near(actual, expected, tolerance=1e-9){
  assert.ok(Math.abs(actual - expected) <= tolerance, `got ${actual}, expected ${expected}`);
}

const modelledHeatKWh = 248_346;
const boilerEfficiency = 0.85;

clearFields();
let result = mod.getHotelRealityCheck(modelledHeatKWh, boilerEfficiency);
assert.equal(result.hasMeter, false);
assert.equal(result.applied, false);
assert.equal(result.uncertaintyFraction, 0.25);

clearFields();
setField("hotelMeasuredAnnualFuelGj", 900);
setField("hotelApplyMeterCalibration", "", true);
result = mod.getHotelRealityCheck(modelledHeatKWh, boilerEfficiency);
near(result.usefulHeatKWh, 900 * mod.GJ_TO_KWH * boilerEfficiency);
near(result.calibrationFactor, result.usefulHeatKWh / modelledHeatKWh);
assert.equal(result.applied, true);
assert.equal(result.completeMonthlyMeter, false);
assert.equal(result.uncertaintyFraction, 0.15);

clearFields();
setField("hotelMeasuredAnnualFuelGj", 900);
setField("hotelApplyMeterCalibration", "", true);
const monthIds = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
for (const month of monthIds) setField(`hotelMeter${month}FuelGj`, 10);
result = mod.getHotelRealityCheck(modelledHeatKWh, boilerEfficiency);
assert.equal(result.completeMonthlyMeter, true);
near(result.fuelGj, 120);
near(result.usefulHeatKWh, 120 * mod.GJ_TO_KWH * boilerEfficiency);
assert.equal(result.uncertaintyFraction, 0.10);
assert.equal(result.monthlyUsefulHeatKWh.length, 12);

clearFields();
setField("hotelMeasuredAnnualFuelGj", 900);
setField("hotelMeterJanFuelGj", 10);
setField("hotelMeterFebFuelGj", 10);
result = mod.getHotelRealityCheck(modelledHeatKWh, boilerEfficiency);
assert.equal(result.completeMonthlyMeter, false);
assert.equal(result.enteredMonthlyCount, 2);
near(result.fuelGj, 900);

console.log("Hotel reality-check meter calibration tests passed.");

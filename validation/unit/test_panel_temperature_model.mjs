import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");

function extractFunction(name){
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  if (!match) throw new Error(`Function not found: ${name}`);
  const start = match.index;
  let index = source.indexOf("{", start);
  let depth = 0;
  for (; index < source.length; index++){
    if (source[index] === "{") depth += 1;
    if (source[index] === "}"){
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Function is incomplete: ${name}`);
}

const functions = [
  "calcNoctPanelTempC",
  "calcPvTemperatureFactor",
  "calcPvtPanelTempC"
].map(extractFunction).join("\n");

const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);
const model = new Function(
  "isFiniteNumber",
  "PV_DEFAULT_NOCT_C",
  "PV_STC_CELL_TEMP_C",
  `${functions}; return { calcNoctPanelTempC, calcPvTemperatureFactor, calcPvtPanelTempC };`
)(isFiniteNumber, 45, 25);

assert.equal(model.calcNoctPanelTempC(20, 800, 45), 45,
  "NOCT reference conditions should return the stated 45 C panel temperature");
assert.equal(model.calcNoctPanelTempC(18, 0, 45), 18,
  "At zero irradiance the panel should return to ambient temperature");
assert.equal(model.calcPvTemperatureFactor(-0.004, 25), 1,
  "The PV temperature factor should equal one at the 25 C STC reference");
assert.ok(Math.abs(model.calcPvTemperatureFactor(-0.004, 45) - 0.92) < 1e-12,
  "A 20 C rise with a -0.40%/C coefficient should reduce DC power by 8%");

const baseOptions = {
  ambientC:20,
  irradianceWm2:800,
  noctC:45,
  areaM2:10,
  tinC:25,
  toutC:null,
  flowKgPerHr:0,
  thermalPowerW:0,
  heatLossCoeffWm2K:10
};
assert.equal(model.calcPvtPanelTempC(baseOptions), 45,
  "With no recovered heat, PVT temperature should equal the uncooled NOCT result");
assert.equal(model.calcPvtPanelTempC({...baseOptions, thermalPowerW:1000}), 35,
  "The screening cooling model should subtract recovered heat divided by U_L times area");
assert.equal(model.calcPvtPanelTempC({...baseOptions, thermalPowerW:5000}), 25,
  "The PVT panel estimate should not fall below inlet-water temperature");

console.log("Panel temperature equation tests passed.");

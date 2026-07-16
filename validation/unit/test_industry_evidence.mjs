import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

for (const industry of ["dairy_farm","brewery","hotel","aquatic_centres","commercial_laundry"]){
  assert.match(app, new RegExp(`${industry}: \\{ evidenceClass:`), `${industry} evidence class missing`);
}
for (const value of [10,12,15,17,22]){
  assert.match(html, new RegExp(`- ${value} L/kg`), `laundry ${value} L/kg scenario missing`);
}
for (const id of ["hotelDhwKWh","hotelKitchenKWh","hotelLaundryKWh","hotelPoolKWh","hotelElectricKWh"]){
  assert.match(html, new RegExp(`id="${id}"`), `${id} must be editable`);
}
for (const id of ["dairyElectricKWhPerKL","dairyFattyWater","dairyCipWater","dairyBoilerWater","dairyTargetTemp",
                  "breweryElectricKWhPerHL","breweryCipWater","breweryRinseWater","breweryBoilerWater","breweryCipTarget","breweryRinseTarget",
                  "aquaticElectricKWhPerM2","aquaticEvaporationScale","aquaticMakeupScale"]){
  assert.match(html, new RegExp(`id="${id}"`), `${id} must be editable`);
}
assert.match(app, /calcDairyHourlyDemand\([^)]*assumptions=null/);
assert.match(app, /calcBreweryHourlyDemand\([^)]*assumptions=null/);
assert.match(app, /not a NABERS rating/);
assert.match(app, /WELS does not yet regulate commercial clothes washers/);
assert.doesNotMatch(app, /process temperatures calibrated to Australian commercial conditions/);
console.log("Industry evidence classification and editable-scenario tests passed.");

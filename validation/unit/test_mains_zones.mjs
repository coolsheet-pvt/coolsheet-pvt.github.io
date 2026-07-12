import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "js/cer_postcode_zones.js"), "utf8") +
  "\nthis.registry=CER_POSTCODE_ZONE_REGISTRY;this.lookup=lookupCERPostcodeZone;", context);

assert.equal(context.lookup("4700", "swh"), 1);
assert.equal(context.lookup("0870", "swh"), 2);
assert.equal(context.lookup("2000", "swh"), 3);
assert.equal(context.lookup("3000", "swh"), 4);
assert.equal(context.lookup("7000", "swh"), 4);
assert.equal(context.lookup("7000", "ashp"), 5);
assert.equal(context.lookup("9999", "swh"), null);

for (const family of ["swh", "ashp"]){
  const ranges = context.registry[family];
  for (let i=0; i<ranges.length; i++){
    const [start,end,zone] = ranges[i];
    assert.equal(context.lookup(String(start).padStart(4,"0"), family), zone);
    assert.equal(context.lookup(String(end).padStart(4,"0"), family), zone);
    if (i) assert.ok(ranges[i-1][1] < start, `${family} ranges overlap at ${start}`);
  }
}
assert.deepEqual([...new Set(context.registry.swh.map(r=>r[2]))].sort(), [1,2,3,4]);

const generated = fs.readFileSync(path.join(root, "js/bc_aus_zone_constants.js"), "utf8");
assert.match(generated, /zone1:[\s\S]*city: "Rockhampton"[\s\S]*sourceWeather: "rockhampton2\.tmy"/);
assert.match(generated, /zone2:[\s\S]*city: "Alice Springs"[\s\S]*sourceWeather: "alicesprings2\.tmy"/);
const constantsContext = {};
vm.createContext(constantsContext);
vm.runInContext(generated + "\nthis.constants=BC_AUS_ZONE_CONSTANTS;", constantsContext);
for (const [zoneKey, zone] of Object.entries(constantsContext.constants)) {
  assert.equal(zone.ratioC1, 0, `${zoneKey} must use one identifiable amplitude`);
  assert.equal(zone.lagC1, 0, `${zoneKey} must use one identifiable lag`);
  assert.ok(zone.ratioC0 > 0.5 && zone.ratioC0 < 1.5, `${zoneKey} amplitude must remain physically legible`);
  assert.ok(Math.abs(zone.lagC0) < 60, `${zoneKey} lag must remain physically legible`);
  assert.ok(Math.abs(zone.offsetF) < 10, `${zoneKey} offset must remain physically legible`);
  assert.ok(zone.rmseC < 1.1, `${zoneKey} fit RMSE must remain below 1.1 C`);
}
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
assert.doesNotMatch(app, /findNearestCERZone|CER_ZONE_CENTRES/);
assert.match(app, /function findClosestBcAusSwhReference/);
assert.match(app, /zoneKey:"zone1",zoneNumber:1,name:"Rockhampton"/);
assert.match(app, /zoneKey:"zone2",zoneNumber:2,name:"Alice Springs"/);
assert.match(app, /zoneKey:"zone3",zoneNumber:3,name:"Sydney"/);
assert.match(app, /zoneKey:"zone4",zoneNumber:4,name:"Melbourne"/);
assert.doesNotMatch(app, /lookupCERPostcodeZone\(postcode/);
const selectorStart = app.indexOf("const BC_AUS_SWH_REFERENCE_LOCATIONS");
const selectorEnd = app.indexOf("function calculateLocalTMains",selectorStart);
assert.ok(selectorStart >= 0 && selectorEnd > selectorStart,"nearest-reference selector source missing");
const selectorContext = {};
vm.createContext(selectorContext);
vm.runInContext(app.slice(selectorStart,selectorEnd)+"\nthis.closest=findClosestBcAusSwhReference;",selectorContext);
assert.equal(selectorContext.closest(-23.379,150.510).zoneKey,"zone1");
assert.equal(selectorContext.closest(-23.698,133.881).zoneKey,"zone2");
assert.equal(selectorContext.closest(-33.869,151.209).zoneKey,"zone3");
assert.equal(selectorContext.closest(-37.814,144.963).zoneKey,"zone4");
assert.notEqual(selectorContext.closest(-35.281,149.130).zoneKey,"zone5","ASHP-only zone5 must never be selected");

const regen = spawnSync("python", ["tools/fit_bc_aus_by_zone.py", "--check"], {cwd:root, encoding:"utf8"});
assert.equal(regen.status, 0, regen.stderr || regen.stdout);
console.log("Mains reference identity, nearest-location runtime, postcode registry, and cross-platform generator-equivalence tests passed.");

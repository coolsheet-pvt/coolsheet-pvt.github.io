// Industry demand-model tests (groups B, C, E).
// Extracts the REAL functions/constants from app.js (no copy-paste) and checks
// that each model reproduces its stated Australian benchmark and the documented
// Q = m c_p dT thermal formula. Run: node validation/test_industry.mjs
import fs from "node:fs";

const SRC = fs.readFileSync("app.js", "utf8");

// --- robust extractor: pull a named `function` or top-level `const` from source ---
function extract(name, kind){
  const re = kind === "func"
    ? new RegExp(`function\\s+${name}\\s*\\(`)
    : new RegExp(`const\\s+${name}\\s*=`);
  const m = re.exec(SRC);
  if (!m) throw new Error(`not found: ${name}`);
  let i = m.index;
  if (kind === "func"){
    // brace-match the body
    let bi = SRC.indexOf("{", i), depth = 0, j = bi;
    for (; j < SRC.length; j++){ const c = SRC[j]; if (c==="{")depth++; else if (c==="}"){depth--; if(depth===0){j++;break;}} }
    return SRC.slice(i, j);
  }
  // const: scan to the `;` at bracket-depth 0 (handles multi-line arrays/objects)
  let depth = 0, inStr = null, j = i;
  for (; j < SRC.length; j++){
    const c = SRC[j];
    if (inStr){ if (c === inStr && SRC[j-1] !== "\\") inStr = null; continue; }
    if (c === '"' || c === "'" || c === "`") inStr = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0){ j++; break; }
  }
  return SRC.slice(i, j);
}

const SYMBOLS = [
  ["isFiniteNumber","func"],["clamp","func"],["monthFromDayN","func"],["isMonToFriDay","func"],
  ["_normW","func"],["normalizeSeasonalFactors","func"],
  ["MONTH_DAYS","const"],
  ["DAIRY_SEASONAL","const"],["DAIRY_PROCESS_PARAMS","const"],["DAIRY_ELEC_PARAMS","const"],
  ["BREWERY_SEASONAL","const"],["BREWERY_PROCESS_PARAMS","const"],["BREWERY_ELEC_PARAMS","const"],
  ["AQUATIC_PROCESS_PARAMS","const"],["AQUATIC_DEFAULT_HOURS","const"],["AQUATIC_WEEKDAY_HOURS","const"],
  ["AQUATIC_COVER_REDUCTION","const"],["AQUATIC_ELEC_KWH_PER_M2_PER_YEAR","const"],
  ["EVAP_LATENT_KWH_PER_KG","const"],["WATER_CP_KWH_PER_KG_C","const"],
  ["HOTEL_PROCESS_PARAMS","const"],["HOTEL_ELECTRICAL_KWH_PER_UNIT","const"],
  ["getAnnualAmbientAverage","func"],["getAquaticSchedule","func"],["saturationVaporPressureKPa","func"],
  ["getAquaticRelativeHumidity","func"],
  ["calcDairyHourlyDemand","func"],["calcBreweryHourlyDemand","func"],["calcAquaticHourlyDemand","func"],
];
const code = SYMBOLS.map(([n,k]) => extract(n,k)).join("\n");
const mod = new Function(code + "\nreturn {calcDairyHourlyDemand,calcBreweryHourlyDemand,calcAquaticHourlyDemand,DAIRY_PROCESS_PARAMS,BREWERY_PROCESS_PARAMS,DAIRY_ELEC_PARAMS,BREWERY_ELEC_PARAMS,HOTEL_PROCESS_PARAMS,HOTEL_ELECTRICAL_KWH_PER_UNIT,normalizeSeasonalFactors,DAIRY_SEASONAL,MONTH_DAYS};")();

// --- synthetic full-year weather + constant mains so thermal totals are predictable ---
const MAINS_C = 18;
const met = [];
for (let d=1; d<=365; d++) for (let h=0; h<24; h++) met.push({dayN:d, hourN:h});
const mains = { annualAvgC: MAINS_C, byDay: Object.fromEntries(Array.from({length:365},(_,i)=>[i+1,MAINS_C])) };
const sum = a => a.reduce((x,y)=>x+y,0);

let pass=0, fail=0;
const ok=(n,c,d="")=>{ c?pass++:fail++; console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  "+d}`); };
const near=(n,g,e,tolPct)=>ok(n, Math.abs(g-e)<=Math.abs(e)*tolPct/100, `got ${g.toFixed(0)} exp ${e.toFixed(0)} (>${tolPct}%)`);

console.log("\n# DAIRY  (throughput 5,000,000 L milk; mains "+MAINS_C+"C)");
{
  const T=5_000_000;
  const keys=["fatty_film_rinse","cip_preheating","boiler_preheat"];
  const r=mod.calcDairyHourlyDemand(T,"continuous",keys,met,mains);
  const elec=sum(r.electricHourly), th=sum(r.thermalHourly);
  near("Electrical = 51.7 kWh/kL benchmark", elec, 51.7*(T/1000), 0.5);
  const kW=keys.reduce((a,k)=>a+mod.DAIRY_PROCESS_PARAMS[k].kWater,0); // 1.37
  const expTh=T*kW*4.184*(35-MAINS_C)/3600;
  near("Thermal = V*cp*dT  (1.37 L/L milk -> 35C)", th, expTh, 1);
  ok("Total heated water = 1.37 L/L", Math.abs(kW-1.37)<1e-9, `kW=${kW}`);
}

console.log("\n# BREWERY  (throughput 500,000 L beer; mains "+MAINS_C+"C)");
{
  const T=500_000;
  const keys=["cip_prerinse","bottle_keg_rinse","boiler_preheat"];
  const r=mod.calcBreweryHourlyDemand(T,"continuous",keys,met,mains);
  const elec=sum(r.electricHourly), th=sum(r.thermalHourly);
  near("Electrical = 11.50 kWh/hL benchmark", elec, 0.115*T, 0.5);
  const P=mod.BREWERY_PROCESS_PARAMS;
  let expTh=0; for(const k of keys) expTh += T*P[k].kWater*4.184*(P[k].T_target-MAINS_C)/3600;
  near("Thermal = sum V*cp*dT  (per-process targets 40-45C)", th, expTh, 1);
  const kW=keys.reduce((a,k)=>a+P[k].kWater,0);
  ok("Total warm water = 1.85 L/L beer", Math.abs(kW-1.85)<1e-9, `kW=${kW}`);
}

console.log("\n# AQUATIC  (indoor pool 500 m2; physics heat-loss model)");
{
  // synthetic year: seasonal + diurnal ambient temperature, light wind
  const amet = [];
  for (let d=1; d<=365; d++) for (let h=0; h<24; h++){
    const ta = 20 + 6*Math.cos(2*Math.PI*(d-15)/365) + 3*Math.sin(2*Math.PI*(h-6)/24);
    amet.push({ dayN:d, hourN:h, ta, vwind:2 });
  }
  const r = mod.calcAquaticHourlyDemand({
    met:amet, activeProcesses:["indoor_pool"], profileType:"continuous",
    processAreas:{indoor_pool:500}, coverEnabled:false, mainsTempC:18
  });
  const b = r.processBreakdownAnnuals.indoor_pool;
  const total = sum(r.thermalHourly);
  const perM2 = total/500;
  ok("Model runs, finite positive demand", Number.isFinite(total) && total>0, `total=${total}`);
  ok("Evaporation is the dominant loss (~ASHRAE 56%)", b.evaporation>b.makeup && b.evaporation>b.sensible,
     `evap=${b.evaporation.toFixed(0)} makeup=${b.makeup.toFixed(0)} sens=${b.sensible.toFixed(0)}`);
  ok("Annual pool-heat per m2 in sane band 300-6000 kWh/m2", perM2>300 && perM2<6000, `perM2=${perM2.toFixed(0)}`);
  console.log(`        (info) indoor pool heating = ${perM2.toFixed(0)} kWh/m2 surface; split evap ${(b.evaporation/total*100).toFixed(0)}% / makeup ${(b.makeup/total*100).toFixed(0)}% / sensible ${(b.sensible/total*100).toFixed(0)}%`);
}

console.log("\n# HOTEL  (60,000 occupied room-nights; energy per room-night)");
{
  const RN = 60_000;
  const H = mod.HOTEL_PROCESS_PARAMS;
  const dhw = H.domestic_hot_water.kWhPerUnit;
  ok("DHW tuned to Australian benchmark (3-5 kWh/room-night)", dhw>=3 && dhw<=5, `dhw=${dhw}`);
  ok("DHW = 4.5 kWh/room-night", Math.abs(dhw-4.5)<1e-9, `dhw=${dhw}`);
  near("Annual DHW thermal = room-nights x kWh/unit", RN*dhw, 60000*4.5, 0.01);
  near("Annual electrical = 15 kWh/room-night", RN*mod.HOTEL_ELECTRICAL_KWH_PER_UNIT, 60000*15, 0.01);
  const totalTh = (dhw+H.kitchen_dishwashing.kWhPerUnit+H.laundry.kWhPerUnit)*RN;
  console.log(`        (info) thermal (DHW+kitchen+laundry) = ${totalTh.toFixed(0)} kWh/yr; was ${((5.5+1.6+1.2)*RN).toFixed(0)} before DHW tune`);
}

console.log("\n# SEASONAL NORMALISATION (annual total preserved)");
{
  const s=mod.normalizeSeasonalFactors(mod.DAIRY_SEASONAL);
  const daySum=s.reduce((a,v,i)=>a+v*mod.MONTH_DAYS[i],0);
  near("Day-weighted seasonal sum = 365", daySum, 365, 0.01);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail===0?0:1);

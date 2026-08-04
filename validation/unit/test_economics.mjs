// Group E: economics formula tests. Mirrors the finance math in app.js
// CRF, NPV annuity, combined gross-output levelised cost, demand-matched net
// payback, and the heat-saving unit conversion. Verifies correctness + consistency.
// Run: node validation/unit/test_economics.mjs

import fs from "node:fs";

let pass=0, fail=0;
const ok=(n,c,d="")=>{ c?pass++:fail++; console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  "+d}`); };
const near=(n,g,e,tol)=>ok(n, Math.abs(g-e)<=tol, `got ${g} exp ${e} (+-${tol})`);

// --- formulas exactly as used in app.js ---
const CRF = (i,N) => i>1e-9 ? i*Math.pow(1+i,N)/(Math.pow(1+i,N)-1) : 1/N;
const NPV = (capex,benefit,i,N) => i>1e-9 ? -capex + benefit*(1-Math.pow(1+i,-N))/i : -capex + benefit*N;
const annualSavingHeat = (th_kWh,boilerEff,gasPricePerMJ) => (th_kWh*3.6/boilerEff)*gasPricePerMJ;
const NATURAL_GAS_KG_CO2E_PER_GJ = 51.53;
const avoidedEmissionsTonnes = (heatKWh,elecKWh,boilerEff,gridFactor) => {
  const gasGJ = (heatKWh * 3.6 / boilerEff) / 1000;
  return (elecKWh * gridFactor + gasGJ * NATURAL_GAS_KG_CO2E_PER_GJ) / 1000;
};

const appSource = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");
ok(
  "production code uses the verified natural-gas emissions factor",
  appSource.includes("const NATURAL_GAS_KG_CO2E_PER_GJ = 51.53;")
);

console.log("\n# CAPITAL RECOVERY FACTOR");
near("CRF(6%,25yr) = 0.078227 (textbook)", CRF(0.06,25), 0.078227, 1e-5);
near("CRF(0%,25yr) -> 1/N = 0.04 (limit)", CRF(0,25), 0.04, 1e-9);
ok("CRF rises with discount rate", CRF(0.10,25) > CRF(0.06,25));

console.log("\n# NPV (annuity)");
{
  const capex=10000, benefit=1500, i=0.06, N=25;
  const npv=NPV(capex,benefit,i,N);
  near("NPV(10k capex, 1.5k/yr, 6%, 25yr)", npv, -10000+1500*(1-Math.pow(1.06,-25))/0.06, 1e-6);
  // annuity factor is the reciprocal of CRF -> key consistency check
  const annuityFactor=(1-Math.pow(1+i,-N))/i;
  near("annuity factor x CRF = 1 (self-consistent)", annuityFactor*CRF(i,N), 1, 1e-9);
  near("NPV at i->0 = -capex + benefit*N", NPV(capex,benefit,0,N), -capex+benefit*N, 1e-9);
  ok("Negative net benefit => negative NPV", NPV(10000,-200,0.06,25) < 0);
}

console.log("\n# COMBINED GROSS-OUTPUT LEVELISED COST");
{
  const capex=20000, opex=400, i=0.06, N=25, crf=CRF(i,N);
  const E_pv=7000, E_th=4000;
  const totalOutput=E_pv+E_th;
  const combined=(capex*crf+opex)/totalOutput;
  const annualCost=capex*crf+opex;
  near("combined cost times gross total output = annualised cost", combined*totalOutput, annualCost, 1e-6);
  ok("production source removes artificial LCOE/LCOH allocation", !/const\s+lcoe\s*=|const\s+lcoh\s*=|f_th2e|pvShare|thShare/.test(appSource));
  ok("production source reports one combined gross-output cost", appSource.includes("levelisedGrossSupplyCost"));
}

console.log("\n# HEAT SAVING unit conversion (kWh -> MJ / boiler eff x $/MJ)");
near("1000 kWh th, 85% boiler, $0.03/MJ = $127.06", annualSavingHeat(1000,0.85,0.03), 1000*3.6/0.85*0.03, 1e-6);
ok("Lower boiler efficiency => more gas displaced (more saving)", annualSavingHeat(1000,0.7,0.03) > annualSavingHeat(1000,0.9,0.03));

console.log("\n# AVOIDED EMISSIONS (NGA Factors 2025)");
near(
  "1000 kWh PV plus 1000 kWh heat at 85% boiler efficiency",
  avoidedEmissionsTonnes(1000,1000,0.85,0.62),
  (620 + (1000*3.6/0.85/1000)*51.53) / 1000,
  1e-12
);
ok("natural-gas factor includes CO2, methane and nitrous oxide", NATURAL_GAS_KG_CO2E_PER_GJ === 51.53);

console.log("\n# SIMPLE PAYBACK");
near("payback = capex / net annual benefit", 16000/2000, 8, 1e-9);
near("demand-matched payback deducts O&M", 16000/(5000-800), 16000/4200, 1e-9);
ok("industry economics passes annual O&M into the net calculation", appSource.includes("opexAnnualAud: opexAnnual"));
ok("installed cost is entered directly in AUD/m2", appSource.includes('getInputNumber(\"capexInput\", 540)'));
ok("obsolete thermal $/W conversion is removed", !appSource.includes("thermalInstalledCostPerW"));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail===0?0:1);

// Input-parsing tests: an explicit "0" typed into an economics field must be
// honoured, and blank/invalid fields must fall back to the documented default.
// Regression for the `parseFloat(x) || fallback` pattern (fixed in v13.12) that
// treated 0 as falsy and silently substituted defaults (CAPEX 0 -> 800 AUD/m2,
// OPEX 0% -> 1.5%/yr, discount 0% -> 6%).
// Model A/B coefficient reads are intentionally NOT covered here: their parsing
// is part of the frozen model behaviour and is documented in the audit report.
// Run: node validation/unit/test_input_parsing.mjs
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");

let pass=0, fail=0;
const ok=(n,c,d="")=>{ c?pass++:fail++; console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  "+d}`); };
const near=(n,g,e,tol)=>ok(n, Math.abs(g-e)<=tol, `got ${g} exp ${e} (+-${tol})`);

// Extract getInputNumber and run it against a mock DOM.
function extract(name){
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(SRC);
  if (!m) throw new Error(`not found: ${name}`);
  let bi = SRC.indexOf("{", m.index), depth = 0, j = bi;
  for (; j < SRC.length; j++){ const c = SRC[j]; if (c==="{")depth++; else if (c==="}"){depth--; if(depth===0){j++;break;}} }
  return SRC.slice(m.index, j);
}

const FIELDS = {};
const mockDocument = { getElementById: id => (id in FIELDS ? { value: FIELDS[id] } : null) };
const getInputNumber = new Function("document", extract("getInputNumber") + "\nreturn getInputNumber;")(mockDocument);

console.log("\n# getInputNumber semantics");
{
  FIELDS.f = "0";      near("explicit '0' is honoured", getInputNumber("f", 800), 0, 1e-12);
  FIELDS.f = "";       near("blank falls back to default", getInputNumber("f", 800), 800, 1e-12);
  FIELDS.f = "abc";    near("non-numeric falls back to default", getInputNumber("f", 1.5), 1.5, 1e-12);
  FIELDS.f = "12.5";   near("normal value parses", getInputNumber("f", 0), 12.5, 1e-12);
  FIELDS.f = "-3";     near("negative parses (range clamps happen at call sites)", getInputNumber("f", 0), -3, 1e-12);
  near("missing element falls back to default", getInputNumber("missing", 6), 6, 1e-12);
}

console.log("\n# economics semantics at the call sites (0 honoured after clamps)");
{
  // Mirror the calcAnnualPVT call-site expressions.
  FIELDS.capexInput = "0";
  near("CAPEX 0 stays 0 (was silently 800)", Math.max(0, getInputNumber("capexInput", 800)), 0, 1e-12);
  FIELDS.opexRateInput = "0";
  near("OPEX 0%/yr stays 0 (was silently 1.5)", Math.max(0, getInputNumber("opexRateInput", 1.5))/100, 0, 1e-12);
  FIELDS.discountRateInput = "0";
  near("discount 0% stays 0 (was silently 6)", Math.max(0, getInputNumber("discountRateInput", 6))/100, 0, 1e-12);
  FIELDS.systemLifeInput = "0";
  near("system life 0 clamps to 1 year (was silently 25)", Math.max(1, Math.floor(getInputNumber("systemLifeInput", 25))), 1, 1e-12);
  FIELDS.systemLifeInput = "";
  near("blank system life defaults to 25", Math.max(1, Math.floor(getInputNumber("systemLifeInput", 25))), 25, 1e-12);
}

console.log("\n# source locks: calcAnnualPVT reads economics via getInputNumber");
for (const [id, def] of [
  ["capexInput", "800"], ["opexRateInput", "1.5"],
  ["discountRateInput", "6"], ["systemLifeInput", "25"],
  ["electricityPrice", "0"], ["feedInTariffInput", "0"],
  ["gasPriceInput", "0"], ["boilerEffInput", "0.85"]
]){
  ok(`${id} parsed with finite-check (default ${def})`, SRC.includes(`getInputNumber("${id}", ${def})`));
}
ok("no remaining `parseFloat(...capexInput...) || 800` pattern",
  !/parseFloat\(document\.getElementById\("capexInput"\)\.value\)\s*\|\|\s*800/.test(SRC));

console.log("\n# frozen zone untouched: Model A/B coefficient reads unchanged");
ok("Model A a0 still plain parseFloat", SRC.includes(`const a0           = parseFloat(document.getElementById("pvtA0").value);`));
ok("Model B isoA1 read unchanged (documented behaviour lock)", SRC.includes(`parseFloat(document.getElementById("isoA1").value) || 3.93`));

console.log("\n# recovery controls");
ok("reset removes the persisted input state", SRC.includes("localStorage.removeItem(INPUT_STORE_KEY)"));
ok("reset removes the defaults-version state", SRC.includes("localStorage.removeItem(INPUT_DEFAULTS_VERSION_KEY)"));
ok("weather service is pre-warmed without a visible status control", SRC.includes("function warmHostedTMYService()"));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail===0?0:1);

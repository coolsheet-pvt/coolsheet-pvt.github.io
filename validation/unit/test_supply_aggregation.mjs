// Supply chart/table aggregation tests (aggregateMonthlyAll / aggregateDailyAll).
// Regression for the Date round-trip bug (fixed in v13.12): building date strings
// with toISOString() and re-parsing them shifted every day by one in any non-UTC
// browser timezone (dropping Jan 1 from the monthly charts entirely) and drifted
// after February when the display year was a leap year. Aggregation is now keyed
// on the TMY dayN/month directly, so these results must be identical in every
// timezone. Run: node validation/unit/test_supply_aggregation.mjs
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");

function extract(name, kind){
  const re = kind === "func"
    ? new RegExp(`function\\s+${name}\\s*\\(`)
    : new RegExp(`const\\s+${name}\\s*=`);
  const m = re.exec(SRC);
  if (!m) throw new Error(`not found: ${name}`);
  let i = m.index;
  if (kind === "func"){
    let bi = SRC.indexOf("{", i), depth = 0, j = bi;
    for (; j < SRC.length; j++){ const c = SRC[j]; if (c==="{")depth++; else if (c==="}"){depth--; if(depth===0){j++;break;}} }
    return SRC.slice(i, j);
  }
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

const code = [
  ["MONTH_DAYS","const"],
  ["monthFromDayN","func"],
  ["monthDayFromDayN","func"],
  ["aggregateMonthlyAll","func"],
  ["aggregateDailyAll","func"]
].map(([n,k]) => extract(n,k)).join("\n");
const mod = new Function(code + "\nreturn {MONTH_DAYS, monthFromDayN, monthDayFromDayN, aggregateMonthlyAll, aggregateDailyAll};")();

let pass=0, fail=0;
const ok=(n,c,d="")=>{ c?pass++:fail++; console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  "+d}`); };
const near=(n,g,e,tol)=>ok(n, Math.abs(g-e)<=tol, `got ${g} exp ${e} (+-${tol})`);

const YEAR = 2025;

// Build a synthetic full-year series exactly like calcAnnualPVT does:
// 24 rows/day, every row 1 kWh PV / 2 kWh thermal, dayN 1..365.
function buildSeries(){
  const series = [];
  for (let dayN = 1; dayN <= 365; dayN++){
    const { month, day } = mod.monthDayFromDayN(dayN);
    for (let h = 0; h < 24; h++){
      series.push({
        date: `${YEAR}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
        month, dayOfMonth: day, dayN, hourN: h,
        pv_kWh: 1, pvOnly_kWh: 0.5, th_kWh: 2,
        Tout_C: 30, Tin_C: 15, pvPanel_C: 40, pvtPanel_C: 35,
        daytimeTempSample: h === 12
      });
    }
  }
  return series;
}

console.log("\n# monthDayFromDayN (365-day TMY calendar)");
{
  const cases = [
    [1,   1,  1], [31,  1, 31], [32,  2,  1], [59,  2, 28],
    [60,  3,  1], [365, 12, 31], [182, 7, 1]
  ];
  for (const [dayN, m, d] of cases){
    const got = mod.monthDayFromDayN(dayN);
    ok(`dayN ${dayN} -> ${m}/${d}`, got.month === m && got.day === d, `got ${got.month}/${got.day}`);
  }
  ok("round-trips monthFromDayN for all 365 days",
    Array.from({length:365},(_,i)=>i+1).every(dn => mod.monthDayFromDayN(dn).month === mod.monthFromDayN(dn)));
}

console.log("\n# aggregateMonthlyAll (timezone-independent bucketing)");
{
  const months = mod.aggregateMonthlyAll(buildSeries(), YEAR);
  near("January PV = 31 days x 24 h x 1 kWh = 744", months[0].pv_kWh, 31*24, 1e-9);
  near("February PV = 28 x 24 = 672 (no leap slot)", months[1].pv_kWh, 28*24, 1e-9);
  near("December thermal = 31 x 24 x 2 = 1488", months[11].th_kWh, 31*24*2, 1e-9);
  const annualPv = months.reduce((s,m)=>s+m.pv_kWh,0);
  near("sum of monthly PV = 8760 (Jan 1 no longer dropped)", annualPv, 8760, 1e-9);
  const annualTh = months.reduce((s,m)=>s+m.th_kWh,0);
  near("sum of monthly thermal = 17520", annualTh, 2*8760, 1e-9);
  ok("every month has correct day count x24 PV",
    months.every((m,i)=>Math.abs(m.pv_kWh - mod.MONTH_DAYS[i]*24) < 1e-9));
  near("daytime Tout average = 30 (one sample/day)", months[0].Tout_C_avg, 30, 1e-9);
}

console.log("\n# aggregateDailyAll (fixed TMY calendar, no phantom Feb 29)");
{
  const series = buildSeries();
  const feb = mod.aggregateDailyAll(series, YEAR, 2);
  ok("February always returns 28 day slots", feb.length === 28, `got ${feb.length}`);
  near("Feb 1 gets dayN 32's energy (24 kWh)", feb[0].pv_kWh, 24, 1e-9);
  ok("Feb 1 label matches its data", feb[0].date === `${YEAR}-02-01`, feb[0].date);
  const jan = mod.aggregateDailyAll(series, YEAR, 1);
  ok("January returns 31 day slots", jan.length === 31, `got ${jan.length}`);
  near("Jan 1 energy present (regression: was dropped in UTC+ timezones)", jan[0].pv_kWh, 24, 1e-9);
  near("Dec 31 energy present", mod.aggregateDailyAll(series, YEAR, 12)[30].pv_kWh, 24, 1e-9);
}

console.log("\n# legacy rows without month/dayOfMonth fall back to dayN");
{
  const legacy = [
    { dayN: 1,  pv_kWh: 5, th_kWh: 0 },
    { dayN: 32, pv_kWh: 7, th_kWh: 0 }
  ];
  const months = mod.aggregateMonthlyAll(legacy, YEAR);
  near("dayN 1 lands in January", months[0].pv_kWh, 5, 1e-9);
  near("dayN 32 lands in February (not January)", months[1].pv_kWh, 7, 1e-9);
  const days = mod.aggregateDailyAll(legacy, YEAR, 2);
  near("dayN 32 lands on Feb 1 in the daily view", days[0].pv_kWh, 7, 1e-9);
}

console.log("\n# source lock: no Date round-trip in chart aggregation");
ok("timeSeries no longer built with toISOString()", !/toISOString\(\)\.slice\(0,10\)/.test(SRC));
ok("aggregateDailyAll no longer sizes months from the display year",
  !SRC.includes("new Date(year, month, 0).getDate()"));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail===0?0:1);

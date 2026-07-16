// Static contract checks for export/report/share state handling.
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
function ok(name, cond, detail=""){
  if (cond){ pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  " + detail : ""}`); }
}

function bodyOf(name){
  const start = SRC.indexOf(`function ${name}`);
  if (start < 0) return "";
  const brace = SRC.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < SRC.length; i++){
    if (SRC[i] === "{") depth++;
    if (SRC[i] === "}"){
      depth--;
      if (depth === 0) return SRC.slice(brace, i + 1);
    }
  }
  return "";
}

console.log("\n# EXPORT / SHARE STATE CONTRACTS");
ok("successful calculation populates CURRENT_CALC_RESULT", SRC.includes("CURRENT_CALC_RESULT = {"));
ok("annual report metrics prefer calculation state", bodyOf("collectAnnualReportMetrics").includes("CURRENT_CALC_RESULT?.annualMetrics"));
ok("industry report summary prefers calculation state", bodyOf("collectIndustryReportSummary").includes("CURRENT_CALC_RESULT?.industrySummary"));
ok("summary CSV has state-first branch", bodyOf("buildSummaryCsv").includes("const result = CURRENT_CALC_RESULT"));
ok("share links use versioned payload", bodyOf("buildShareScenarioPayload").includes("schemaVersion: 2"));
ok("share links include reproducibility note", bodyOf("buildShareScenarioPayload").includes("reproducibilityNote"));
ok("shared-link loader keeps v1 flat input compatibility", bodyOf("applySharedScenarioFromUrl").includes("applyInputState(payload);"));
ok("successful results reveal the share action", SRC.includes('shareBtn.style.display = "inline-block"'));
ok("redundant per-result PV check action is removed", !SRC.includes("btnCheckPvScenario"));
ok("report header keeps Save PDF beside Send report", SRC.includes('class="handoff-buttons"'));
ok("report email sends the generated report HTML", SRC.includes("report_html: getReportExportHtml()"));
ok("result actions stay hidden until calculation succeeds", SRC.includes("resultActions.hidden = true") && SRC.includes("resultActions.hidden = false"));
ok("successful calculation scrolls to results", SRC.includes("scrollToCalculationResults();"));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);

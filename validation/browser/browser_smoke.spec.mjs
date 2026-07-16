import { test, expect } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const pageUrl = pathToFileURL(path.resolve("index.html")).href;
const modernPageUrl = `${pageUrl}?ui=modern`;
const soacValidationUrl = pathToFileURL(path.resolve("pages/soac-field-validation.html")).href;
const pvValidationUrl = pathToFileURL(path.resolve("pages/pv-external-validation.html")).href;
const validationHubUrl = pathToFileURL(path.resolve("pages/validation-hub.html")).href;

test("calculator UI loads without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(pageUrl);
  await expect(page.locator("#btnAnnual")).toBeVisible();
  await expect(page.locator("#btnAnnual")).toHaveText("Calculate results");
  await expect(page.locator("#industrySelect")).toBeVisible();
  await expect(page.locator("#downloadLink")).toBeHidden();
  await expect(page.locator("#btnGeneratePdf")).toBeHidden();
  await expect(page.locator("#btnShareLink")).toBeHidden();
  await expect(page.locator("#btnCheckPvScenario")).toBeHidden();
  await expect(page.locator("#btnResetInputs")).toBeVisible();
  await expect(page.locator("#resultActions")).toBeHidden();
  await expect(page.locator(".calculator-actions #btnAnnual")).toHaveCount(1);
  await expect(page.locator(".calculator-actions #btnResetInputs")).toHaveCount(1);
  await expect(page.locator(".calculator-actions #downloadLink, .calculator-actions #btnGeneratePdf, .calculator-actions #btnShareLink, .calculator-actions #btnCheckPvScenario")).toHaveCount(0);
  await expect(page.locator("#resultActions #downloadLink, #resultActions #btnGeneratePdf, #resultActions #btnShareLink, #resultActions #btnCheckPvScenario")).toHaveCount(4);
  const actionAlignment = await page.evaluate(() => {
    const calculate = document.getElementById("btnAnnual").getBoundingClientRect();
    const reset = document.getElementById("btnResetInputs").getBoundingClientRect();
    return { topDifference:Math.abs(calculate.top-reset.top), heightDifference:Math.abs(calculate.height-reset.height) };
  });
  expect(actionAlignment.topDifference).toBeLessThan(1);
  expect(actionAlignment.heightDifference).toBeLessThan(1);
  await expect(page.locator("#output")).toBeHidden();
  await page.evaluate(() => setOutput("<div class=\"output-card output-card-annual\">Test result</div>"));
  await expect(page.locator("#output")).toBeVisible();
  await page.evaluate(() => setOutput(""));
  await expect(page.locator("#output")).toBeHidden();
  await expect(page.locator("#weatherServiceIndicator")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Validation centre" })).toBeVisible();
  await expect(page.getByText("Try modern UI", { exact:false })).toHaveCount(0);
  await expect(page.locator('script[src*="ui-modern"]')).toHaveCount(0);
  const optionalSystemSettings = page.locator("details.advanced-settings").filter({ has:page.locator("#tiltAngle") });
  await expect(optionalSystemSettings.locator(":scope > summary")).toHaveText("Optional system settings");
  await optionalSystemSettings.locator(":scope > summary").click();
  await expect(optionalSystemSettings.locator("details.setting-group")).toHaveCount(3);
  await expect(optionalSystemSettings.locator("details.setting-group[open]")).toHaveCount(0);
  await expect(page.locator("#mainsMonthGrid")).toBeHidden();
  const thermalGroup = optionalSystemSettings.locator("details.setting-group").filter({ has:page.locator("#modelA") });
  await thermalGroup.locator(":scope > summary").click();
  await expect(page.locator("#modelA")).toBeVisible();
  await expect(page.locator("#modelB")).toBeVisible();
  await expect(thermalGroup.locator(".thermal-model-card")).toHaveCSS("border-top-style", "none");
  await expect(thermalGroup.locator(".thermal-model-option").first()).toHaveCSS("border-top-style", "none");
  const economicsSettings = page.locator("details.economics-settings");
  await expect(economicsSettings.locator(":scope > summary")).toHaveText("Costs and savings assumptions");
  await economicsSettings.locator(":scope > summary").click();
  await expect(economicsSettings.locator(".economics-section-title")).toHaveCount(3);
  await expect(economicsSettings.locator(".setting-chip").first()).toBeHidden();
  await expect(page.locator("#autoCapexFromWatts")).toBeVisible();
  await expect(page.locator("#autoCapexFromWatts")).toBeChecked();
  await expect(page.locator("#pvInstalledCostPerW")).toBeHidden();
  await economicsSettings.locator(".cost-conversion-details > summary").click();
  await expect(page.locator("#pvInstalledCostPerW")).toBeVisible();
  await expect(page.getByText(/loading weather sends the address to OpenStreetMap/i)).toHaveCount(0);
  await page.locator("#area").fill("321");
  await page.locator("#area").dispatchEvent("change");
  page.once("dialog", dialog => dialog.accept());
  await Promise.all([
    page.waitForNavigation(),
    page.locator("#btnResetInputs").click()
  ]);
  await expect(page.locator("#area")).toHaveValue("250");
  expect(errors).toEqual([]);
});

test("how-it-works diagram animates and opens step details", async ({ page }) => {
  await page.goto(pageUrl);
  await page.locator("#btnHowItWorks").click();
  const overviewModal = page.locator("#mainsChartModal");
  await expect(overviewModal).toBeVisible();
  await expect(overviewModal).toHaveClass(/motion-enter/);
  await expect(overviewModal).toHaveClass(/how-it-works-open/);

  const weatherStep = overviewModal.locator('rect[data-step="weather"]');
  await expect(weatherStep).toHaveAttribute("role", "button");
  await expect(weatherStep).toHaveAttribute("tabindex", "0");
  await weatherStep.click();

  const detailModal = page.locator("#howItWorksStepModal");
  await expect(detailModal).toBeVisible();
  await expect(detailModal).toHaveClass(/how-step-open/);
  await expect(page.locator("#howItWorksStepTitle")).not.toBeEmpty();
  await expect(page.locator("#howItWorksStepBody")).not.toBeEmpty();
  await page.locator("#btnCloseHowItWorksStep").click();
  await expect(detailModal).toBeHidden();
  await page.locator("#btnCloseMainsChart").click();
  await expect(overviewModal).toBeHidden();
});

test("SOAC field-validation page is linked, interactive, and works offline", async ({ page }) => {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(validationHubUrl);
  const validationLink = page.locator('a[href="soac-field-validation.html"]').first();
  await expect(validationLink).toBeVisible();

  await page.goto(soacValidationUrl);
  await expect(page.locator("h1")).toContainText("What happened at SOAC");
  await expect(page.locator("#headlineMatchedError")).toHaveText("−6.2%");
  await expect(page.locator("#dataStatus")).toHaveAttribute("data-status", "fallback");
  await expect(page.locator("canvas")).toHaveCount(5);

  await page.locator("#fieldFactor").evaluate(input => {
    input.value = "0.70";
    input.dispatchEvent(new Event("input", { bubbles:true }));
  });
  await expect(page.locator("#fieldFactorValue")).toHaveText("0.70");
  await expect(page.locator("#adjustedModelB")).toHaveText("6,646 kWh");

  await page.setViewportSize({width:390,height:844});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("PV external-validation page presents clear external comparisons", async ({ page }) => {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(validationHubUrl);
  await expect(page.locator("h1")).toContainText("What has been validated");
  await expect(page.getByText("Strong benchmark agreement", { exact:true })).toBeVisible();
  await expect(page.getByText("Preliminary field evidence", { exact:true })).toBeVisible();
  const validationLink = page.locator('a[href="pv-external-validation.html"]').first();
  await expect(validationLink).toBeVisible();

  await page.goto(pvValidationUrl);
  await expect(page.locator("h1")).toContainText("Is the CoolSheet PV result reasonable?");
  await expect(page.getByText("2.22%", { exact:true })).toHaveCount(1);
  await expect(page.locator("canvas:visible")).toHaveCount(1);
  await expect(page.locator(".steps:visible li")).toHaveCount(3);
  await expect(page.locator("#coolSheetValue")).toHaveText("5,656.9 kWh");
  await expect(page.locator("#stationNote")).toContainText("6.9 km");
  await page.selectOption("#citySelect", "Perth");
  await expect(page.locator("#stationNote")).toContainText("14.1 km");
  await expect(page.locator("#coolSheetValue")).toHaveText("6,466.0 kWh");
  await expect(page.locator("#plainResult")).toContainText("largest difference is 1.87%");
  await expect(page.locator("#pvgisResultLink")).toHaveAttribute("href", /lat=-31\.9505/);
  await expect(page.getByRole("heading", { name: "Australian units" })).toHaveCount(0);

  await page.setViewportSize({width:390,height:844});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("current CoolSheet PV scenario transfers into the external check", async ({ page }) => {
  await page.route("https://developer.nlr.gov/api/pvwatts/v8.json?*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ outputs:{ ac_annual:5850.5 }, errors:[], warnings:[] })
  }));
  const query = new URLSearchParams({
    mode:"scenario",name:"Test site",lat:"-33.869800",lon:"151.208300",area:"20",efficiency:"0.20",
    capacity:"4",tilt:"30",azimuth:"0",albedo:"0.2",systemLoss:"14",inverterEfficiency:"96",coolsheetAc:"5656.9"
  });
  await page.goto(`${pvValidationUrl}?${query.toString()}`);
  await expect(page.locator("h1")).toHaveText("Check this CoolSheet PV result");
  await expect(page.locator("#scenarioValidation")).toBeVisible();
  await expect(page.locator("#scenarioCoolSheetValue")).toHaveText("5,656.9 kWh");
  await expect(page.locator("#scenarioPvwattsInput")).toHaveValue("5850.5");
  await expect(page.locator("#scenarioPlainResult")).toContainText("Close agreement");
  await expect(page.locator("#scenarioPvgisLink")).toHaveAttribute("href", /peakpower=4\.000/);
  await page.locator("#scenarioPvgisInput").fill("5913.2");
  await expect(page.locator("#scenarioPvgisDifference")).toContainText("4.53% higher");
  await expect(page.locator("#scenarioPlainResult")).toContainText("both external results");
});

test("commercial laundry controls are exposed", async ({ page }) => {
  await page.goto(pageUrl);
  await page.selectOption("#industrySelect", "commercial_laundry");
  await expect(page.locator("#laundryInputsPanel")).toBeVisible();
  await expect(page.locator("#throughputInput")).toBeHidden();
  await expect(page.locator("#laundryKgPerDay")).toHaveValue("1500");
  await expect(page.locator("#laundryWaterUseLPerKg")).toHaveValue("10");
});

test("alternative monthly balance graph coexists with every legacy industry graph", async ({ page }) => {
  await page.goto(modernPageUrl);
  await page.evaluate(() => {
    const supply = [9000,8000,7000,6000,5000,4500,5000,6000,7000,8000,9000,10000];
    const demand = [11000,10500,10000,9500,9000,8500,8500,9000,9500,10000,10500,11000];
    const matched = supply.map((value,index) => Math.min(value,demand[index]));
    const unmet = demand.map((value,index) => Math.max(0,value-supply[index]));
    const excess = supply.map((value,index) => Math.max(0,value-demand[index]));
    const balance = {matchedMonthly:matched, unmetMonthly:unmet, excessMonthly:excess};
    const host = document.getElementById("industryOutput");
    host.style.display = "block";
    host.innerHTML = `<div class="industry-chart-group">${buildIndustryChartSet({
      thermalDatasets:[{label:"Process heat",color:"#d97706",monthly:demand}],
      pvtMonthly:supply,
      thermMonthly:demand,
      pvMonthly:supply,
      elecMonthly:demand,
      thermalBalance:balance,
      electricalBalance:balance,
      thermalTitle:"Legacy monthly heat demand",
      elecTitle:"Legacy monthly electricity demand",
      sharedScale:true
    })}</div>`;
  });

  await expect(page.locator(".industry-balance-preview")).toHaveCount(1);
  await expect(page.locator(".industry-balance-preview-head h4")).toHaveText("Alternative view - Monthly energy balance");
  await expect(page.locator(".balance-preview-panel")).toHaveCount(2);
  await expect(page.locator(".balance-preview-data")).toHaveCount(2);
  await expect(page.locator(".industry-chart-section")).toHaveCount(2);
  await expect(page.locator(".industry-chart-section svg")).toHaveCount(5);
  await expect(page.locator(".balance-preview-compare-note")).toContainText("original graphs are unchanged below");

  await page.setViewportSize({width:390,height:844});
  const mobile = await page.evaluate(() => {
    const preview = document.querySelector(".industry-balance-preview");
    const panels = [...document.querySelectorAll(".balance-preview-panel")].map(el => el.getBoundingClientRect());
    const labels = [...document.querySelectorAll(".balance-preview-panel:first-of-type .balance-preview-month-row span")];
    return {
      noPreviewOverflow: preview.scrollWidth <= preview.clientWidth + 1,
      panelsStacked: panels.length === 2 && panels[1].top > panels[0].bottom,
      labelVisibility: labels.map(el => getComputedStyle(el).visibility),
      visibleLabelX: labels.filter(el => getComputedStyle(el).visibility === "visible").map(el => el.getBoundingClientRect().left)
    };
  });
  expect(mobile.noPreviewOverflow).toBe(true);
  expect(mobile.panelsStacked).toBe(true);
  expect(mobile.labelVisibility.map((value,index) => value === "visible" ? index : -1).filter(index => index >= 0)).toEqual([0,3,6,9]);
  expect(mobile.visibleLabelX).toEqual([...mobile.visibleLabelX].sort((a,b) => a-b));
});

test.skip("retired modern UI presentation layer", async ({ page }) => {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(modernPageUrl);
  await expect(page.locator(".modern-stepnav")).toHaveCount(0);
  await expect(page.locator(".modern-banner")).toHaveCount(0);
  await expect(page.locator(".header-actions .ui-classic-switch")).toHaveText("Switch to classic");
  expect(await page.locator(".header-actions .ui-classic-switch").getAttribute("href")).not.toContain("ui=modern");
  const headerAlignment = await page.evaluate(() => {
    const action = document.getElementById("btnHowItWorks")?.getBoundingClientRect();
    const testing = document.querySelector(".brand-meta label")?.getBoundingClientRect();
    return {
      metaInActions: document.querySelector(".brand-meta")?.parentElement?.classList.contains("header-actions"),
      centreDelta: action && testing ? Math.abs((action.top + action.height / 2) - (testing.top + testing.height / 2)) : 999
    };
  });
  expect(headerAlignment.metaInActions).toBe(true);
  expect(headerAlignment.centreDelta).toBeLessThan(2);
  await expect(page.locator("label .prov-input")).toHaveCount(0);
  await expect(page.locator(".prov-legend .prov-input")).toHaveText("your input");
  await expect(page.locator(".modern-advanced-proposal, .modern-advanced-section")).toHaveCount(0);
  const supplyAdvanced = page.locator("details.advanced-settings").filter({ has:page.locator("#tiltAngle") });
  await expect(supplyAdvanced.locator(":scope > summary")).toHaveText("Advanced Settings");
  await expect(page.locator("#tiltAngle")).toHaveValue("30");
  await expect(page.locator("#modelA")).toBeChecked();
  await expect(page.locator("details.modern-assumptions")).toHaveCount(1);
  await expect(page.locator("details.modern-assumptions")).not.toHaveAttribute("open", "");
  await expect(page.locator("details.modern-evidence-details")).toHaveCount(1);
  await page.selectOption("#industrySelect", "hotel");
  await expect(page.locator("#hotelInputsPanel details.modern-demand-details")).toHaveCount(1);
  await expect(page.locator("#hotelRoomsInput")).toBeVisible();
  await expect(page.locator("#hotelDhwKWh")).toBeHidden();
  await page.evaluate(() => {
    const metric = (label, value) => `<div class="annual-summary-item"><span>${label}</span><strong>${value}</strong><small>test value</small></div>`;
    const flowMetric = (label, value) => `<div class="energy-flow-card"><span>${label}</span><strong>${value}</strong><small>test value</small></div>`;
    document.getElementById("annualOutput").innerHTML = `
      <div class="output-card output-card-annual">
        <div class="annual-kicker">Hourly annual summary</div><h3>Annual PVT Results</h3>
        <div class="annual-summary-grid">
          ${metric("PVT electricity", "100,000 kWh")}
          ${metric("PVT thermal", "400,000 kWh")}
          ${metric("PV-only baseline", "100,000 kWh")}
          ${metric("Electricity from cooling", "+0 kWh")}
          ${metric("Total output", "500,000 kWh")}
          ${metric("Avg daytime outlet temp", "32 °C")}
          ${metric("PVT supply value", "$50 /yr")}
        </div>
      </div>`;
    const flowGroup = kind => `
      <section class="energy-flow-group ${kind}">
        <div class="energy-flow-heading"><span>${kind} energy</span></div>
        <div class="energy-flow-cards">
          ${flowMetric("Demand", "1,000 kWh/yr")}
          ${flowMetric("Solar used", "600 kWh/yr")}
          ${flowMetric("Backup/grid", "400 kWh/yr")}
          ${flowMetric("Export/excess", "50 kWh/yr")}
        </div>
      </section>`;
    const industry = document.getElementById("industryOutput");
    industry.style.display = "block";
    industry.innerHTML = `
      <div class="output-card output-card-industry">
        <div class="insight-hero">
          <div class="insight-kicker">Solar Performance Summary</div>
          <div class="insight-title">You save $20,000 AUD/yr with 60.0% direct-use heat coverage</div>
          <div class="insight-sub">Based on 250 m² PVT collector area at Test Site</div>
          <div class="insight-strip">
            <div class="insight-pill"><div class="eyebrow">Solar Electricity</div><div class="big">20.0%</div></div>
            <div class="insight-pill"><div class="eyebrow">Direct-use heat coverage</div><div class="big">60.0%</div></div>
            <div class="insight-pill"><div class="eyebrow">Yearly Savings</div><div class="big">$20,000 /yr</div></div>
            <div class="insight-pill"><div class="big">50 kWh</div></div>
          </div>
        </div>
        <div class="recommended-size-box">Sizing guide</div>
        <div class="dairy-result-area"><div class="energy-flow-summary">${flowGroup("electrical")}${flowGroup("thermal")}</div></div>
      </div>`;
    document.getElementById("supplyChartsPanel").style.display = "block";
    document.dispatchEvent(new CustomEvent("pvt:results-rendered"));
  });

  await expect(page.locator("body")).toHaveClass(/modern-results-ready/);
  await expect(page.locator("#modernResults h2")).toHaveText("How the system serves this site");
  await expect(page.locator("#annualOutput .annual-summary-item.modern-secondary-result")).toHaveCount(4);
  await expect(page.locator("#industryOutput .insight-pill.modern-secondary-result")).toHaveCount(1);
  await expect(page.locator("#industryOutput .modern-coverage-track")).toHaveCount(2);
  await expect(page.locator("#industryOutput .modern-decision-note")).toContainText("60.0% of modelled heat demand");
  await expect(page.locator("#industryOutput .energy-flow-group .modern-flow-context-card")).toHaveCount(4);
  await expect(page.locator("#annualOutput .annual-summary-item").filter({ hasText:"PVT electricity" }).locator("strong")).toHaveText("100.0 MWh");
  await expect(page.locator("#industryOutput .modern-flow-total strong")).toHaveText(["1.0 MWh/yr", "1.0 MWh/yr"]);
  await expect(page.locator("#showMonthlySupply")).toBeChecked();
  await expect(page.locator("#monthlyDataTable").locator(".." )).toHaveClass(/modern-data-details/);
  const industryComesFirst = await page.evaluate(() => {
    const industry = document.getElementById("industryOutput");
    const output = document.getElementById("output");
    return !!(industry.compareDocumentPosition(output) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(industryComesFirst).toBe(true);
  expect(errors).toEqual([]);
});

test("summary exports and share payload prefer calculation state", async ({ page }) => {
  await page.goto(pageUrl);
  const result = await page.evaluate(() => {
    document.getElementById("annualOutput").innerHTML = `
      <div class="annual-summary-item">
        <span>PVT electricity</span><strong>999,999 kWh</strong><small>DOM text</small>
      </div>
      <table><tr><td>DOM-only table row</td><td>should not export</td></tr></table>`;
    document.getElementById("area").value = "20";
    CURRENT_LOC = { name:"State Test Site", lat:-33.86, lon:151.20 };
    CURRENT_TZ = { timeZone:"Australia/Sydney", gmtOffset:10 };
    CURRENT_MET = [{ dayN:1, hourN:12, solarHour:12, dni:800, dhi:100, ghi:900, ta:20, vwind:3 }];
    CURRENT_CALC_RESULT = {
      schemaVersion: 1,
      generatedAtIso: "2026-06-29T00:00:00.000Z",
      location: { name:"State Test Site", lat:-33.86, lon:151.20 },
      weather: buildWeatherExportMetadata(),
      inputs: collectInputState(),
      thermalModel: "A",
      annualMetrics: [
        { label:"PVT electricity", value:1234.567, unit:"kWh", decimals:1, note:"state metric" }
      ],
      annualTables: [
        { title:"Energy Detail", rows:[["Thermal Energy", "222.2 kWh"]] }
      ],
      industrySummary: null,
      annualRaw: { pvtElectricKWh:1234.567 }
    };
    const metrics = collectAnnualReportMetrics();
    const csv = buildSummaryCsv();
    const sharePayload = buildShareScenarioPayload();
    return { metrics, csv, sharePayload };
  });

  expect(result.metrics[0]).toEqual({
    label: "PVT electricity",
    value: "1,234.6 kWh",
    note: "state metric"
  });
  expect(result.csv).toContain("1,234.6 kWh");
  expect(result.csv).toContain("Thermal Energy,222.2 kWh");
  expect(result.csv).not.toContain("999,999");
  expect(result.csv).not.toContain("DOM-only table row");
  expect(result.sharePayload.schemaVersion).toBe(2);
  expect(result.sharePayload.weather.hasSolarHour).toBe(true);
  expect(result.sharePayload.weather.annualGhiKWhM2).toBeCloseTo(0.9, 6);
  expect(result.sharePayload.resultSummary.annualRaw.pvtElectricKWh).toBe(1234.567);
});

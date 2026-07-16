import { test, expect } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const pageUrl = pathToFileURL(path.resolve("index.html")).href;
const modernPageUrl = `${pageUrl}?ui=modern`;

test("calculator UI loads without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(pageUrl);
  await expect(page.locator("#btnAnnual")).toBeVisible();
  await expect(page.locator("#industrySelect")).toBeVisible();
  await expect(page.locator("#downloadLink")).toBeHidden();
  expect(errors).toEqual([]);
});

test("commercial laundry controls are exposed", async ({ page }) => {
  await page.goto(pageUrl);
  await page.selectOption("#industrySelect", "commercial_laundry");
  await expect(page.locator("#laundryInputsPanel")).toBeVisible();
  await expect(page.locator("#throughputInput")).toBeHidden();
  await expect(page.locator("#laundryKgPerDay")).toHaveValue("1500");
  await expect(page.locator("#laundryWaterUseLPerKg")).toHaveValue("10");
});

test("modern results prioritise matched decisions without changing values", async ({ page }) => {
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

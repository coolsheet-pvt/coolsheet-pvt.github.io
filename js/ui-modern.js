// ============================================================================
//  MODERN UI (beta) — presentation-only layer.
//  Activated with ?ui=modern in the URL. The classic UI remains the default
//  and is untouched; this file adds a body class, a compact provenance legend,
//  simplified results, and collapsible assumptions. It contains NO
//  calculation logic and reads no values used by calcAnnualPVT.
//  To remove the modern UI entirely: delete this file, css/ui-modern.css, and
//  their two include lines in index.html.
// ============================================================================
(function(){
  const params = new URLSearchParams(location.search);
  const MODERN = params.get("ui") === "modern";

  function buildUrl(modern){
    const url = new URL(location.href);
    if (modern) url.searchParams.set("ui", "modern");
    else url.searchParams.delete("ui");
    return url.href; // hash (#s= share payloads) is preserved
  }

  const headerActions = document.querySelector(".header-actions");
  if (!MODERN){
    // Classic mode: only add the opt-in link.
    if (headerActions){
      const a = document.createElement("a");
      a.className = "how-it-works-btn ui-modern-switch";
      a.href = buildUrl(true);
      a.textContent = "Try modern UI (beta)";
      a.title = "Same calculator and results — clearer layout. Your inputs are kept.";
      headerActions.appendChild(a);
    }
    return;
  }

  document.body.classList.add("ui-modern");

  // Keep view/navigation actions together in the main header.
  if (headerActions){
    const classicLink = document.createElement("a");
    classicLink.className = "how-it-works-btn ui-classic-switch";
    classicLink.href = buildUrl(false);
    classicLink.textContent = "Switch to classic";
    classicLink.title = "Return to the classic calculator layout. Your inputs are kept.";
    headerActions.appendChild(classicLink);
    const brandMeta = document.querySelector(".brand-meta");
    if (brandMeta) headerActions.appendChild(brandMeta);
  }

  const wrap = document.querySelector(".wrap");
  if (!wrap) return;

  // Put demand-matched decision results before the secondary supply summary.
  // This changes presentation order only; the original result nodes and values
  // remain the same and are still populated by calcAnnualPVT.
  const outputPanel = document.getElementById("output");
  const industryPanel = document.getElementById("industryOutput");
  const resultsAnchor = document.createElement("section");
  resultsAnchor.id = "modernResults";
  resultsAnchor.className = "modern-results-anchor";
  resultsAnchor.innerHTML = `
    <span>Decision summary</span>
    <h2>Your modelled result</h2>
    <p>Demand-matched savings and coverage are shown first. System yield and diagnostic charts follow.</p>`;
  if (outputPanel){
    outputPanel.before(resultsAnchor);
    if (industryPanel) resultsAnchor.after(industryPanel);
  }

  const panels = wrap.querySelectorAll(":scope > .panel");

  // Provenance legend — explain input/model/assumption status once without
  // repeating a badge beside every field label.
  const chip = (type, text) => {
    const s = document.createElement("span");
    s.className = `prov-chip prov-${type}`;
    s.textContent = text;
    return s;
  };
  const mainsNote = document.querySelector(".inlet-block > .note");
  if (mainsNote) mainsNote.appendChild(chip("model", "calculated — editable"));

  const legend = document.createElement("div");
  legend.className = "prov-legend";
  legend.innerHTML = `
    <b>Reading this page</b>
    <span class="prov-chip prov-input">your input</span> values you control
    <span class="prov-chip prov-model">calculated</span> derived from weather/site data
    <span class="prov-chip prov-assumption">assumption</span> editable engineering defaults`;
  panels[0]?.querySelector(".grid")?.prepend(legend);

  // Assumptions at a glance — mirrors docs/assumptions-and-limitations.md.
  const assumptions = document.createElement("details");
  assumptions.className = "modern-assumptions";
  assumptions.innerHTML = `
    <summary>Assumptions used in this estimate <span class="prov-chip prov-assumption">assumption</span></summary>
    <div class="modern-assumptions-body"><ul>
      <li>Weather is a PVGIS <b>typical meteorological year</b> — a representative year, not a forecast.</li>
      <li>Inlet water uses the <b>BC-Aus mains-water model</b> (editable monthly overrides above).</li>
      <li>PV headline output is the temperature-corrected gross module yield used in the original annual PVT result; estimated net AC is retained in the detailed results. The PVT cooling effect is on by default.</li>
      <li>Industry matching is <b>hourly direct-use with no storage tank</b> (except the hotel tank input); the supply-only value card assumes 100% utilisation and is an upper bound.</li>
      <li>Prices, boiler efficiency, CAPEX/OPEX, lifetime and discount rate are <b>editable estimates</b>, not quotes.</li>
    </ul></div>`;
  panels[1]?.querySelector(".grid")?.appendChild(assumptions);

  const evidenceNotice = document.getElementById("industryEvidenceNotice");
  let evidenceDetails = null;
  if (evidenceNotice && !evidenceNotice.parentElement?.classList.contains("modern-evidence-details")){
    evidenceDetails = document.createElement("details");
    evidenceDetails.className = "modern-evidence-details full-row";
    const summary = document.createElement("summary");
    summary.textContent = "Evidence and limitations";
    evidenceNotice.before(evidenceDetails);
    evidenceDetails.append(summary, evidenceNotice);
  }
  function syncEvidenceVisibility(){
    if (evidenceDetails && evidenceNotice) evidenceDetails.hidden = evidenceNotice.style.display === "none";
  }
  document.getElementById("industrySelect")?.addEventListener("change", () => setTimeout(syncEvidenceVisibility, 0));
  syncEvidenceVisibility();

  function createDemandDetails(){
    const details = document.createElement("details");
    details.className = "modern-demand-details full-row";
    details.innerHTML = `<summary><span>Edit demand assumptions</span><small>Defaults are used unless you change them</small></summary>`;
    return details;
  }

  function collapseWholeAssumptionPanel(panelId){
    const panel = document.getElementById(panelId);
    if (!panel || panel.querySelector(":scope > .modern-demand-details")) return;
    const details = createDemandDetails();
    const body = document.createElement("div");
    body.className = "modern-demand-details-body";
    while (panel.firstChild) body.appendChild(panel.firstChild);
    details.appendChild(body);
    panel.appendChild(details);
  }

  function collapseAssumptionGridTail(panelId, startInputId){
    const panel = document.getElementById(panelId);
    const start = panel?.querySelector(`label[for="${startInputId}"]`);
    const grid = start?.parentElement;
    if (!panel || !start || !grid || grid.querySelector(":scope > .modern-demand-details")) return;
    const details = createDemandDetails();
    const body = document.createElement("div");
    body.className = "grid modern-demand-assumption-grid";
    let node = start;
    while (node){
      const next = node.nextSibling;
      body.appendChild(node);
      node = next;
    }
    details.appendChild(body);
    grid.appendChild(details);
  }

  collapseWholeAssumptionPanel("dairyAssumptionsPanel");
  collapseWholeAssumptionPanel("breweryAssumptionsPanel");
  collapseAssumptionGridTail("hotelInputsPanel", "hotelDhwKWh");
  collapseAssumptionGridTail("aquaticInputsPanel", "aquaticElectricKWhPerM2");
  collapseAssumptionGridTail("laundryInputsPanel", "laundryWaterUseLPerKg");

  // 5) Results presentation. Values are copied from the calculator's rendered
  // result nodes; no energy, coverage or financial value is recalculated here.
  function addCoverageBar(pill){
    if (!pill || pill.querySelector(".modern-coverage-track")) return;
    const value = Number.parseFloat(pill.querySelector(".big")?.textContent || "");
    if (!Number.isFinite(value)) return;
    const track = document.createElement("div");
    track.className = "modern-coverage-track";
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${Math.max(0, value).toFixed(1)} percent coverage`);
    const fill = document.createElement("span");
    fill.style.width = `${Math.min(100, Math.max(0, value))}%`;
    track.appendChild(fill);
    pill.appendChild(track);
  }

  function simplifyEnergyFlow(group){
    if (!group || group.dataset.modernSimplified === "true") return;
    const cards = Array.from(group.querySelectorAll(".energy-flow-card"));
    if (cards.length < 4) return;
    group.dataset.modernSimplified = "true";

    const isElectrical = group.classList.contains("electrical");
    const heading = group.querySelector(".energy-flow-heading");
    setTextIfChanged(heading?.querySelector("span"), isElectrical ? "Electricity balance" : "Heat balance");
    setTextIfChanged(cards[1].querySelector("span"), "From solar");
    setTextIfChanged(cards[2].querySelector("span"), isElectrical ? "From grid" : "From backup");
    const total = document.createElement("small");
    total.className = "modern-flow-total";
    total.innerHTML = `${isElectrical ? "Annual site electricity demand" : "Annual process heat demand"}<strong>${cards[0].querySelector("strong")?.textContent || "—"}</strong>`;
    heading?.appendChild(total);

    const footer = document.createElement("div");
    footer.className = "modern-flow-footer";
    footer.innerHTML = `<span>${isElectrical ? "PV exported" : "Excess solar heat"}</span><strong>${cards[3].querySelector("strong")?.textContent || "—"}</strong>`;
    group.querySelector(".energy-flow-cards")?.after(footer);
    cards[0].classList.add("modern-flow-context-card");
    cards[3].classList.add("modern-flow-context-card");
  }

  function wrapDataTable(id, label){
    const table = document.getElementById(id);
    if (!table || table.parentElement?.classList.contains("modern-data-details")) return;
    const details = document.createElement("details");
    details.className = "modern-data-details";
    const summary = document.createElement("summary");
    summary.textContent = label;
    table.before(details);
    details.append(summary, table);
  }

  function setChartControlLabel(id, label){
    const input = document.getElementById(id);
    const holder = input?.closest("label");
    if (!input || !holder || holder.dataset.modernLabelled === "true") return;
    holder.dataset.modernLabelled = "true";
    Array.from(holder.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    holder.append(document.createTextNode(label));
  }

  const chartsPanel = document.getElementById("supplyChartsPanel");
  const chartsHeading = chartsPanel?.querySelector("h4");
  if (chartsHeading) chartsHeading.textContent = "Explore system output";
  if (chartsPanel && !chartsPanel.querySelector(".modern-chart-intro")){
    const intro = document.createElement("p");
    intro.className = "modern-chart-intro";
    intro.textContent = "Start with monthly energy. Daily output and temperatures are diagnostic views. All charts use the modelled typical year, not measured performance.";
    chartsHeading?.after(intro);
  }
  setChartControlLabel("showMonthlySupply", "Monthly energy");
  setChartControlLabel("showDailyDetail", "Daily energy");
  setChartControlLabel("showOutletTemperature", "Temperatures");
  wrapDataTable("monthlyDataTable", "View monthly data table");
  wrapDataTable("dailyDataTable", "View daily data table");
  wrapDataTable("temperatureDataTable", "View temperature data table");

  function setTextIfChanged(element, value){
    if (element && element.textContent !== value) element.textContent = value;
  }

  function formatReadableEnergy(root){
    if (!root) return;
    root.querySelectorAll(".annual-summary-item strong, .energy-flow-card strong, .modern-flow-total strong, .modern-flow-footer strong").forEach(element => {
      if (element.dataset.modernEnergyFormatted === "true") return;
      const text = element.textContent.trim();
      const match = text.match(/^([+-]?[\d,]+(?:\.\d+)?)\s*kWh(\/yr)?$/i);
      if (!match) return;
      const valueKWh = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(valueKWh) || Math.abs(valueKWh) < 1000) return;
      const valueMWh = valueKWh / 1000;
      element.textContent = `${valueMWh.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})} MWh${match[2] || ""}`;
      element.dataset.modernEnergyFormatted = "true";
    });
  }

  function simplifyResults(){
    const annualCard = outputPanel?.querySelector(".output-card-annual");
    if (!annualCard) return;

    const hasIndustry = !!industryPanel?.querySelector(".output-card-industry");
    document.body.classList.toggle("modern-has-industry-results", hasIndustry);
    document.body.classList.toggle("modern-cooling-disabled", !document.getElementById("pvtCoolingSensitivityEnable")?.checked);
    document.body.classList.add("modern-results-ready");

    const anchorKicker = resultsAnchor.querySelector("span");
    const anchorTitle = resultsAnchor.querySelector("h2");
    const anchorNote = resultsAnchor.querySelector("p");
    if (hasIndustry){
      setTextIfChanged(anchorKicker, "Decision summary");
      setTextIfChanged(anchorTitle, "How the system serves this site");
      setTextIfChanged(anchorNote, "Savings and coverage use hourly demand matching. System yield and diagnostic charts follow.");
    } else {
      setTextIfChanged(anchorKicker, "System summary");
      setTextIfChanged(anchorTitle, "Modelled annual output");
      setTextIfChanged(anchorNote, "No industry demand is selected, so these are supply totals rather than site-matched savings.");
    }

    annualCard.querySelectorAll(".annual-summary-item").forEach(item => {
      const label = item.querySelector("span")?.textContent?.trim() || "";
      const alwaysSecondary = label.startsWith("PV-only baseline") || label.startsWith("Electricity from cooling") || label === "Total output";
      const matchedFinance = hasIndustry && label === "PVT supply value";
      item.classList.toggle("modern-secondary-result", alwaysSecondary || matchedFinance);
    });

    const hero = industryPanel?.querySelector(".insight-hero");
    if (hero && hero.dataset.modernSimplified !== "true"){
      hero.dataset.modernSimplified = "true";
      const kicker = hero.querySelector(".insight-kicker");
      const title = hero.querySelector(".insight-title");
      const sub = hero.querySelector(".insight-sub");
      setTextIfChanged(kicker, "Decision summary");
      const saving = title?.textContent?.match(/You save\s+(.+?)\s+with/i)?.[1];
      if (title && saving) setTextIfChanged(title, `Estimated annual saving: ${saving}`);
      if (sub) setTextIfChanged(sub, sub.textContent.replace(/^Based on\s+/i, "Hourly demand matching · "));
      const pills = Array.from(hero.querySelectorAll(".insight-pill"));
      setTextIfChanged(pills[0]?.querySelector(".eyebrow"), "Electricity supplied by solar");
      setTextIfChanged(pills[1]?.querySelector(".eyebrow"), "Direct-use heat coverage");
      setTextIfChanged(pills[2]?.querySelector(".eyebrow"), "Estimated annual saving");
      addCoverageBar(pills[0]);
      addCoverageBar(pills[1]);
      pills[3]?.classList.add("modern-secondary-result");
      const electricCoverage = pills[0]?.querySelector(".big")?.textContent?.trim();
      const heatCoverage = pills[1]?.querySelector(".big")?.textContent?.trim();
      if (electricCoverage && heatCoverage){
        const takeaway = document.createElement("p");
        takeaway.className = "modern-decision-note";
        takeaway.innerHTML = `<b>At this size:</b> same-hour PVT heat supplies ${heatCoverage} of modelled heat demand and solar electricity supplies ${electricCoverage} of modelled electricity demand. Backup heat and the grid supply the remainder.`;
        hero.appendChild(takeaway);
      }
    }

    industryPanel?.querySelectorAll(".energy-flow-group").forEach(simplifyEnergyFlow);
    industryPanel?.querySelectorAll(".output-card-industry").forEach(card => {
      const sizing = card.querySelector(".recommended-size-box");
      const flow = card.querySelector(".energy-flow-summary");
      const resultArea = flow?.closest(".dairy-result-area");
      if (sizing && resultArea && resultArea.nextElementSibling !== sizing) resultArea.after(sizing);
      else if (sizing && flow && flow.nextElementSibling !== sizing) flow.after(sizing);
    });
    formatReadableEnergy(annualCard);
    formatReadableEnergy(industryPanel);

    const monthly = document.getElementById("showMonthlySupply");
    if (monthly && chartsPanel?.style.display !== "none" && chartsPanel.dataset.modernDefaulted !== "true"){
      chartsPanel.dataset.modernDefaulted = "true";
      monthly.checked = true;
      monthly.dispatchEvent(new Event("change", { bubbles:true }));
    }
  }

  document.addEventListener("pvt:results-rendered", simplifyResults);
  simplifyResults();
})();

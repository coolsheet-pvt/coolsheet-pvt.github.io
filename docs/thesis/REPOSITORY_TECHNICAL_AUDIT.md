# CoolSheet PVT Calculator — Repository Technical Audit

Audit date: 2026-07-20.
Branch/commit inspected: `main` @ `6d4cf9ccce77e42aab8de5d0591132f69d9f9400` (clean working tree, 141 tracked files).
Deliverable of a read-only repository audit: no existing repository file was modified; only this document was created.

---

## 1. Document purpose and evidence conventions

This document is a self-contained technical reference for the **CoolSheet PVT Calculator** repository, written so that an AI assistant (or human reader) with no prior knowledge of the project can understand what the system does, how the repository is structured, how data flows through it, where every engineering calculation lives, what has been tested or validated, and what remains uncertain. It is intended to be uploaded into a ChatGPT Project as authoritative context for an Engineering Honours thesis at UNSW Sydney.

PVT means **photovoltaic-thermal**: a solar collector that produces both electricity (photovoltaic, PV) and useful hot water (thermal) from the same panel area, where the water flow also cools the PV cells.

### Evidence tags

Every important finding carries exactly one tag:

- **[VERIFIED-CODE]** — confirmed by reading the executable source during this audit.
- **[VERIFIED-RUN]** — confirmed by a command or test actually executed during this audit (2026-07-20), or by data files directly inspected.
- **[DOC-ONLY]** — stated in repository documentation but not independently confirmed in code or by execution during this audit.
- **[INFERRED]** — a reasonable inference from the implementation, not directly confirmed.
- **[MISSING]** — expected but absent, or too ambiguous to determine.
- **[CONFLICT]** — sources disagree; the conflict is described where tagged and consolidated in §20.

Source references use repository-relative paths plus function/constant names (e.g. `js/app.js` → `calcAnnualPVT()`). Line numbers, when given, are correct for the audited commit but should be treated as supplementary; function and constant names are the stable identifiers.

---

## 2. Machine-readable project context

```yaml
project_name: CoolSheet PVT Calculator
repository: https://github.com/coolsheet-pvt/coolsheet-pvt.github.io
local_folder_name: PVT-Calculator
purpose: >
  Web tool estimating annual electrical + thermal energy output, demand
  coverage, savings, payback and emissions of photovoltaic-thermal (PVT)
  solar systems for Australian commercial sites; UNSW Engineering Honours
  thesis research prototype.
app_version_label: "13.42"        # js/app.js APP_VERSION; index.html shows "Version 13.42"
audit_date: 2026-07-20
branch: main
commit: 6d4cf9ccce77e42aab8de5d0591132f69d9f9400
main_technologies:
  frontend: [HTML, vanilla JavaScript (no build step), Chart.js 4.5.1 (vendored), inline SVG charts]
  backend: [Python 3.12, FastAPI, pvlib 0.15.0, pandas, timezonefinder]
  testing: [Node 22 test scripts (.mjs), Python unittest, Playwright 1.61.1]
primary_entry_points:
  frontend_page: index.html
  frontend_logic: js/app.js            # ~7,700 lines; all calculation logic
  main_calculation: "js/app.js -> calcAnnualPVT()"
  backend_api: pvt-tmy-api/server.py   # FastAPI: GET/POST /tmy, GET /health, POST /email-report
major_subsystems:
  - weather acquisition (PVGIS TMY via backend, contract 2.1)
  - solar geometry + isotropic plane-of-array irradiance (TiltedSurfaceRadiation)
  - PVT thermal models (frozen Model A linear, frozen Model B ISO 9806 Eq. 12)
  - PV electrical model (STC + NOCT temperature correction + PVT cooling heuristic + DC->AC boundary)
  - BC-Aus mains-water temperature model (zone-fitted Burch-Christensen sinusoid)
  - industry demand models (dairy, brewery, hotel, aquatic centre, commercial laundry)
  - hourly supply/demand matching (no storage)
  - economics (savings, SPP, NPV, CRF, LCOE/LCOH) and avoided emissions
  - design explorer (collector-area sizing slider)
  - exports (hourly CSV, summary CSV, PDF-style report, email, share links)
  - validation suite (validation/ tree; npm test)
important_data_sources:
  - PVGIS 5.3 TMY (European Commission JRC) via pvlib get_pvgis_tmy
  - OpenStreetMap Nominatim geocoding
  - CER DomDecks legacy zone decks (mains-water fitting fixtures)
  - EnergyPlus/OneBuilding TMYx .stat files (ground-temperature cross-check)
  - SOAC (Sydney Olympic Aquatic Centre) 19-day field dataset (Mar 2026)
  - pvlib-generated golden references; PVGIS/PVWatts/Renewables.ninja PV benchmarks
main_engineering_outputs:
  - annual PVT electricity (net AC), PV-only baseline, thermal heat (kWh/yr)
  - hourly 8,760 supply and demand series; monthly aggregations
  - solar fractions (thermal + electrical), unmet/excess energy
  - savings (AUD/yr), simple payback, NPV, LCOE, LCOH, avoided t CO2-e
deployment:
  frontend: GitHub Pages at https://coolsheet-pvt.github.io/ (push to main)
  backend: Render service coolsheet-pvt-tmy-api (render.yaml Blueprint, Python 3.12.11)
audit_scope: >
  Full static read of frontend/backend calculation paths, docs and validation
  tree; offline test suite executed (all pass); one live read-only /health check
  of the hosted backend. Browser/live-network test suites not executed (see §19).
```

---

## 3. Executive technical summary

CoolSheet is a **static-frontend web calculator** (plain HTML/JS, no build step) with a **small Python weather backend**. The user enters an Australian address and system parameters; the app geocodes the address (Nominatim), fetches an 8,760-hour Typical Meteorological Year (TMY) weather dataset from the backend (which wraps PVGIS 5.3 via pvlib), and then simulates every hour of a representative year in the browser: plane-of-array irradiance from an isotropic transposition model, thermal output from one of two frozen PVT collector models (Model A simple-linear or Model B ISO 9806), PV electricity with NOCT-based cell-temperature correction (NOCT = Nominal Operating Cell Temperature) plus an optional PVT cooling gain, and a fitted mains-water temperature model supplying the collector inlet temperature. Optionally, one of five industry demand models (dairy farm, brewery, hotel, aquatic centre, commercial laundry) generates an hourly thermal + electrical demand series, matched hour-by-hour against supply with **no storage** assumed. Economics — savings, simple payback period (SPP), net present value (NPV), capital recovery factor (CRF), levelised costs of electricity and heat (LCOE/LCOH) — and avoided emissions are computed from the matched energy. All results render as cards, tables, SVG/Chart.js charts, CSV exports, a report window, and shareable links. **[VERIFIED-CODE]**

Evidence quality is unusually explicit for a research prototype: a `validation/` tree holds locked weather fixtures, pvlib golden references, equation-lock tests for the frozen thermal models, an executed-in-this-audit offline suite of 21 test scripts (all passing, §19), field data from a real PVT installation (SOAC, Sydney Olympic Aquatic Centre), and three internal audit documents. The supply side (geometry, POA, PV-only annual energy) is validated against pvlib to ≤0.2%; the demand-side industry defaults are explicitly labelled engineering scenarios, not certified benchmarks; the PVT electrical cooling gain and the absolute thermal yield under real field conditions are the least-validated links (SOAC field efficiency ≈ 0.63× the certified steady-state curve). **[VERIFIED-RUN]** for the offline suite; **[VERIFIED-CODE]** elsewhere.

---

## 4. System purpose and scope

- Purpose (stated in `README.md` and `index.html` footer): estimate annual energy output and payback of PVT systems for Australian commercial sites; educational/early-feasibility use; explicitly *not* site measurement, certified design, financial quote or professional advice. **[VERIFIED-CODE]**
- Simulation scope: one representative year, 8,760 hourly timesteps, single collector array, direct-use matching (no thermal or battery storage), Australian focus (mains model and emission factors are Australia-specific; weather works anywhere PVGIS covers). **[VERIFIED-CODE]**
- Thesis context: `docs/CHAT_CONTEXT.txt` describes the project as a UNSW thesis; `validation/VALIDATION_RECORD.md` notes the PVT thermal models are "another student's work" and are frozen. **[DOC-ONLY]**

---

## 5. Technology stack and runtime environment

| Layer | Technology | Evidence |
|---|---|---|
| Frontend | HTML + vanilla JavaScript, no framework, no build step; Chart.js 4.5.1 vendored at `assets/vendor/chart.umd.min.js`; Google Fonts (Cairo) | `index.html` **[VERIFIED-CODE]** |
| Frontend logic | Single file `js/app.js` (~7,700 lines), version constant `APP_VERSION = "13.42"` | **[VERIFIED-CODE]** |
| Optional UI layer | `js/ui-modern.js` + `css/ui-modern.css`, activated by `index.html?ui=modern`; presentation only, no calculation logic | **[DOC-ONLY]** (described in `docs/audit-report-2026-07.md` §F; file presence verified) |
| Backend | Python FastAPI app `pvt-tmy-api/server.py` (417 lines); dependencies pinned in `pvt-tmy-api/requirements.txt` (pvlib 0.15.0, pandas 3.0.1, fastapi 0.135.1, uvicorn 0.41.0, numpy 2.4.2, timezonefinder 8.2.1, tzdata 2025.3, requests 2.32.5) | **[VERIFIED-CODE]** |
| Tests | Node 22 `.mjs` scripts under `validation/unit|scripts`, Python unittest under `validation/backend`, Playwright specs under `validation/browser`; `@playwright/test` 1.61.1 is the only npm devDependency | `package.json` **[VERIFIED-CODE]** |
| CI | GitHub Actions `.github/workflows/validation.yml`: Node 22 + Python 3.12, `npm test`, then Playwright Chromium + `npm run test:browser`, on every push/PR | **[VERIFIED-CODE]** |
| Hosting | GitHub Pages (repo `coolsheet-pvt/coolsheet-pvt.github.io`, `.nojekyll` present); Render web service per `render.yaml` (Python 3.12.11, health check `/health`, auto-deploy on passing checks from `main`, root `pvt-tmy-api/`) | **[VERIFIED-CODE]** |

Storage note: the frontend persists user inputs in browser `localStorage` (`INPUT_STORE_KEY = "pvtCalcInputs.v1"`) and caches geocode/TMY responses in `localStorage` under prefix `pvtCalcNetworkCache.v3` with a 7-day TTL and per-scope entry limits (`NETWORK_CACHE_LIMITS = { geocode:30, tmy:6 }`). The backend caches TMY responses in memory for 24 h. There is no database. **[VERIFIED-CODE]**

---

## 6. Repository architecture and file map

Top level (tracked files only; 141 total):

```text
index.html                     Main calculator page (all inputs + result containers)
js/app.js                      All frontend logic and every engineering calculation
js/bc_aus_zone_constants.js    Fitted BC-Aus mains-model zone constants (auto-generated)
js/cer_postcode_zones.js       CER postcode->zone registry (SWH + ASHP families)
js/chart-font-defaults.js      Chart.js font setup
js/ui-modern.js                Optional "modern UI" presentation layer (flagged)
css/styles.css, css/ui-modern.css
assets/                        Logos, favicon, process diagrams (PNG), vendored Chart.js
data/bc_aus_constants.js       Earlier single-set BC-Aus fit (superseded by zone constants)
data/bc_zone_corrections.js    Per-zone monthly corrections from an earlier fit approach
pages/                         Validation & evidence pages (see §18)
pvt-tmy-api/server.py          FastAPI weather backend (contract 2.1)
pvt-tmy-api/requirements.txt   Pinned backend dependencies
render.yaml                    Render Blueprint for the backend service
tools/fit_bc_aus*.py           Python fitting scripts that generate the mains constants
tools/parse_tmy.py             Small TMY parsing helper
docs/                          Specifications, audits, validation reports (see below)
validation/                    Tests, fixtures, references, field data (see §19)
.github/workflows/validation.yml  CI pipeline
```

Documentation set under `docs/`:

| File | Role |
|---|---|
| `model-specification.md` | Authoritative statement of the scientific models and locked policies |
| `assumptions-and-limitations.md` | Model locks, reproducibility caveats, per-industry scope limits |
| `audit-report-2026-07.md` | Internal full-code audit at v13.11→13.12 (formula table, bug fixes C1–C6) |
| `independent-model-audit-2026-07-10.md` | Adversarial external-style audit with red/amber/green verdicts |
| `validation-report.md` | Offline + live validation run results (last runs 2026-06-29/30) |
| `test-matrix.md` | Test suite inventory and how to run it |
| `reproducibility.md` | Environment setup, fixture policy, deployment/verification commands |
| `TEAM_WORKFLOW.md` | Team/git workflow notes |
| `CHAT_CONTEXT.txt` | Quick orientation notes (hosting, push commands) |
| `water-mains-temperature-explained.docx` | Narrative explanation of the mains-water model |

Caution: the three audit/validation documents predate the current commit (v13.12–13.13 era vs. v13.42 now) and several of their statements are stale; §20 lists the discrepancies. **[VERIFIED-CODE]**

---

## 7. System and deployment boundaries

```text
Browser (GitHub Pages: coolsheet-pvt.github.io, or localhost:8080)
  ├── OpenStreetMap Nominatim  (geocoding; direct from browser)
  ├── TMY API backend
  │     ├── local:  http://127.0.0.1:8000/tmy   (preferred when frontend is local)
  │     └── hosted: https://coolsheet-pvt-tmy-api.onrender.com/tmy  (fallback; ~1 min cold start)
  │            └── PVGIS 5.3 API (re.jrc.ec.europa.eu/api/v5_3/) via pvlib
  └── POST /email-report  (same backend; SMTP relay using server-side env vars)
```

- Endpoint selection: `getTMYEndpoints()` prefers the local API when the page itself is served locally (`isLocalFrontend()`), otherwise the hosted API; `LOAD_TIMEOUT_MS = { geocode:8000, localTMY:45000, remoteTMY:90000 }`. **[VERIFIED-CODE]**
- Fail-closed weather policy: `requireWeatherServiceHealth()` + `validateTMYContract()` require the backend `/health` and `/tmy` responses to declare contract 2.1, PVGIS 5.3, the synthetic-standard-time clock policy and the frozen Model-B long-wave prohibition before production calculations proceed. **[VERIFIED-CODE]** (policy stated in `docs/model-specification.md`; enforcement functions present in `js/app.js`.)
- Live state at audit time: `GET https://coolsheet-pvt-tmy-api.onrender.com/health` executed 2026-07-20 returned `status=ready`, `apiContractVersion=2.1`, `pvgisApiVersion=5.3`, all 11 required record fields including `solarHour`. **[VERIFIED-RUN]** (Note: a full 8,760-record `/tmy` sweep was *not* re-run; see §24.)
- Email boundary: `POST /email-report` attaches the generated report HTML and relays via SMTP configured by server environment variables (`SMTP_HOST`, `SMTP_FROM`, optional `SMTP_USER/PASSWORD/PORT/TLS/SSL`); returns HTTP 501 when unconfigured. Recipient/sender validated against a simple regex; header-injection characters stripped. **[VERIFIED-CODE]**

---

## 8. End-to-end data flow

```text
User address + system inputs (index.html)
    ↓ geocodeAddress()  — Nominatim, cached
lat/lon  ──────────────────────────────┐
    ↓ fetchTMY()  — local→hosted backend, contract 2.1, cached
8,760 records {dayN 1–365, hourN, solarHour, utcTimestamp, dni, dhi, ghi,
               ta, vwind, relativeHumidityPct, infraredHorizontalWm2}
    ↓ normalizeWeatherRecords()  — hourN 1..24 → 0..23; field-name tolerant
CURRENT_MET (normalized hourly array)
    ↓ calculateLocalTMains(met, lat, lon)  — BC-Aus zone model
CURRENT_MAINS {byDay[1..365] °C, byMonth, annualAvgC}  (user monthly override possible)
    ↓ calcAnnualPVT()  — the single main calculation driver
    │   per hour: TiltedSurfaceRadiation.calculate(dayN, solarHour, dni, dhi) → G [W/m²]
    │             calculatePvtThermalSample(...)   → Model A or B → η_th, Q̇_th, T_out
    │             calcNoctPanelTempC / calcPvtPanelTempC → cell temperatures
    │             PV: STC → temperature factor → DC → AC delivery factor
    ↓
hourly supply series: pvtThermalHourly [kWh_th], pvElectricHourly [kWh_e AC]
    ↓ (optional industry branch: dairy | brewery | hotel | aquatic | laundry)
hourly demand series: thermalHourly, electricHourly
    ↓ calculateHourlyEnergyBalance(supply, demand, met)   — per-hour min(), no storage
matched / unmet / excess energy + solar fractions (+ monthly breakdowns)
    ↓ economics + emissions (savings, SPP, NPV, CRF, LCOE/LCOH, t CO2-e)
    ↓
outputs: summary cards, detail tables, SVG demand charts, Chart.js supply charts,
         design explorer, hourly CSV, summary CSV, report window/email, share link
         (all fed from CURRENT_CALC_RESULT state)
```

All of the above is implemented in `js/app.js`; the backend's only calculation duties are TMY retrieval, timezone resolution, the synthetic demand clock and true solar time (§17). **[VERIFIED-CODE]**

---

## 9. User workflows and visible features

1. **Supply-only estimate**: enter address → "Geocode & Load TMY" → adjust area/tilt/etc. → "Calculate results" → annual PVT electricity (net AC), PV-only baseline, thermal yield, economics cards, monthly/daily charts, panel-temperature view. **[VERIFIED-CODE]**
2. **Industry matching**: select an industry, enter its inputs, select thermal processes → the same calculation additionally produces demand series, coverage fractions, savings, process breakdowns, per-industry charts, model-basis modals citing sources, and (hotel) an optional meter-calibration "Reality Check". **[VERIFIED-CODE]**
3. **Design explorer**: after an industry run, a slider recomputes the full hourly thermal model at alternative collector areas (`calculateDesignExplorerScenario()`, `findDesignExplorerTargetArea()` bisection to hit a target coverage), with monthly bars and an hourly heatmap. **[VERIFIED-CODE]**
4. **Exports**: hourly CSV (per-hour G, η_th, DC/AC electricity, thermal, temperatures), summary CSV, a print-ready report window (`buildPdfTemplateDocument()`), report email via backend, and share links (`#s=` base64 payload with schema version, inputs, location/weather metadata, compact results, reproducibility note). **[VERIFIED-CODE]**
5. **Validation pages** (`pages/`, linked from the header): validation hub; BC-Aus vs CER comparisons (+6°F and 0°F variants); BC-Aus vs EnergyPlus ground temperatures (0.5 m, 2.0 m); mains formula explainer; interactive CER comparison tool; SOAC field validation + comparison; PV external validation across five Australian cities. **[VERIFIED-CODE]** (titles verified; page internals not audited line-by-line.)
6. **"How this calculator works"** modal with step-by-step SVG pipeline diagrams (`openHowItWorks()`, `HOW_IT_WORKS_DETAIL`). **[VERIFIED-CODE]**
7. A hidden "Testing" checkbox (`chkHideMains` → `isTestingMode()`) toggles extra diagnostics. **[VERIFIED-CODE]**

---

## 10. Input register

All inputs are DOM elements in `index.html`, read by `calcAnnualPVT()` and the industry helpers. Defaults below are the shipped HTML/JS defaults; "Reset inputs" restores them (`resetInputsToDefaults()`, storage key version `2026-07-hotel-scenario-defaults`). **[VERIFIED-CODE]**

### 10.1 Site and system (Step 1)

| Input id | Meaning | Unit | Default | Validation/clamp |
|---|---|---|---|---|
| `addressInput` | Site address → geocode | — | — | must geocode |
| `area` | Collector/PV area A | m² | 250 | > 0 |
| `tiltAngle` | Panel tilt β | ° | 30 | 0–90 |
| `azimuthAngle` | Panel azimuth (0°=north, ±180°=south) | ° | 0 | −180–180 |
| `albedo` | Ground reflectivity ρ | – | 0.2 | 0–1 |
| `flowRate` | Coolant flow per collector area | L/s/m² | 0.02 | > 0 |
| `etaPvPercent`/`etaPv` | PV efficiency η_PV at STC (Standard Test Conditions) | % / fraction | 20 / 0.20 | 0–1 |
| `pvTempCorrEnable` | NOCT module-temperature derate on/off | – | checked | — |
| `pvtCoolingSensitivityEnable` | PVT electrical cooling effect on/off | – | checked | — |
| `pvTempCoeff` | PV power temperature coefficient γ | %/°C | −0.40 | finite (÷100 → per °C) |
| `pvNoct` | NOCT | °C | 45 | 20–80 |
| `pvSystemLossPct` | Non-inverter DC system losses | % | 14 | 0–99 |
| `pvInverterEfficiencyPct` | Inverter efficiency | % | 96 | 1–100 |
| `thermalModel` (radio) | Model A or B | – | A | — |
| `pvtA0`,`pvtA1`,`pvtA2` | Model A coefficients | –, –, s/m | 0.279952866, −10.52839866, −0.008135537 | finite |
| `isoEta0`,`isoA1`,`isoA2`,`isoA3`,`isoA4`,`isoA6`,`isoA8` | Model B ISO 9806 coefficients | –, W/m²K, W/m²K², J/m³K, –, s/m, W/m²K⁴ | 0.762, 3.93, 0.0095, 0, 0, 0, 0 | zero-safe parse for a3/a4/a6/a8 |
| `isoTout0`, `isoIterMax` | Newton initial T_out guess; max iterations | °C, – | 40, 5 | iter 1–10 |
| `mainsCustomEnable` + `mainsM0..11` (+`mainsQuickSet`) | Custom monthly mains override | °C | model-filled | optional |

### 10.2 Industry demand (Step 2)

Industry selector `industrySelect` (none/dairy_farm/brewery/aquatic_centres/hotel/commercial_laundry); profile `profileType` (continuous | mon_fri; disabled with struck-through text for dairy/brewery/laundry); per-industry process checkboxes (`getSelectedProcessKeys()`).

| Industry | Inputs (id → meaning, unit, default) |
|---|---|
| Dairy | `throughputInput` raw milk L/yr (5,000,000); `dairyElectricKWhPerKL` 51.7 kWh/kL; water rates L per L milk: `dairyFattyWater` 0.30, `dairyCipWater` 0.57, `dairyBoilerWater` 0.50; `dairyTargetTemp` 35 °C (15–95) |
| Brewery | `throughputInput` beer L/yr (500,000); `breweryElectricKWhPerHL` 11.5 kWh/hL; water L per L beer: `breweryCipWater` 0.80, `breweryRinseWater` 0.45, `breweryBoilerWater` 0.60; targets: `breweryCipTarget` 45 °C, `breweryRinseTarget` 40 °C |
| Hotel | `hotelRoomsInput` 147 rooms; `hotelOccupancyInput` 73.4 %; per occupied-room-night kWh: `hotelDhwKWh` 4.5, `hotelKitchenKWh` 1.6, `hotelLaundryKWh` 1.2, `hotelPoolKWh` 4.2; `hotelElectricKWh` 15; optional meter calibration: `hotelMeasuredAnnualFuelGj` or 12× `hotelMeter<Mon>FuelGj` (GJ) + `hotelApplyMeterCalibration` checkbox |
| Aquatic centre | water-surface areas m²: `aquaticIndoorArea` 350, `aquaticOutdoorArea` 250, `aquaticKidsArea` 90, `aquaticSaunaArea` 25 (each with a process on/off checkbox); `aquaticPoolCover` checked; `aquaticElectricKWhPerM2` 250 kWh/m²/yr; `aquaticEvaporationScale` 1 (0–3); `aquaticMakeupScale` 1 (0–3) |
| Commercial laundry | `laundryKgPerDay` 1500; `laundryOperatingDaysPerWeek` 6 (0–7, halves allowed); `laundryWashTempC` 60 (20–95); `laundryWaterUseLPerKg` 10; scenario dropdown `laundryWaterScenario` (10/12/15/17/22 L/kg sensitivity cases); `laundryHotWaterFraction` 0.65 (0–1); `laundryWarmRinseFraction` 0.20; `laundryWarmRinseTempC` 35 (15–60); `laundrySystemLossFraction` 0 (0–1) |

Note: the hotel branch derives throughput as `rooms × 365 × occupancy/100` occupied room-nights (`js/app.js` hotel branch); the generic `throughputInput` is not used for hotel or aquatic. **[VERIFIED-CODE]**

### 10.3 Economics

| Input id | Meaning | Unit | Default | Clamp |
|---|---|---|---|---|
| `electricityPrice` | Grid electricity price | AUD/kWh | 0.27 | ≥0 |
| `feedInTariffInput` | Export feed-in tariff | AUD/kWh | 0.06 | ≥0 |
| `gasPriceInput` | Natural gas price | AUD/MJ | 0.020 | ≥0 |
| `boilerEffInput` | Existing boiler efficiency | fraction | 0.85 | 0.5–1 |
| `gridEmissionFactor` (select) | Grid emission factor by region | kg CO2-e/kWh | 0.62 national (options 0.20–0.78, DCCEEW NGA 2025) | ≥0 |
| `capexInput` | Installed cost | AUD/m² | 800 | ≥0 |
| `autoCapexFromWatts` + `pvInstalledCostPerW` 1.20, `thermalInstalledCostPerW` 1.50 | $/W → $/m² auto-fill (`getInstalledCostBasis()`: (pv$ + th$)/W × η_PV×1000 W/m²) | AUD/W | on | — |
| `opexRateInput` | Annual OPEX as % of CAPEX | %/yr | 1.5 | ≥0 |
| `systemLifeInput` | System lifetime N | years | 25 | ≥1 integer |
| `discountRateInput` | Discount rate i | % | 6 | ≥0 |

Economics inputs use finite-check parsing (`getInputNumber`) so an explicit 0 is honoured (fix C2 in `docs/audit-report-2026-07.md`; locked by `validation/unit/test_input_parsing.mjs`). **[VERIFIED-RUN]** (test executed, 30/30 pass.)

### 10.4 External inputs

| Source | Fields consumed | Units |
|---|---|---|
| Nominatim | lat, lon, display name, country code | °, °, —, — |
| Backend `/tmy` (contract 2.1) | `dayN` (1–365), `hourN` (1–24 → normalized 0–23), `solarHour` (0–24 true solar time), `utcTimestamp`, `dni`, `dhi`, `ghi` (W/m²), `ta` (°C), `vwind` (m/s, 10 m), `relativeHumidityPct` (0–100), `infraredHorizontalWm2` (W/m², provenance/export only) | as listed |

---

## 11. Output register

| Output | Unit | Source | Notes |
|---|---|---|---|
| Annual PVT electricity `E_pvt_ac_kWh` (headline `E_pv_kWh`) | kWh/yr (net AC) | supply loop in `calcAnnualPVT()` | headline/economics use AC after losses + inverter |
| Annual PV-only baseline `E_pv_standalone_ac_kWh` | kWh/yr (net AC) | same | uses uncooled NOCT cell temperature |
| Gross DC (`E_pvt_dc_kWh`, `E_pv_standalone_dc_kWh`) and STC (`E_pv_stc_kWh`) | kWh/yr | same | visible in detail tables + CSV only |
| Annual thermal yield `E_th_kWh` | kWh/yr | Model A/B | clamped ≥ 0 per hour |
| Hourly CSV | per-hour: dayN, hourN(1–24), G W/m², η_th, PVT DC/AC kWh, PV-only DC/AC kWh, th kWh, flow kg/h, Tin/Tout °C, PV/PVT panel °C, pv/pvt factors, AC delivery factor, daytime-sample flag | `out.push(...)` rows | rounded for readability |
| Monthly/daily supply tables + charts | kWh, °C | `aggregateMonthlyAll()`, `aggregateDailyAll()` | keyed on TMY `dayN` (timezone-safe; fix C1) |
| Industry: total thermal/electrical demand; matched (`metBySupply`/`metByPv`), unmet, excess; solar fractions | kWh/yr, fractions | `calculateHourlyEnergyBalance()` / `...ElectricityBalance()` | per-month arrays too |
| Storage upper bound | fraction | `calculateMonthlyEnergyBalance()` | labelled "ideal storage" bound only |
| Savings: electrical, export, thermal fuel, total | AUD/yr | industry branches | see §12.9 |
| Supply-card economics: SPP, NPV, CRF, LCOE, LCOH, combined LCOE | yr, AUD, –, AUD/kWh | supply section of `calcAnnualPVT()` | 100%-utilisation upper bound, labelled |
| Avoided emissions | t CO2-e/yr | `calculateAvoidedEmissionsTonnes()` | grid + displaced gas |
| Mains model display | °C monthly table + chart | `updateMainsDisplay()`, `buildMainsChartSvg()` | reference + distance shown |
| Design explorer | kWh, %, m² | `calculateDesignExplorerScenario()` | full hourly recompute per area |
| Share link | base64 `#s=` payload | `buildShareScenarioPayload()` | schema-versioned; no weather embedded |
| Report / email | HTML document | `buildPdfTemplateDocument()`, `POST /email-report` | state-first content |

---

## 12. Engineering models, equations, variables and units

Everything in this section is **[VERIFIED-CODE]** (read directly from `js/app.js` at the audited commit), with test evidence noted per model. Temporal basis: all models run per hour on the 8,760-record TMY; energies are kWh per hourly step (power in W × 1 h ÷ 1000), annual figures are sums over the year.

### 12.1 Solar position — class `TiltedSurfaceRadiation`

- Declination (Cooper): `δ = 23.45 · sin(360/365 · (n + 284))` [°], n = day of year 1–365.
- Hour angle: `ω = 15 · (h − 12)` [°], where h is **true solar time** `solarHour` from the backend when finite, else clock `hourN` (fallback for older backends) — selection in `calculatePvtThermalSample()`.
- Zenith: `cos θz = sin δ sin φ + cos δ cos φ cos ω` (φ latitude; acos clamped to [−1,1]).
- Incidence on tilted plane (Duffie–Beckman form): five-term expression in `incidenceAngle()` with surface azimuth transformed as `γ = surfaceAzimuth − 180` because the UI convention is 0° = north (southern-hemisphere-friendly) while the formula's zero is south.
- Documented Cooper error ±1.4°; zenith RMS ≈ 0.4° vs pvlib after the solar-time fix (`validation/VALIDATION_RECORD.md`). **[DOC-ONLY]** for those error magnitudes; the underlying comparison scripts exist in `validation/scripts/`.

### 12.2 Plane-of-array irradiance (isotropic transposition) — `TiltedSurfaceRadiation.calculate()`

```text
DNI, DHI ≥ 0 enforced;  cosθz > 1e-6 gates beam terms (sun above horizon)
BHI      = DNI · max(0, cos θz)                      [W/m²]
GHI      = BHI + DHI                                  (reconstructed, not read from data)
Beam_POA = DNI · max(0, cos θi)
Diff_POA = DHI · (1 + cos β)/2
Grnd_POA = GHI · ρ · (1 − cos β)/2
G = POA  = max(0, Beam + Diff + Grnd)                [W/m²]
```

β = tilt, ρ = albedo. Perez transposition is deliberately **not** used in production (benchmark-only; `docs/model-specification.md`), partly because the thermal model coefficients were calibrated against this irradiance basis. Validation: golden-reference test vs pvlib isotropic — POA and PV-only annual within 0.2% for Sydney/Melbourne/Perth. **[VERIFIED-RUN]** (`test:golden-reference` 9/9, `test:solar-e2e` table: −0.02%/+0.01%/−0.08% executed this audit).

### 12.3 PVT thermal Model A (frozen) — `calculatePvtThermalSample()`, branch `thermalModel === "A"`

```text
if G > 1e-6:   η_th = clamp( a0 + a1·(T_in − T_a)/G + a2·u_wind , 0, 1 )
               Q̇_th = η_th · G · A          [W]
else:          η_th = 0, Q̇ = 0
```

Variables: T_in = mains inlet [°C] (from `mains.byDay[dayN]`, fallback annual avg, final fallback 14 °C); T_a ambient [°C]; G POA [W/m²]; u_wind 10 m wind [m/s]; A area [m²]. Defaults a0 = 0.279952866, a1 = −10.52839866 (negative ⇒ heat loss when T_in > T_a), a2 = −0.008135537. Reduced temperature uses **inlet** (not mean fluid) temperature — an inlet-based efficiency curve; coefficients must not be mixed with ISO (mean-based) sets. The [0,1] clamp suppresses negative (night-loss) efficiency. Frozen: equation + numeric locks in `validation/unit/test_pvt_models.mjs`. **[VERIFIED-RUN]** (11/11 pass; hand case η = 0.645, Q̇ = 10,320 W).

### 12.4 PVT thermal Model B (frozen) — ISO 9806 Eq. 12 with Newton iteration, branch `else`

```text
T_m = (T_in + T_out)/2 ;  ΔT = T_m − T_a
Q̇ = A·[ η0·G − a1·ΔT − a2·ΔT² − a3·u·ΔT + a4·(E_L − σ·T_aK⁴) − a6·u·G − a8·ΔT⁴ ]
E_L = 5.31e-13 · T_aK⁶        (Swinbank clear-sky long-wave; T_aK in kelvin)
σ = 5.67e-8 W/m²K⁴            (STEFAN_BOLTZMANN_W_M2_K4)
```

T_out is solved by Newton iteration on `f(T_out) = ṁc_p(T_out − T_in) − Q̇(T_out) = 0` with `ṁc_p = (flow kg/h ÷ 3600) × 4184` [W/K], analytic derivative `dQ̇/dT_out = A(−a1/2 − a2·ΔT − a3·u/2 − 2·a8·ΔT³)`, initial guess `isoTout0` (40 °C), max `isoIterMax` (5) iterations, convergence step < 1e-4, guarded against near-zero denominators. Final `Q̇` clamped ≥ 0; `η_th = clamp(Q̇/(G·A), 0, 1)`. Requires `G > 1e-6` **and** flow > 0. Defaults: η0 = 0.762, a1 = 3.93 W/m²K, a2 = 0.0095 W/m²K², a3 = a4 = a6 = a8 = 0. Known trap (frozen, documented): typing 0 into η0/a1/a2/Tout0/iterMax silently restores defaults (`||`-style fallback), while a3/a4/a6/a8 honour 0. No divergence guard or convergence flag beyond the iteration cap. PVGIS `IR(h)` is **prohibited** from entering Model B (long-wave uses Swinbank only) — enforced by policy and `test:weather-contract`. **[VERIFIED-RUN]** (locks: Q̇ = 11,515.064590968854 W, η = 0.7196915369355533).

### 12.5 Outlet temperature (both models)

`T_out = T_in + Q_kWh·3600 / (ṁ_kg/h · 4.184)` [°C] — dimensionally exact restatement of Q = ṁ·c_p·ΔT with c_p = 4.184 kJ/kg·K, water density 1 kg/L implicit. Total flow `ṁ = flowRate [L/s/m²] × A × 3600` [kg/h]. Blank when no heat/flow.

### 12.6 PV electrical model and DC→AC boundary

```text
pv_stc_kWh   = η_PV · G · A / 1000                          (per hour; P_STC = η_PV·1000 W/m² implicit)
T_cell,PV    = T_a + (G/800)·(NOCT − 20)                    (calcNoctPanelTempC; = T_a at night)
T_cell,PVT   = T_cell,PV − Q̇_cooling/(U_L·A)               (calcPvtPanelTempC; clamped to [T_in, uncooled])
               where Q̇_cooling = ṁc_p(T_out−T_in) (preferred) or Q̇_th; U_L = |a1| of the active model
factor       = max(0, 1 + γ·(T_cell − 25))                  (γ entered %/°C, ÷100 once)
pv_only_dc   = pv_stc · factor(T_cell,PV)
pvt_dc       = pv_stc · factor(T_cell,PVT)                  (= pv_only_dc if cooling toggle off)
ac_delivery  = (1 − systemLoss%) · inverterEff%             (calcPvAcDeliveryFactor)
pv_only_ac   = pv_only_dc · ac_delivery ;  pvt_ac = pvt_dc · ac_delivery
```

Headline cards, economics, charts and industry matching all use **net AC** (`pv_kWh = pvt_ac_kWh`); gross DC and STC remain in detail tables/CSV. The PVT **cooling gain** (PVT cell cooler than PV-only ⇒ more electricity) is a bounded heuristic — U_L borrowed from the thermal model's a1, capped so the cooled panel is never below T_in nor above the uncooled temperature — and is **not validated against paired field measurements** (stated in `docs/model-specification.md`; also §21). Disabling `pvtCoolingSensitivityEnable` makes PVT and PV-only identical electrically. Tests: `test:pv-boundary`, `test:panel-temperature` executed, pass. **[VERIFIED-RUN]**

### 12.7 BC-Aus mains-water temperature model — `calculateLocalTMains()`

Burch–Christensen (NREL) form, computed in °F then converted, per day d = 1–365:

```text
reference   = geographically closest of {Rockhampton z1, Alice Springs z2, Sydney z3, Melbourne z4}
              (haversineKm(); Canberra z5 excluded — its source deck is ASHP-only)
ratio = ratioC0 + ratioC1·(T̄a,F − 44) ;  lag = lagC0 + lagC1·(T̄a,F − 44)
modelDay    = d (lat ≥ 0)  |  ((d + 181) mod 365) + 1   (southern-hemisphere 182-day shift)
angle [°]   = 0.986·(modelDay − 15 − lag) − 90
T_mains,F   = (T̄a,F + offsetF) + ratio · (ΔT_month,F / 2) · sin(angle)
```

T̄a = annual mean ambient from the loaded TMY; ΔT_month = max−min monthly mean ambient. Zone constants live in `js/bc_aus_zone_constants.js` (auto-generated by `tools/fit_bc_aus_by_zone.py`; per-zone RMSE 0.50–0.95 °C vs the CER (Clean Energy Regulator) deck monthly references, overall 0.705 °C; fixture SHA-256 identity recorded per zone). Output: `byDay`, `byMonth`, annual/min/max, plus provenance (reference name, distance km, selection method, source fixture). The result feeds T_in everywhere (supply loop, dairy/brewery/laundry/aquatic makeup ΔT). Users may override monthly values (`getEffectiveMains()`), producing a step profile. This is an engineering approximation, **not** an official CER postcode determination nor AS/NZS 4234:2021 data (stated in-model and in docs). Tests: `test:mains-zones` (identity, nearest-reference runtime, generator equivalence) executed, pass. **[VERIFIED-RUN]**

### 12.8 Industry demand models

All demand series are hourly kWh arrays aligned with the TMY records; process schedules use **clock** `hourN` and `dayN` (day 1 = Monday convention for weekday logic; TMY has no real weekdays). Seasonal factor arrays are normalized so the day-weighted annual mean is exactly 1.0 (`normalizeSeasonalFactors()`), preserving annual benchmarks.

**Dairy (`calcDairyHourlyDemand`)** — throughput T_L = milk L/yr; per process p ∈ {fatty_film_rinse k=0.30, cip_preheating k=0.57, boiler_preheat k=0.50} with editable k [L water / L milk] and common editable target 35 °C:

```text
V_h  = T_L·k/365 · seasonal(month) · w24(hour)          [L]   (w24 normalized to Σ=1/day)
Q_h  = V_h · 4.184 · max(0, T_target − T_mains,day) / 3600   [kWh]
Elec_h = (kWh/kL · T_L/1000)/365 · seasonal · w24_elec(hour)  (51.7 kWh/kL default)
```

Continuous operation only (biological). Seasonal array `DAIRY_SEASONAL` peaks Oct–Nov (spring calving).

**Brewery (`calcBreweryHourlyDemand`)** — same structure; processes cip_prerinse k=0.80 → 45 °C, bottle_keg_rinse k=0.45 → 40 °C, boiler_preheat k=0.60 → 45 °C; electricity 11.5 kWh/hL (`annualElec = kWh/hL/100 × L`); seasonal peaks in summer months (Dec–Jan). Year-round operation (no weekday scaling yet — code comment).

**Hotel (hotel branch of `calcAnnualPVT`)** — throughput = rooms × 365 × occupancy; per process annual kWh = throughput × kWh/occupied-room-night (domestic hot water (DHW) 4.5, kitchen 1.6, laundry 1.2, pool 4.2), distributed over the year by `hotelProcessWeight()` = hourly weight × monthly factor (per-process 24-h and 12-month arrays), normalized by `hotelProcessWeightSum()` so annuals are preserved exactly. Mon–Fri profile compresses laundry/kitchen into weekday 9–17. Electrical: 15 kWh/room-night shaped by `HOTEL_ELECTRICAL_HOURLY` × `HOTEL_ELECTRICAL_MONTHLY` × ambient-driven factor (`calcHotelElectricalWeatherFactor`, cooling/heating degree slopes clamped to min/max). Optional **Reality Check** (`getHotelRealityCheck`): metered fuel GJ (annual or 12 months) × `GJ_TO_KWH` (=1000/3.6) × boiler efficiency ⇒ useful heat; optional calibration scales the modelled heat profile to the meter; a coverage sensitivity band re-runs matching at ±uncertainty. No storage tank model exists (removed at commit `ff096e9`; a UI note states heat only counts in-hour).

**Aquatic centre (`calcAquaticHourlyDemand`)** — per pool type (indoor/outdoor/kids/sauna; parameters in `AQUATIC_PROCESS_PARAMS`: target °C 27/27/30/35, depth m, makeup L/m²/day, convective+radiative U W/m²K, evaporation coefficient, splash multipliers, indoor RH/air offset):

```text
p_w  = Tetens saturation vapour pressure at T_target [kPa]  (0.61078·e^(17.2694T/(T+237.3)))
p_a  = Tetens(T_air) · RH        (outdoor pool: PVGIS RH/100 when valid 0–100; else fixed design RH)
evap = coeff·(1 + 0.22·u_wind)·max(0,p_w−p_a)·splash·evapScale·[×(1−0.60) if covered & closed]  [kg/m²·h]
Q_evap = evap · A · 0.680 kWh/kg latent
Q_makeup = (L/m²/day ÷ open-hours)·A·makeupScale·c_p,kWh·max(0, T_target − T_mains,day)   (open hours only)
Q_sens = (U_conv+U_rad)·A·max(0, T_target − T_air)/1000
```

Indoor air temperature = max(ambient, target − indoor offset). Schedules: continuous 06–22 daily or Mon–Fri 07–20. Electrical demand = area × 250 kWh/m²/yr, split 55% base (uniform by month-hours) + 45% tracking the monthly thermal shape (`buildAquaticElectricalHourlyDemand`). Water constants: `WATER_CP_KWH_PER_KG_C = 4.184/3600`, `EVAP_LATENT_KWH_PER_KG = 0.680`.

**Commercial laundry (`calcCommercialLaundryHourlyDemand`)** — annual kg = kg/day × days/week × 52 (364-day internal year, consistent); mass distributed uniformly over shift hours 08–17 on operating days (fractional days supported):

```text
Q_wash  = kg_h · L/kg · hotFraction  · c_p,kWh · max(0, T_wash  − T_mains,day)
Q_rinse = kg_h · L/kg · rinseFraction· c_p,kWh · max(0, T_rinse − T_mains,day)
Q_loss  = (selected wash + rinse heat) · lossFraction
```

Hot-water washing **only**; drying/ironing/steam/motors/electricity are explicitly out of scope (`scope` string in the return value; electrical series is all zeros).

Evidence classification for all five industries is displayed in-app via `INDUSTRY_EVIDENCE` (scenario labels, e.g. "NABERS v4.3 is whole-building evidence and does not validate the per-process decomposition"). Tests executed: `test:industry` 43/43, `test:industry-evidence`, `test:hotel-reality`, all pass. **[VERIFIED-RUN]**

### 12.9 Supply/demand matching, economics, emissions

**Hourly matching (`calculateHourlyEnergyBalance`)** — the headline, storage-free baseline:

```text
per hour: matched = min(S_h, D_h); unmet = max(0, D_h−S_h); excess = max(0, S_h−D_h)
solarFraction = Σmatched / Σdemand      (+ per-month matched/unmet/excess/supply/demand arrays)
```

Loop length = min(supply, demand, met) so totals always reconcile with monthly buckets. `calculateMonthlyEnergyBalance` (month-level min) is retained **only** as the labelled "ideal storage" upper bound. Electrical matching reuses the same function (`calculateHourlyElectricityBalance`).

**Savings (each industry branch, identical formulas):**

```text
electricalSavings = matched_e · electricityPrice          [AUD/yr]
exportSavings     = excess_e · feedInTariff
thermalFuelSavings= matched_th · 3.6 / boilerEff · gasPrice   (kWh→MJ heat →MJ fuel →AUD)
```

**Supply-card economics (upper bound, 100% utilisation of both streams, labelled):**

```text
CAPEX = capexPerM2·A ;  OPEX = CAPEX·opexRate
CRF   = i(1+i)^N / ((1+i)^N − 1)     (i→0 limit: 1/N)
NPV   = −CAPEX + netBenefit · (1 − (1+i)^−N)/i          (i→0: −CAPEX + netBenefit·N)
SPP   = CAPEX / netBenefit
LCOE  = (CAPEX·pvShare·CRF + OPEX·pvShare)/E_pv ;  LCOH analog with thShare
combined LCOE = (CAPEX·CRF + OPEX)/(E_pv + E_th·f_th2e),  f_th2e = 1
```

f_th2e = 1 equates 1 kWh heat to 1 kWh electricity **for the CAPEX share split only** — a simplification, not an exergy weighting (explicit code comment + UI note).

**Avoided emissions (`calculateAvoidedEmissionsTonnes`)**:

```text
tCO2e = [ matched_e·EF_grid + (matched_th·3.6/boilerEff/1000)·51.53 ] / 1000
```

`NATURAL_GAS_KG_CO2E_PER_GJ = 51.53` (combined Scope-1 CO2-e); grid EF from the DCCEEW NGA-2025 dropdown. Test `test:economics` (15/15, including "natural-gas factor includes CO2, methane and nitrous oxide") executed, pass. **[VERIFIED-RUN]**

### 12.10 Design explorer

`calculateDesignExplorerScenario(areaM2)` re-runs `calculatePvtThermalHourly()` (the same shared thermal function as the main model — a deliberate anti-drift design, per the code comment) at an alternative area, matched against the stored industry demand; `findDesignExplorerTargetArea(targetPct)` bisects area (≤ ~40 iterations) to hit a target heat-coverage fraction. Test `test:design-explorer` executed, pass. **[VERIFIED-RUN]**

---

## 13. Detailed calculation pathway (`calcAnnualPVT()` walkthrough)

1. **Read + validate inputs** (§10) with explicit error messages; abort on invalid.
2. **Ensure weather**: `loadTMYFromUI()` if needed → `CURRENT_MET`, `CURRENT_LOC`.
3. **Mains model**: compute once per location (`CURRENT_MAINS_MODEL`), re-derive effective mains each run so custom monthly edits apply (`getEffectiveMains`).
4. **Supply loop** over all valid records (skips rows with non-finite dayN/hourN/dni/dhi/ta/vwind): irradiance → thermal sample (Model A/B) → T_out → cell temperatures → PV DC/AC (per §12.6) → accumulate `E_*` totals, push `pvtThermalHourly`, `pvElectricHourly`, `hourlyRows`, CSV rows.
5. **Supply results**: economics upper-bound card (§12.9), monthly/daily/temperature charts and tables (`aggregateMonthlyAll`/`aggregateDailyAll`, keyed on `dayN` — no Date round-trips), PVGIS cross-check link (`buildPvgisValidationLink()` converts the app's loss inputs into an equivalent PVGIS loss% and azimuth convention).
6. **Industry branch** (if selected): build demand (§12.8) → hourly + monthly balances → savings → `configureDesignExplorer(demandHourly)` → performance summary, process breakdown, storage note, heat/electricity balance tables, savings table, chart set; hotel additionally Reality-Check calibration + coverage sensitivity band.
7. **State + exports**: populate `CURRENT_CALC_RESULT` (single source for CSV/report/share; enforced by `test:export-share`), reveal action buttons, scroll to results.

Error handling: user-facing `setOutput(msg, true)` messages for invalid inputs/empty TMY; `finally` re-enables the calculate button; network layer has timeouts, health-gating, localStorage caching, remote-warmup (`warmHostedTMYService()`), and a `LOAD_REQUEST_SEQ` guard against out-of-order async loads. **[VERIFIED-CODE]**

---

## 14. Constants, defaults and assumptions register

Hard-coded physical constants: σ = 5.67e-8 W/m²K⁴; Swinbank 5.31e-13; c_p = 4.184 kJ/kg·K (water, ρ = 1 kg/L implicit); latent heat 0.680 kWh/kg; Tetens coefficients; NOCT reference (G/800, −20 °C); STC cell 25 °C; gas 51.53 kg CO2-e/GJ; GJ→kWh = 1000/3.6; 3.6 MJ/kWh. **[VERIFIED-CODE]**

Configured defaults (user-editable): everything in §10; Model A/B coefficients (`DEFAULT_MODEL_COEFFS`); site defaults (`DEFAULT_SITE_SETTINGS`); industry parameter objects (`DAIRY_*`, `BREWERY_*`, `HOTEL_*`, `AQUATIC_*`, `LAUNDRY_DEFAULTS`).

Hard-coded behavioural assumptions (not user-editable):

| Assumption | Location |
|---|---|
| 365-day year, no Feb 29, no DST in demand scheduling | whole pipeline; backend clock policy |
| dayN 1 behaves as a Monday for weekday logic | `isMonToFriDay()` |
| Aquatic schedules 06–22 / weekday 07–20; cover cuts evaporation 60% when closed | `AQUATIC_*_HOURS`, `AQUATIC_COVER_REDUCTION` |
| Laundry shift 08–17 | `LAUNDRY_DEFAULTS.startHour/endHour` |
| Aquatic electricity split 55% base / 45% thermal-shaped | `AQUATIC_ELEC_BASE_SHARE` |
| Hotel electrical weather response slopes/clamps | `HOTEL_ELECTRICAL_WEATHER_PARAMS` |
| Seasonal factor arrays (dairy, brewery, hotel monthly) | respective constants |
| PV daytime-sample window for temperature averaging: G > 50 W/m², hours 10–16 | `PV_DAYTIME_TEMP_*` |
| U_L for the cooling heuristic = |a1| of active thermal model | `getPvtPanelHeatLossCoeff()` |
| No storage in headline matching; monthly bound labelled "ideal storage" | §12.9 |
| Supply-card value assumes 100% utilisation of both streams (upper bound) | supply economics |
| f_th2e = 1 for CAPEX split | §12.9 |

A fuller assumptions table with UI-disclosure status is maintained in `docs/audit-report-2026-07.md` §E. **[DOC-ONLY]** for the disclosure-status column; the assumptions themselves are code-verified.

---

## 15. External APIs, libraries and datasets

| Dependency | Used for | Reference in repo |
|---|---|---|
| PVGIS 5.3 TMY API (EC JRC) | weather; fetched server-side via `pvlib.iotools.get_pvgis_tmy` (usehorizon=True, 2005–2023, coerce_year=1990, versioned URL) | `pvt-tmy-api/server.py` |
| pvlib 0.15.0 | PVGIS client, equation of time (Spencer71), validation references | backend + `validation/scripts` |
| OpenStreetMap Nominatim | address geocoding (browser-side, cached, AU-biased) | `geocodeAddress()` |
| Chart.js 4.5.1 (vendored) | supply charts | `assets/vendor/` |
| Playwright 1.61.1 | browser + live tests | `validation/browser/` |
| CER DomDecks `.inc` decks (5 zones) | mains-model fitting + fixtures (SHA-256-pinned) | `validation/fixtures/cer/`, `tools/fit_bc_aus_by_zone.py` |
| EnergyPlus/OneBuilding TMYx `.stat` (5 sites) | ground-temperature cross-check pages | `validation/fixtures/energyplus/` |
| PVGIS/PVWatts/Renewables.ninja/GSA JSON extracts | PV external benchmark | `validation/reference/pv-benchmark/` |
| SOAC field dataset (19 days, 5-min) | field validation | `validation/field-data/soac-mar-2026/` |
| DCCEEW NGA Factors 2025 | emission factors (dropdown + gas constant) | `index.html`, `js/app.js` |
| NABERS / SA Water / Sydney Water / ASHRAE / WELS etc. | industry model bases (cited in model-basis modals) | `build*ModelBasisHtml()` |

Backend provenance: every `/tmy` response embeds `provenance` (contract version, PVGIS version/URL/request, database name, library versions, canonical `datasetSha256` of the records, record count, clock policy, weather-field policies). **[VERIFIED-CODE]**

---

## 16. Data processing and temporal aggregation

- **Clock policy (backend, contract 2.1)**: `dayN`/`hourN` form a synthetic 365×24 local-**standard**-time calendar (non-DST UTC offset, evaluated at year-2001 anchors) — unique keys, deliberately free of historical 1990 DST rules; `utcTimestamp` preserves the synthetic UTC sequence; `solarHour` = true solar time from UTC + longitude/15 + equation of time (Spencer71), used **only** for solar geometry. Demand scheduling always uses clock `hourN`. Backend RH validated 0–100 (hard error otherwise); IR(h) must be finite, sign preserved (can be negative at night). **[VERIFIED-CODE]**, unit-tested by `validation/backend/test_backend_solarhour.py` (6/6 executed). **[VERIFIED-RUN]**
- **Frontend normalization**: `normalizeWeatherRecords()` maps `hourN` 1–24 → 0–23, tolerates legacy field-name variants, passes `solarHour` through.
- **Monthly/daily aggregation**: `monthFromDayN`/`monthDayFromDayN` on the fixed 365-day calendar; no JavaScript `Date` round-trips anywhere in aggregation (regression-locked after bug C1, which had shifted days in non-UTC browsers). `aggregateMonthly` buckets hourly arrays by `dayN`. `test:supply-aggregation` (58/58) executed. **[VERIFIED-RUN]**
- **Power vs energy**: instantaneous W (Q̇, irradiance W/m²) converted to kWh per hourly step by ÷1000×1 h; annual = Σ hourly. Peak kW is max hourly kWh (1-h basis).

---

## 17. Frontend, backend and visualisation behaviour

- UI structure: Step 1 (site/system) → Step 2 (industry/economics) → Calculate → results panels; modals for climate charts, process diagrams, per-process usage, model bases, how-it-works. Demand-side charts are hand-built inline SVG (`buildMonthlyBarChart`, `buildSupplyDemandLineChart`, `build8760DemandChart`, heatmap); supply-side charts use Chart.js canvases. **[VERIFIED-CODE]**
- State globals: `CURRENT_LOC`, `CURRENT_MET`, `CURRENT_MAINS_MODEL`, `CURRENT_MAINS`, `CURRENT_CALC_RESULT`, `CURRENT_PROCESS_DETAIL`, `CURRENT_DESIGN_EXPLORER`, `CURRENT_WEATHER_PROVENANCE`.
- Persistence/share: inputs auto-saved to localStorage; `#s=` share links (schema-versioned payload; v1 flat links still readable); "Reset inputs" clears stored state.
- Backend routes: `GET /health` (release gate), `GET|POST /tmy` (synchronous handlers deliberately run in FastAPI's thread pool so `/health` stays responsive), `POST /email-report`. CORS `*`. In-memory 24 h TMY cache keyed by contract version + coordinates + rotation.

---

## 18. Validation pages (`pages/`)

| Page | Purpose |
|---|---|
| `validation-hub.html` | Plain-language summary of all validation evidence and limits (linked "Validation" in header) |
| `validation.html` / `validation2.html` | BC-Aus vs CER references (+6 °F offset variant / 0 °F variant) |
| `validation3.html` / `validation4.html` | BC-Aus vs EnergyPlus ground temperatures at 0.5 m / 2.0 m |
| `validation5.html` | Step-by-step BC-Aus formula explainer |
| `cer_comparison.html` | Interactive CER DomDecks comparison tool |
| `soac-field-validation.html`, `soac-field-comparison.html` | SOAC measured-field validation, model-gap analysis |
| `pv-external-validation.html` | PV-only comparison vs PVGIS/PVWatts/regional benchmark across five Australian cities |

Page titles and linkage verified; page-internal computations were **not** audited line-by-line (they are cross-checked by `test:pv-external-validation` and `test:soac-validation`, both executed and passing). **[VERIFIED-RUN]** for those wirings.

---

## 19. Testing and validation audit

### 19.1 Executed during this audit (2026-07-20)

`npm test` (offline suite, 21 scripts chained in `package.json` → `test:offline`) — **all passed**; no network needed (Python step runs mocked). Printed assertion counts:

| Suite | Script | Result | What it demonstrates | What it does NOT demonstrate |
|---|---|---|---|---|
| Geometry | `validation/unit/test_geometry.mjs` | 17/17 | Cooper declination, zenith, azimuth convention, POA edge cases vs hand values | absolute POA accuracy (that's the golden test) |
| Industry | `test_industry.mjs` | 43/43 | benchmark preservation, Q=mc_pΔT, aquatic physics + RH policy + daily-mains behaviour, hotel weighting, laundry algebra | that the default intensities describe any real facility |
| Industry evidence | `test_industry_evidence.mjs` | pass (summary) | evidence-class labelling + editable scenarios wired | — |
| Economics | `test_economics.mjs` | 15/15 | CRF/NPV/LCOE/payback/heat-conversion/emissions arithmetic | market realism of default prices |
| PV boundary | `test_pv_boundary.mjs` | pass | DC/AC boundary + cooling-effect wiring | physical validity of cooling gain |
| Panel temperature | `test_panel_temperature_model.mjs` | pass | NOCT/PVT cell-temperature equations | field accuracy of cell temperatures |
| PV external validation | `test_pv_external_validation.mjs` | pass | benchmark JSON + page wiring | — |
| Solar E2E | `verify_js_e2e.mjs` | table only (no assertions) | app-vs-pvlib annual kWh: Sydney −0.02%, Melbourne +0.01%, Perth −0.08% | — |
| Golden reference | `test_golden_reference.mjs` | 9/9 | POA + PV-only within 0.2% of pvlib isotropic (3 cities); Perez stays benchmark-only | agreement with Perez/PVWatts (≈4% higher by design) |
| PVT model locks | `test_pvt_models.mjs` | 11/11 | Model A/B equations byte/numerically locked | **scientific validity of the models** (explicitly: locks ≠ validation) |
| SOAC validation | `test_soac_field_validation.mjs` | pass | field-data extraction/statistics/page wiring | that the model matches the field (it doesn't — 0.63×, §19.3) |
| Weather fixtures | `test_weather_fixtures.mjs` | 119/119 | 7 locked 8,760-h fixtures: schema, fields, solarHour, checksums | that live PVGIS still returns identical data |
| Weather contract | `test_weather_contract.mjs` | pass | 2.1 release-gate + RH/IR separation logic | live deployment state |
| Backend solarHour | `validation/backend/test_backend_solarhour.py` | 6/6 (Python unittest, mocked PVGIS) | contract fields, DST-free clock, rotation, thread-pool routing | live PVGIS interaction |
| Mains zones | `test_mains_zones.mjs` | pass | zone identity vs raw decks, nearest-reference runtime, generator equivalence | accuracy vs real measured mains temperatures |
| No-NaN | `test_no_nan.mjs` | 13/13 | all locked JSON finite | — |
| Export/share | `test_export_share_state.mjs` | 20/20 | exports/report/share read calculation state first | visual correctness of the report |
| Supply aggregation | `test_supply_aggregation.mjs` | 58/58 | timezone-independent monthly/daily bucketing; balance reconciliation; source locks | — |
| Input parsing | `test_input_parsing.mjs` | 30/30 | explicit-0 semantics; frozen Model-B parsing untouched | — |
| Design explorer | `test_design_explorer.mjs` | pass | hourly recalculation + target-area search | — |
| Hotel reality check | `test_hotel_reality_check.mjs` | pass | meter-calibration arithmetic | correctness of any actual meter data |

Also executed: live read-only `GET /health` on the hosted backend — contract 2.1 confirmed ready (§7). **[VERIFIED-RUN]**

### 19.2 NOT executed during this audit (and why)

| Command | Why not run |
|---|---|
| `npm run test:browser` | requires a one-time Playwright Chromium download; outside the offline scope of this audit. CI runs it on every push (last documented result 3/3 pass — **[DOC-ONLY]**) |
| `npm run test:links` | live network sweep of ~30 external URLs; transient 403s make it non-deterministic (last documented: 26 OK / 4 review / 0 broken — **[DOC-ONLY]**) |
| `npm run test:live-industries` | drives the deployed site + live backend across 15 scenarios; heavy live traffic, needs Chromium (last documented 2026-06-30: 15/15 with known solarHour failures that predate the backend redeploy — **[DOC-ONLY]**) |
| `npm run test:live-backend-contract` | 10-location live PVGIS pulls through the hosted service; recommended as the definitive post-deploy gate (§24) |
| `npm run fixtures:weather` | intentionally **prohibited** during an audit — it rewrites the locked weather baselines |
| `validation/scripts/*.py` (verify_formulas, deep_validation, prove_fix, backend_e2e) | fetch live PVGIS; their locked outputs (`validation/reference/*.json`, `fixtures/*`) were inspected instead |

### 19.3 Validation evidence by class

| Class | Evidence | Verdict |
|---|---|---|
| Numerical verification vs independent software | pvlib golden references (POA, PV annual ≤0.2%; zenith RMS ≈0.4° after solar-time fix) | strong for the supply side **[VERIFIED-RUN]** (tests) + **[DOC-ONLY]** (zenith RMS magnitudes) |
| Comparison vs published/online tools | `validation/pv-only-benchmark.md`, PV external validation page (PVGIS/PVWatts/ninja extracts, five cities); isotropic ≈4% below Perez-based tools by design | documented modelling choice, not error **[DOC-ONLY]** |
| Validation vs measured physical data | SOAC Mar-2026: 19 days, 5-min data, 5,888 kWh processed thermal energy; field median η 0.196 vs certified-ISO-driven 0.30–0.32 at matched conditions ⇒ **field ≈ 0.63× certified**; transients ≈25% of samples; T_in↔η correlation is confounded (must not be cited causally) | the calculator's certified-coefficient results are an optimistic envelope for real installations; ratio presented as real-world derating, not model refit **[VERIFIED-CODE]** (analysis documents + data files present; statistics not independently recomputed in this audit) |
| Mains-water model | fit RMSE 0.50–0.95 °C per zone vs CER decks; CER/EnergyPlus cross-check pages | good agreement with its *reference decks*; not validated against measured Australian mains temperatures **[VERIFIED-CODE]** (constants) / **[MISSING]** (measured-data validation) |
| Regression/behaviour locks | equation locks, source locks, fixture checksums, no-NaN, aggregation locks | comprehensive; note that behaviour locks characterize current behaviour and are not independent scientific validation (a point the repository's own independent audit makes) |
| System/browser tests | Playwright smoke + live industry matrix | exist; not run here **[DOC-ONLY]** |

**Key epistemic rule stated across the repo docs and honoured here: passing tests lock behaviour; they do not prove physical validity.** The weakest-validated links are (1) the PVT electrical cooling gain and (2) absolute thermal yield under real operating conditions (SOAC 0.63× finding).

---

## 20. Code / documentation / interface discrepancies

1. **[CONFLICT — resolved by live check]** Deployed-backend staleness: `docs/validation-report.md` (2026-06-29/30) and `docs/test-matrix.md` state the live Render backend returns `solarHourRecords=0`; `docs/independent-model-audit-2026-07-10.md` rates "deployed backend stale: Red". The live `/health` check executed in this audit (2026-07-20) returned contract 2.1 with `solarHour` in the required fields — the backend has since been redeployed; those documents are stale. Authoritative source: the live endpoint. Residual verification: full `/tmy` record sweep (§24.1).
2. **[CONFLICT]** Natural-gas emission factor: `docs/audit-report-2026-07.md` cites 51.4 kg CO2-e/GJ; production code uses `NATURAL_GAS_KG_CO2E_PER_GJ = 51.53` and `test_economics.mjs` asserts the combined-gas CO2-e factor. Code + test are authoritative (the change post-dates the July audit and matches the independent audit's recommendation); the older audit doc is stale.
3. **[CONFLICT]** Aquatic humidity: `docs/audit-report-2026-07.md` (§B19, C4) states "TMY has no humidity data; fixed design RH". Current contract 2.1 supplies `relativeHumidityPct`, and `getAquaticRelativeHumidity()` uses validated PVGIS RH for **outdoor** pools (indoor pools keep design RH) — confirmed by executed tests ("AQUATIC PVGIS HUMIDITY POLICY" 3/3). Code is authoritative; the audit doc predates contract 2.1.
4. **[CONFLICT]** Hotel storage tank: `docs/model-specification.md` says "storage-tank usable capacity follows the daily mains profile (v13.12)", but commit `ff096e9` ("Refine hotel analysis tools and remove storage tank") removed the tank; the only remaining reference is a UI note that **no** storage is included. Code (no tank) is authoritative; the model spec sentence is stale.
5. **[CONFLICT — historical, now consistent]** BC-Aus zone identity: the independent audit (2026-07-10) reported zone 1/zone 2 identities (Rockhampton/Alice Springs) reversed between raw decks and the registries. The current `js/bc_aus_zone_constants.js` declares zone1 = Rockhampton, zone2 = Alice Springs with per-zone fixture SHA-256 identity, and `test:mains-zones` ("reference identity … tests passed") executed green. The issue appears remediated after that audit; the audit document describes a superseded state. Residual: no measured-mains validation (§24.4).
6. **[MISSING/minor]** Version cache-busting: `index.html` loads `css/styles.css?v=13.43` but `js/app.js?v=13.42`, `APP_VERSION = "13.42"` and the visible label say 13.42. Cosmetic inconsistency only.
7. **[INFERRED/minor]** `INDUSTRY_UI` still carries throughput defaults for hotel (60,000 room-nights) and aquatic ("Water volume (L)", 5,000,000) although those industries now use rooms×occupancy and pool areas respectively; the generic values are vestigial for those two industries.
8. **[DOC-ONLY caveat]** `docs/test-matrix.md` and `docs/validation-report.md` list older, smaller assertion counts (e.g. industry 30/30, economics 12/12) than the currently executed suite (43/43, 15/15, plus suites added since: pv-boundary, panel-temperature, pv-external-validation, soac-validation, weather-contract, mains-zones, supply-aggregation, input-parsing, design-explorer, hotel-reality). The docs describe an earlier snapshot; `package.json` + the executed run are authoritative.
9. **[VERIFIED-CODE]** `data/bc_aus_constants.js` and `data/bc_zone_corrections.js` are artefacts of an earlier fitting approach (single national fit + per-zone corrections, RMSE 3.6–4.6 °C); production uses the per-zone constants in `js/bc_aus_zone_constants.js` (RMSE 0.70 °C). The older files remain in `data/` — historical, not wired into `index.html`.

---

## 21. Technical limitations and possible error sources

Physics/modelling (all acknowledged somewhere in-repo):

- **Isotropic transposition** underestimates POA ≈4% vs Perez-based tools (deliberate, conservative; also keeps Model A/B coefficient calibration consistent).
- **Cooper declination** ±1.4° (Spencer alternative documented but not applied).
- **GHI reconstructed** as BHI+DHI (feeds ground-reflection term only; <0.2% annual effect).
- **Model A** uses inlet (not mean) reduced temperature; [0,1] clamp hides night losses; wind term uses raw 10 m TMY wind.
- **Model B**: no divergence guard beyond iteration cap; no convergence flag; "0 restores default" parsing trap on η0/a1/a2/Tout0/iterMax (frozen behaviour, deliberately preserved).
- **PVT cooling gain** heuristic (U_L = |a1|) is bounded but unvalidated against paired field measurements; it feeds headline electricity and economics unless the user disables the toggle.
- **No storage** in headline matching (conservative); monthly "ideal storage" bound is an idealization.
- **TMY vs reality**: annual TMY estimates cannot be compared to short-period field measurements (explicit SOAC scope note); SOAC found field thermal efficiency ≈0.63× certified steady-state — certified coefficients are optimistic for real, intermittently operated arrays.
- **Industry defaults** are national/literature scenarios with explicit evidence classes; site variation is large; hotel process decomposition is not NABERS-validated; the laundry 10 L/kg default sits at the optimistic (high-reuse) end of Sydney Water's published ranges.
- **Mains model** is a nearest-reference engineering approximation of legacy CER decks (in-sample fit), not measured mains data nor AS/NZS 4234:2021.
- **Weekday convention**: dayN 1 = Monday is arbitrary (TMY carries no weekday).
- **Economics** omit degradation, tariff escalation, financing, maintenance step-changes; defaults are examples; `f_th2e = 1` is a simplification.
- **Numeric edge behaviour**: night hours produce zero supply; guards exist against divide-by-zero (G, flow, area, weight sums, demand totals) — no NaN paths found by scan tests.

Software/operational:

- Live PVGIS/pvlib/backend evolution can change live results; reproducibility requires locked fixtures + commit hash (documented policy).
- Nominatim geocoding quality bounds location accuracy.
- Hosted backend cold starts (~1 min) — mitigated by warm-up ping and long remote timeout.
- Single-file `js/app.js` (~7,700 lines) concentrates all logic; tests extract functions from it by source parsing, which is fragile to refactors (a repo-acknowledged trade-off).

---

## 22. Missing or ambiguous information

- **[MISSING]** Provenance of the default Model A coefficients (a0/a1/a2 fitted dataset) — described only as "prior-thesis/professor-provided"; no fitting data in the repository.
- **[MISSING]** Independent validation of Model B against a certified collector datasheet power curve at standard test points (recommended in-repo; not done).
- **[MISSING]** Measured Australian mains-water temperature validation for BC-Aus (validation is against CER reference decks and EnergyPlus ground temperatures, both models themselves).
- **[MISSING]** Any automated numeric golden test of the *full* in-browser `calcAnnualPVT()` annual outputs (browser smoke checks structure, not physics numbers) — noted as a gap in `docs/audit-report-2026-07.md` §G.
- **[MISSING]** PDF/report snapshot tests.
- **[AMBIGUOUS]** The per-sample steady-state mask for SOAC (the dataset lacks a per-sample transient flag; the analysis used a pragmatic bright-sun filter).
- **[AMBIGUOUS]** Whether the deployed GitHub Pages frontend is currently in sync with `main` (not checked in this audit; CI + Pages auto-deploy make it likely).
- **[AMBIGUOUS]** `validation/reference/deep_results.json` and some benchmark extracts: generation date/parameters are embedded in the files but were not re-derived here.

---

## 23. Thesis-relevant findings

1. **The supply side is genuinely and quantitatively validated** against pvlib (≤0.2% annual POA/PV; ≈0.4° zenith RMS) with locked fixtures and reproducible tests — a defensible methodological backbone. The isotropic-vs-Perez ≈4% conservatism is a documented, citable modelling choice.
2. **The frozen-model governance is unusually rigorous**: equation source locks + numeric locks + explicit change policy for Model A/B, separating "another student's models" from this project's contributions.
3. **The solar-time fix is a quantified original contribution**: labelling hours in clock time vs solar time caused up to 18.8° zenith error and ~1 h hourly-profile shift; the `solarHour` backend contract collapsed it (documented before/after in `validation/VALIDATION_RECORD.md`).
4. **BC-Aus mains model**: a zone-refitted Burch–Christensen sinusoid (RMSE ≈0.70 °C vs CER decks) with cryptographic fixture identity and a transparent nearest-reference selector — presentable as a reusable Australian mains-temperature approximation, with clearly stated non-official status.
5. **The SOAC field campaign** provides the honest headline: certified steady-state collector curves over-predict real intermittent-operation efficiency by ~55–60% (field ≈0.63×). A thesis should present this as a real-world derating band, not force-fit the model — and must not cite the confounded T_in↔η correlation causally.
6. **Demand models are scenario generators with explicit evidence classes** — suitable for coverage/sensitivity analysis, not facility prediction; the in-app evidence labelling is itself a defensible methodology contribution.
7. **The audit trail** (internal audit → adversarial independent audit → remediations traceable in code: emissions factor 51.4→51.53, outdoor-pool RH adoption, zone-identity fix, versioned PVGIS URL, pinned dependencies, DC→AC boundary) demonstrates an engineering-quality improvement loop worth narrating.
8. **Reproducibility discipline** (locked fixtures, dataset SHA-256, contract gating, share-link schema with reproducibility note) directly supports thesis-figure reproducibility claims.

---

## 24. Recommended human verification

1. Run `npm run test:live-backend-contract` (10-location live gate) to confirm the redeployed backend end-to-end, and refresh the stale statements in `docs/validation-report.md` / `docs/test-matrix.md` (§20.1).
2. Update `docs/model-specification.md` (hotel storage-tank sentence) and `docs/audit-report-2026-07.md` (gas factor, humidity statements) or mark them as superseded snapshots (§20.2–4).
3. Obtain/record the provenance of Model A's default coefficients (fitted dataset, conditions) before relying on its absolute yields in the thesis (§22).
4. Validate Model B against a certified ISO 9806 datasheet collector at G=1000 W/m², ΔT = 0/20/40 K (repo-recommended, still open).
5. Decide how to surface the SOAC ~0.6–0.65× real-world derating in the public calculator (currently a validation-page finding, not applied to results).
6. Verify NGA-2025 grid factors and the 51.53 kg CO2-e/GJ gas factor against the published DCCEEW tables (offline verification impossible in tests).
7. Consider a full-pipeline numeric golden test for `calcAnnualPVT()` annual outputs (§22).
8. Reconcile the cosmetic version-string mismatch (13.42 vs 13.43) at the next release.

---

## 25. Source-code traceability index

| Concept | File → symbol |
|---|---|
| App version | `js/app.js` → `APP_VERSION` (line ~6) |
| Main calculation driver | `js/app.js` → `calcAnnualPVT()` (~line 5930) |
| Solar geometry + POA | `js/app.js` → class `TiltedSurfaceRadiation` (`declinationAngle`, `hourAngle`, `zenithAngle`, `incidenceAngle`, `calculate`) |
| Thermal sample (Model A + B) | `js/app.js` → `calculatePvtThermalSample()`, `calculatePvtThermalHourly()` |
| Model coefficients defaults | `js/app.js` → `DEFAULT_MODEL_COEFFS`, `DEFAULT_SITE_SETTINGS`; UI inputs `pvtA0..2`, `isoEta0..isoIterMax` |
| NOCT / PVT cell temperature / PV factor / AC boundary | `js/app.js` → `calcNoctPanelTempC()`, `calcPvtPanelTempC()`, `getPvtPanelHeatLossCoeff()`, `calcPvTemperatureFactor()`, `calcPvAcDeliveryFactor()` |
| Mains-water model | `js/app.js` → `calculateLocalTMains()`, `findClosestBcAusSwhReference()`, `haversineKm()`, `getEffectiveMains()`; constants `js/bc_aus_zone_constants.js` → `BC_AUS_ZONE_CONSTANTS`; generator `tools/fit_bc_aus_by_zone.py` |
| Weather fetch + contract gate | `js/app.js` → `fetchTMY()`, `requireWeatherServiceHealth()`, `validateTMYContract()`, `normalizeWeatherRecords()`; endpoints `LOCAL_TMY_ENDPOINT`, `REMOTE_TMY_ENDPOINT`, `REQUIRED_TMY_CONTRACT` |
| Backend TMY + clock policy | `pvt-tmy-api/server.py` → `tmy()`, `_synthetic_demand_clock()`, `_standard_utc_offset_hours()`, routes `get_tmy`/`post_tmy`/`health_check`/`email_report` |
| Geocoding | `js/app.js` → `geocodeAddress()`, `loadTMYByAddress()`, `loadTMYFromUI()` |
| Dairy demand | `js/app.js` → `calcDairyHourlyDemand()`, `DAIRY_PROCESS_PARAMS`, `DAIRY_ELEC_PARAMS`, `DAIRY_SEASONAL`, `getDairyAssumptions()` |
| Brewery demand | `js/app.js` → `calcBreweryHourlyDemand()`, `BREWERY_*`, `getBreweryAssumptions()` |
| Hotel demand + reality check | `js/app.js` → hotel branch in `calcAnnualPVT()`, `hotelProcessWeight()`, `hotelProcessWeightSum()`, `calcHotelElectricalHourlyDemand()`, `calcHotelElectricalWeatherFactor()`, `getHotelRealityCheck()`, `HOTEL_*` constants |
| Aquatic demand | `js/app.js` → `calcAquaticHourlyDemand()`, `buildAquaticElectricalHourlyDemand()`, `saturationVaporPressureKPa()`, `getAquaticRelativeHumidity()`, `AQUATIC_PROCESS_PARAMS` |
| Laundry demand | `js/app.js` → `calcCommercialLaundryHourlyDemand()`, `laundryOperatingDayWeight()`, `LAUNDRY_DEFAULTS`, `getCommercialLaundryInputs()` |
| Seasonal normalization / schedules | `js/app.js` → `normalizeSeasonalFactors()`, `_normW()`, `isMonToFriDay()`, `hourIndexFromHourN()` |
| Hourly/monthly matching | `js/app.js` → `calculateHourlyEnergyBalance()`, `calculateHourlyElectricityBalance()`, `calculateMonthlyEnergyBalance()`, `aggregateMonthly()` |
| Chart/table aggregation | `js/app.js` → `aggregateMonthlyAll()`, `aggregateDailyAll()`, `monthDayFromDayN()` |
| Economics | `js/app.js` → supply-card block in `calcAnnualPVT()` (CRF/NPV/SPP/LCOE/LCOH), `getInstalledCostBasis()`, savings lines in each industry branch |
| Emissions | `js/app.js` → `calculateAvoidedEmissionsTonnes()`, `NATURAL_GAS_KG_CO2E_PER_GJ`, `buildSavingsTable()` |
| Design explorer | `js/app.js` → `setDesignExplorerState()`, `calculateDesignExplorerScenario()`, `findDesignExplorerTargetArea()`, `updateDesignExplorer()` |
| Exports/report/share | `js/app.js` → `buildPdfTemplateDocument()`, `buildSummaryCsv()`, `buildShareScenarioPayload()`, `applySharedScenarioFromUrl()`, `collectAnnualReportMetrics()` |
| Input persistence | `js/app.js` → `collectInputState()`, `saveInputsToStorage()`, `restoreInputsFromStorage()`, `resetInputsToDefaults()` |
| Inputs (all DOM ids) | `index.html` (§10 of this document) |
| Deployment | `render.yaml`; `.github/workflows/validation.yml`; `.nojekyll` |
| Test commands | `package.json` → `scripts`; suites under `validation/unit|backend|browser|scripts` |
| Field data | `validation/field-data/soac-mar-2026/` → `analysis_report.md`, `soac_timeseries.csv`, `soac_daily_energy.csv`, `soac_scatter.csv`, `soac_meta.json`, `extract_soac.mjs` |
| Golden references | `validation/reference/reference_summary.json`, `validation/fixtures/weather/*.json`, `validation/fixtures/backend/*.json` |

---

*End of audit. Generated read-only on 2026-07-20 against `main` @ `6d4cf9c`; the only repository change made by this audit is this file.*

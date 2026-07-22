# Thesis Figures — Mains-Water Temperature Validation

Captured 2026-07-21 from the repository's own validation pages, served locally (`python -m http.server 8091`) with the local TMY backend (`pvt-tmy-api/server.py`) supplying **live PVGIS TMY** weather. Rendered headlessly via Playwright/Chromium at `deviceScaleFactor: 2` (print quality, ~2800 px wide for charts).

All images are in `docs/thesis/figures/`. Reproduce with the capture scripts described in §5.

> **Read before using these figures.** Figures 1–4 and 7 come from validation pages that implement the **original US Burch–Christensen coefficients**, *not* the calculator's fitted BC-Aus zone constants. Figure 5/6 show the production regional fit. See §4 — this distinction decides which numbers you may quote.

---

## 0a. Recommended set — use these eight, not the 30 per-zone files

The per-zone charts have been consolidated into **four combined 2×2 figures** and moved to `figures/per-zone/`. For the thesis, use the eight top-level images below; the per-zone originals remain available if an examiner wants a single zone enlarged.

| Figure | File | Replaces | Headline |
|---|---|---|---|
| **A** Recalibration vs CER reference | `fig-combined-model-vs-cer.png` | 10 per-zone files | BC+6 **2.99** → BC+0 **2.42** → Regional BC-Aus **0.62 °C** MAE (same weather throughout) |
| **B** Original correlation under live TMY | `fig-combined-original-vs-cer-tmy.png` | 10 per-zone files | the winter over-prediction that motivated the refit |
| **C** vs EnergyPlus ground temperatures | `fig-combined-ground-temperature.png` | 10 per-zone files | independent check; agreement improves with depth |
| **D** In-sample vs live-weather accuracy | `fig-combined-bcaus-insample-vs-live.png` | *(new — see §0b)* | production model **0.62 °C in-sample → 1.02 °C on live TMY** |
| 1 Reference-location map | `fig-reference-location-map.png` | — | Alice Springs' curve serves the whole west |
| 2 Development flowchart | `fig-model-development-flowchart.png` | — | national fit → per-zone refit → runtime |
| 5 Daily profile example | `fig-daily-mains-profile.png` | — | Sydney: 18.02 °C mean, 9.71 K swing |
| 6 Sensitivity | `fig-mains-sensitivity-demand.png` | — | ~6.0% heat-demand change per 1 K mains |
| 7 Conceptual: damping & lag | `fig-concept-damping-and-lag.png` | — | explains the equation's two shape terms — **and that both are fitted away** (§0c) |

All four combined figures are 2×2 panels covering the **four runtime zones only**. Canberra (zone 5) is deliberately excluded: its source deck is heat-pump-only and the selector can never choose it, so including it would misrepresent the model's operating envelope. Each panel is annotated with its own MAE, and each figure carries a summary table plus a source note.

## 0b. New result — the production model's out-of-sample error

Earlier audit passes recorded a gap: no artefact evaluated the **fitted per-zone constants driven by PVGIS TMY weather**, so the production model's runtime error was unknown. That experiment has now been run. `pages/cer_comparison.html` contains a *Regional BC-Aus / PVGIS weather* series that is only populated after fetching live weather; doing so for all five zones yields:

| Zone | BC-Aus on CER-era weather (in-sample) | BC-Aus on PVGIS TMY (out-of-sample) |
|---|---:|---:|
| 1 — Rockhampton | 0.67 | 0.67 |
| 2 — Alice Springs | 0.78 | **1.77** |
| 3 — Sydney | 0.52 | 0.76 |
| 4 — Melbourne | 0.50 | 0.90 |
| **Mean** | **0.62** | **1.02** |

Mean absolute error vs the CER reference, °C. The in-sample column reproduces the per-zone MAEs published in `js/bc_aus_zone_constants.js` (0.667 / 0.779 / 0.523 / 0.496), which confirms the extraction is faithful.

**Reading:** swapping the fitted-era ambient series for the weather the calculator actually runs on roughly **halves the model's accuracy, from 0.62 °C to 1.02 °C mean absolute error** — still sub-1.1 °C on average, but with Alice Springs degrading most (0.78 → 1.77 °C), consistent with arid inland climates where the annual mean and swing differ most between the CER-era decks and modern PVGIS TMY. Rockhampton is unchanged.

Quote **1.02 °C** when describing runtime accuracy and **0.705 °C RMSE / 0.62 °C MAE** only when explicitly describing fit quality. Both remain agreement with a *legacy certification schedule*, not with measured mains water — that gap is still open.

## 0c. Conceptual figure — and a caveat you must not omit

`fig-concept-damping-and-lag.png` shows the intended physics: ambient air as a large sinusoid, mains water as a smaller sinusoid delayed later in the year, with `ratio` (amplitude damping) and `lag` (seasonal lag) annotated and mapped onto the equation. The curves are **schematic**, chosen to make the two terms legible.

They have to be schematic, because the fitted model does not behave this way. Across the four runtime zones `ratio` is 0.80–1.06 — Alice Springs slightly *amplifies* the swing — and `lag` is −8.6 to +0.7 days. Measured over the seven locked weather fixtures, the modelled mains minimum arrives **before** the ambient minimum in most cities (Sydney −13 d, Perth −21 d, Hobart −29 d, Darwin −30 d), which is physically backwards. Only Canberra retains a conventional +31.8-day lag, and Canberra is the one zone the selector can never choose.

The figure carries this caveat in a highlighted panel plus a per-zone table, so it can be used as-is. What you must not do is caption it as a description of the fitted model. Safe wording: *"Conceptual structure of the BC-Aus model. The fitted Australian constants reduce both shape terms substantially — see Table X."* Full analysis in `MAINS_WATER_VALIDATION.md` §7.3b.

---

## 0. The six-figure set for the thesis section

Mapping your planned figure list to what now exists, with the source of each.

| # | Planned figure | File | Generated from | Status |
|---|---|---|---|---|
| 1 | Map of the four runtime reference locations | `fig-reference-location-map.png` | `findClosestBcAusSwhReference()` + `haversineKm()` + `BC_AUS_SWH_REFERENCE_LOCATIONS`, extracted from [js/app.js](js/app.js) and evaluated over a 0.25° grid | **new** |
| 2 | Model-development flowchart | `fig-model-development-flowchart.png` | [tools/fit_bc_aus.py](tools/fit_bc_aus.py), [tools/fit_bc_aus_by_zone.py](tools/fit_bc_aus_by_zone.py), [js/bc_aus_zone_constants.js](js/bc_aus_zone_constants.js), [validation/unit/test_mains_zones.mjs](validation/unit/test_mains_zones.mjs) | **new** |
| 3 | Monthly BC-Aus vs CER curves, four references | `fig-regional-vs-original-zone-{1..4}-*.png` | [pages/cer_comparison.html](pages/cer_comparison.html) — the only page loading the production constants | captured §4 |
| 4 | BC-Aus vs EnergyPlus shallow ground | `fig-ground-0p5m-*.png`, `fig-ground-2p0m-*.png` | [pages/validation3.html](pages/validation3.html), [pages/validation4.html](pages/validation4.html) | captured §3 |
| 5 | Example of the final daily profile | `fig-daily-mains-profile.png` | `calculateLocalTMains()` from [js/app.js](js/app.js) over [validation/fixtures/weather/sydney.json](validation/fixtures/weather/sydney.json) | **new** |
| 6 | Sensitivity: mains temperature → annual heating demand | `fig-mains-sensitivity-demand.png` | `calcDairyHourlyDemand()` + `calculateLocalTMains()` from [js/app.js](js/app.js) | **new** |

The four new figures are computed by executing the **shipped production functions** (extracted from `js/app.js` into a sandbox by brace-matched slicing, the same technique the repository's own tests use), not by re-implementing the equations. Every number in them therefore comes from the code that runs in the calculator.

### Figure 1 — reference locations and catchment areas

> **Figure 1.** The four legacy solar-water-heater reference locations used by the mains-water model, with the region each one serves. Shading shows the reference selected at every 0.25° grid point by the shipped great-circle selector. Canberra (zone 5) is excluded because its source deck covers air-source heat pumps only.

**Result worth discussing:** Alice Springs' arid inland curve is applied across the entire western half of the continent — including Perth, Adelaide, Darwin and Broome — while Tasmania inherits Melbourne's. This is the clearest visual statement of the nearest-reference approximation's limitation (§7.5 of `MAINS_WATER_VALIDATION.md`) and pairs naturally with the note that this is *not* an official CER postcode determination.

### Figure 2 — model-development flowchart

> **Figure 2.** Development path of the BC-Aus mains-water temperature model, from the CER reference decks through the superseded national fit to the shipped per-zone recalibration, its runtime selection logic, and the validation evidence available at each stage.

Encodes the generation-1 → generation-2 narrative (national 5-parameter fit at 4.59/3.56 °C RMSE → rank-deficiency diagnosis → per-zone 3-parameter fit at 0.705 °C), the SHA-256 identity pinning, and — deliberately — the "measured mains data: NONE" box so the figure states the open gap rather than hiding it.

### Figure 5 — final daily profile

> **Figure 5.** The 365-value daily mains-water temperature profile produced by the calculator for Sydney, with the fixture's monthly mean air temperature for context. This series supplies the inlet temperature T_in to both PVT thermal models and to every water-heating demand model.

Production output: reference **Sydney (zone 3), 52.2 km**; annual mean **18.02 °C**, range **13.16–22.87 °C**, seasonal swing **9.71 K**. Note the visible phase lag — the mains minimum trails the air-temperature minimum, which is the physical behaviour the lag term encodes.

### Figure 6 — sensitivity of heat demand to mains temperature

> **Figure 6.** Annual dairy process-heat demand as a function of mean mains-water temperature, recomputed with the production demand model while the daily mains profile is shifted by a uniform offset. Demand varies by approximately 6.0% per kelvin.

| Mains offset | Mean mains (°C) | Annual heat demand (kWh) | Change |
|---|---:|---:|---:|
| −6 K | 12.02 | 181,415 | +35.7% |
| −2 K | 16.02 | 149,571 | +11.9% |
| 0 (baseline) | 18.02 | 133,649 | — |
| +2 K | 20.02 | 117,727 | −11.9% |
| +6 K | 24.02 | 85,882 | −35.7% |

**This is the figure that justifies the whole chapter.** Because the duty is Q = ṁ·c_p·(T_target − T_mains) with a driving ΔT of only ~17 K, a 1 K error in mains temperature propagates to roughly 6% error in heat demand — and hence in solar fraction, savings and payback. It converts "we validated the mains model" from housekeeping into a quantified accuracy requirement. Baseline: 5 ML milk/yr, 35 °C preheat target, Sydney fixture.

---

## 1. Original Burch–Christensen (+6 °F) vs CER reference

**Files:** `fig-cer-offset6f-zone-summary-table.png`, `fig-cer-offset6f-zone-{1..5}-*.png`
**Source page:** `pages/validation.html` ("Validation 1")
**Model tested:** `ratio = 0.4 + 0.01·(T̄a,F−44)`, `lag = 35 − (T̄a,F−44)`, offset **+6 °F** — Hendron's US-calibrated form.

> **Figure 1.** Monthly mains-water temperature predicted by the unmodified US Burch–Christensen correlation (offset +6 °F), driven by PVGIS typical-meteorological-year air temperature, compared with the CER DomDecks reference schedule for the five Australian climate zones. Mean absolute error averaged 3.49 °C across the five zones, with the largest deviations in winter (July) in every zone except Rockhampton.

Live results (this run):

| Zone | MAE (°C) | Largest gap (°C) | Annual avg model | Annual avg CER | Verdict |
|---|---:|---|---:|---:|---|
| 1 — Rockhampton | 1.15 | 2.95 (Jun) | 25.57 | 24.83 | Good agreement |
| 2 — Alice Springs | 5.35 | 9.98 (Jul) | 25.44 | 20.08 | Poor |
| 3 — Sydney | 3.83 | 7.62 (Jul) | 21.49 | 17.67 | Poor |
| 4 — Melbourne | 3.22 | 7.14 (Jul) | 17.72 | 14.50 | Poor |
| 5 — Canberra | 3.88 | 7.57 (Jul) | 15.97 | 12.08 | Poor |
| **Average** | **3.49** | | | | |

**Interpretation for the thesis:** this is the *motivation* figure — it demonstrates why an Australian refit was necessary. The model systematically **over-predicts winter mains temperature** (all five annual averages are biased warm, up to +5.4 °C in Alice Springs). The validation page itself states the likely cause: the correlation was developed for US pipe depth, soil and network conditions.

---

## 2. Offset-removed variant (0 °F) vs CER reference

**Files:** `fig-cer-offset0f-zone-summary-table.png`, `fig-cer-offset0f-zone-{1..5}-*.png`
**Source page:** `pages/validation2.html` ("Validation 2")
**Model tested:** identical US coefficients, offset **0 °F**.

> **Figure 2.** Effect of removing Hendron's +6 °F offset term from the Burch–Christensen correlation. Averaged mean absolute error falls from 3.49 °C to 2.39 °C, and every zone moves from "Poor" to "Acceptable", but a residual winter over-prediction remains.

| Zone | MAE (°C) | Largest gap (°C) | Annual avg model | Annual avg CER | Verdict |
|---|---:|---|---:|---:|---|
| 1 — Rockhampton | 2.60 | 4.49 (Nov) | 22.24 | 24.83 | Acceptable |
| 2 — Alice Springs | 2.76 | 6.64 (Jul) | 22.10 | 20.08 | Acceptable |
| 3 — Sydney | 2.18 | 4.28 (Jul) | 18.16 | 17.67 | Acceptable |
| 4 — Melbourne | 2.24 | 3.81 (Jul) | 14.38 | 14.50 | Acceptable |
| 5 — Canberra | 2.16 | 4.24 (Jul) | 12.63 | 12.08 | Acceptable |
| **Average** | **2.39** | | | | |

**Interpretation:** the offset alone is worth ~1.1 °C of MAE, but note the trade-off — dropping it makes tropical Rockhampton *worse* (1.15 → 2.60 °C) while improving all temperate zones. This is exactly the argument for a **per-zone** rather than a single national correction, and it is why the production fit retains a large positive offset only for Rockhampton (+5.42 °F) and near-zero offsets elsewhere.

---

## 3. Independent cross-check vs EnergyPlus ground temperatures

**Files:** `fig-ground-0p5m-*.png` (0.5 m depth), `fig-ground-2p0m-*.png` (2.0 m depth)
**Source pages:** `pages/validation3.html`, `pages/validation4.html`
**Reference:** EnergyPlus TMYx calculated undisturbed ground temperatures (climate.onebuilding.org, soil diffusivity 2.3226×10⁻³ m²/day) at the five airport sites.

> **Figure 3.** Burch–Christensen mains predictions compared against EnergyPlus undisturbed ground temperatures at 0.5 m and 2.0 m depth — an independent reference not used in fitting. Averaged mean absolute error: 3.79 °C (+6 °F) and 2.01 °C (0 °F) at 0.5 m; 3.56 °C (+6 °F) and 1.25 °C (0 °F) at 2.0 m.

**Interpretation:** buried mains track shallow ground temperature, so this is the closest thing in the repository to an independent *physical* cross-check. The key result is that agreement **improves with depth** (2.0 m, 0 °F offset gives the best agreement of any check at 1.25 °C), which is physically sensible for buried reticulation and independently corroborates removing the +6 °F offset. Caveat to state: these are *calculated* ground temperatures, not measured mains water, and the model uses air temperature only — it cannot capture site effects such as Canberra's 575 m elevation.

---

## 4. Production regional BC-Aus fit vs CER reference

**Files:** `fig-regional-vs-original-zone-{1..5}-*.png` (titled + legend), `fig-regional-bcaus-zone-{1..5}-*.png` (chart only)
**Source page:** `pages/cer_comparison.html` — the **only** page that loads `js/bc_aus_zone_constants.js`, i.e. the constants the calculator actually ships.

> **Figure 4.** Monthly mains-water temperature from the per-zone recalibrated BC-Aus model (brown) against the CER DomDecks reference (green) for each Australian climate zone. The regional fit reproduces the reference schedule to an overall RMSE of 0.705 °C (per-zone 0.50–0.95 °C), compared with 3.49 °C for the unmodified US correlation in Figure 1.

Per-zone fitted constants and in-sample fit quality (from `js/bc_aus_zone_constants.js`):

| Zone | City | offsetF (°F) | ratioC0 | lagC0 (days) | MAE (°C) | RMSE (°C) | max abs (°C) |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | Rockhampton | +5.424 | 0.802 | −6.740 | 0.667 | 0.697 | 0.998 |
| 2 | Alice Springs | −0.473 | 1.061 | −8.622 | 0.779 | 0.950 | 1.636 |
| 3 | Sydney | −0.377 | 1.034 | −0.086 | 0.523 | 0.602 | 1.251 |
| 4 | Melbourne | −0.822 | 0.973 | +0.701 | 0.496 | 0.502 | 0.613 |
| 5 | Canberra (ASHP-only) | +0.045 | 1.031 | +31.822 | 0.587 | 0.694 | 1.103 |
| **Overall** | | | | | | **0.705** | |

**Critical caveat — do not conflate these numbers with Figures 1–3.** The 0.705 °C figure is an **in-sample fit** to the same 12 monthly reference points per zone that the fit was trained on, driven by the *CER-era* ambient series. The 3.49 °C / 2.39 °C figures come from *runtime* PVGIS TMY ambient data against the same reference. They measure different things:

| | Figures 1–3 | Figure 4 |
|---|---|---|
| Coefficients | original US (Hendron) | fitted per-zone BC-Aus (production) |
| Ambient driver | live PVGIS TMY | CER-era monthly means |
| Reference | CER decks / EnergyPlus ground | CER decks |
| Nature | out-of-sample, runtime-realistic | in-sample fit quality |
| Result | MAE 3.49 (+6 °F), 2.39 (0 °F) | RMSE 0.705 |

A defensible thesis sentence: *"Recalibrating Burch–Christensen per climate zone reduced in-sample error against the CER reference schedules to 0.705 °C RMSE, against 3.49 °C MAE for the unmodified US correlation driven by TMY data."* — while stating plainly that no like-for-like out-of-sample comparison of the **fitted** model against PVGIS-driven runtime conditions currently exists in the repository (see §4 of `MAINS_WATER_VALIDATION.md`).

---

## 5. Supporting figures

| File | Suggested title | Use |
|---|---|---|
| `fig-formula-explainer.png` | *The BC-Aus mains-water temperature formula, term by term* | Method chapter: full-page walkthrough of the equation, algorithm steps and per-term definitions (`pages/validation5.html`). **Note:** this page documents the **original** coefficient forms (`ratio = 0.4 + 0.01·…`, `lag = 35 − …`, `+6`), not the production per-zone constants — annotate or redraw before use. |
| `fig-what-is-compared.png` | *Definitions of the model variants compared* | Explains CER TMY vs PVGIS, national BC-Aus vs regional BC-Aus, and zone corrections. |
| `fig-ground-0p5m-summary-table-{1,2}.png`, `fig-ground-2p0m-summary-table-{1,2}.png` | *Ground-temperature agreement by site (+6 °F and 0 °F variants)* | Tabular companions to Figure 3. |

---

## 6. Reproducing these figures

```powershell
# 1. Serve the repo and start the weather backend
python -m http.server 8091
python pvt-tmy-api/server.py           # separate terminal, port 8000

# 2. Open each page and press "Run Validation" (fetches live PVGIS TMY, ~30 s/zone)
#    http://localhost:8091/pages/validation.html    (Figure 1)
#    http://localhost:8091/pages/validation2.html   (Figure 2)
#    http://localhost:8091/pages/validation3.html   (Figure 3, 0.5 m)
#    http://localhost:8091/pages/validation4.html   (Figure 3, 2.0 m)
#    http://localhost:8091/pages/cer_comparison.html (Figure 4 — pick zone from dropdown)
```

The captures in this folder were produced by headless Playwright scripts driving exactly that sequence. Because the pages fetch **live PVGIS data**, re-running may shift the MAE values slightly if PVGIS updates its TMY; the figures here record the 2026-07-21 run. For a frozen baseline, drive the pages from the locked fixtures in `validation/fixtures/weather/` instead.

---

## 7. Where every number and asset came from

**In-repository sources** (all paths relative to the repository root):

| Source | What it provides |
|---|---|
| [js/app.js](js/app.js) → `calculateLocalTMains()`, `findClosestBcAusSwhReference()`, `haversineKm()`, `calcDairyHourlyDemand()` | the production equations executed for Figures 1, 5, 6 |
| [js/bc_aus_zone_constants.js](js/bc_aus_zone_constants.js) | shipped per-zone constants + per-zone MAE/RMSE/max-error and fixture SHA-256s (Figure 4 table) |
| [tools/fit_bc_aus_by_zone.py](tools/fit_bc_aus_by_zone.py) | generation-2 fitting method, `--check` determinism |
| [tools/fit_bc_aus.py](tools/fit_bc_aus.py), [data/bc_aus_constants.js](data/bc_aus_constants.js) | generation-1 national fit and its 4.59 / 3.56 °C RMSE |
| [validation/fixtures/cer/](validation/fixtures/cer/) (5 `.inc` decks) | CER DomDecks reference schedules, revision 20/07/15 |
| [validation/fixtures/energyplus/](validation/fixtures/energyplus/) (5 `.stat` files) | EnergyPlus TMYx ground temperatures |
| [validation/fixtures/weather/sydney.json](validation/fixtures/weather/sydney.json) | locked 8,760-hour PVGIS TMY driving Figures 5 and 6 |
| [validation/unit/test_mains_zones.mjs](validation/unit/test_mains_zones.mjs) | identity, bounds and cross-platform regeneration tests |
| [pages/cer_comparison.html](pages/cer_comparison.html) | Figure 4 (production constants) |
| [pages/validation.html](pages/validation.html), [validation2.html](pages/validation2.html), [validation3.html](pages/validation3.html), [validation4.html](pages/validation4.html), [validation5.html](pages/validation5.html) | Figures 1–3, 7 (original US coefficients) |

**External sources** (cite these in the thesis bibliography, not as repository artefacts):

| Source | Used for | Link |
|---|---|---|
| Burch & Christensen (NREL), *Towards Development of an Algorithm for Mains Water Temperature* | the base correlation | https://www.osti.gov/biblio/981988 |
| CER, *Postcode zones for solar water heaters and heat pumps* (v3, eff. 2020-01-01) | zone family definitions; postcode registry | https://cer.gov.au/document/postcode-zones-solar-water-heaters-and-heat-pumps |
| EnergyPlus / OneBuilding TMYx `.stat` climate files | ground-temperature reference (Figure 3) | https://climate.onebuilding.org/ |
| PVGIS 5.3 (European Commission JRC) | TMY weather driving all runtime figures | https://re.jrc.ec.europa.eu/pvg_tools/en/ |
| pvlib-python `iotools.get_pvgis_tmy` | PVGIS client used by the backend | https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.iotools.get_pvgis_tmy.html |

The CER DomDecks `.inc` decks themselves are legacy CER/SRES certification inputs redistributed in this repository as fixtures; the original CER weather files they reference are **not** redistributed (recorded as `ambientDataLimitation` in the generated constants).

## 8. Provenance and integrity

- Figures generated 2026-07-21 from `main` @ `6d4cf9c`, working tree clean apart from `docs/thesis/`.
- Figures 1–4, 7: live PVGIS 5.3 TMY via the local backend (contract 2.1), fetched per zone at capture time.
- Figures 1, 2, 5, 6: deterministic — computed from the locked fixture and shipped constants, so they regenerate identically.
- **No repository source file was modified** to produce any figure; validation pages were run unmodified and production functions were read, not edited.
- Underlying computed values are retained in `figures/_figure-data.json` (daily profile, grid assignments, sensitivity sweep, zone constants) so figures can be redrawn without re-running anything.

## 9. Two open decisions in your outline

**1. Where should the failed national-fit history go?** Put a short version in Methodology and the numbers in Results. Methodology needs one paragraph — "a single national fit was attempted first and rejected as rank-deficient, motivating the per-zone form" — because it justifies *why* the model has the structure it has, and a reader cannot follow the three-parameter design without it. The quantitative comparison (4.59 → 3.56 → 0.705 °C) belongs in Results as the first row of your accuracy table, where Figure 2 can be referenced from both. Keeping the full narrative in Methodology would stall the chapter before the model is even defined.

**2. Naming.** Introduce both once, then use BC-Aus throughout: *"…the Burch–Christensen correlation, recalibrated for Australian conditions (hereafter BC-Aus)…"*. Use the full name again only in the chapter summary or abstract. Two cautions: the repository name is `BC_AUS_*` so the shorthand matches your code and figures; and "BC-Aus" without expansion is opaque to an examiner, so the single expansion at first use is doing real work. Avoid alternating between the two forms — the audit found reader-facing inconsistency of exactly this kind across the existing docs.

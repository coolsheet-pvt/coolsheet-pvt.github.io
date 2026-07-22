# BC-Aus Mains-Water Temperature Model — Validation Dossier

Audit date: 2026-07-20. Branch/commit: `main` @ `6d4cf9c`.
Companion to `docs/thesis/REPOSITORY_TECHNICAL_AUDIT.md` (same evidence conventions: **[VERIFIED-CODE]** read from source, **[VERIFIED-RUN]** executed during this audit, **[DOC-ONLY]** stated in repo docs only, **[CONFLICT]** sources disagree, **[MISSING]** absent).

This document collects, in one place, everything the repository contains about the **validation of the BC-Aus mains-water temperature model**: what the model is, what it was fitted to, what it was tested against, which diagrams exist for thesis reuse, and every known inconsistency or limitation.

---

## 1. Machine-readable summary

```yaml
model_name: BC-Aus (Burch-Christensen refit for Australia)
purpose: >
  Daily (365-value) mains/cold-water inlet temperature profile for any
  geocoded Australian site; supplies T_in to both PVT thermal models and
  every water-heating industry demand model.
formula_family: NREL Burch & Christensen (2007) sinusoidal mains model, Fahrenheit domain
runtime_implementation: js/app.js -> calculateLocalTMains()
constants_file: js/bc_aus_zone_constants.js   # auto-generated, DO NOT EDIT
generator: tools/fit_bc_aus_by_zone.py        # deterministic, --check regeneration
reference_data: 5 CER DomDecks legacy .inc decks (revision 20/07/15), SHA-256-pinned
zones_used_at_runtime: 4 (Rockhampton, Alice Springs, Sydney, Melbourne; Canberra ASHP-only, excluded)
selection_method: geographically closest reference (haversine); NOT a CER postcode determination
fit_quality_vs_reference_decks:
  overall_rmse_C: 0.705
  per_zone_rmse_C: {zone1: 0.697, zone2: 0.950, zone3: 0.602, zone4: 0.502, zone5: 0.694}
independent_cross_checks: EnergyPlus TMYx 0.5 m and 2.0 m ground temperatures (5 sites)
measured_mains_validation: none (open gap)
automated_test: npm run test:mains-zones (executed 2026-07-20, PASS, incl. cross-platform regeneration check)
```

---

## 2. The model being validated

For each day d = 1…365, with the loaded TMY's monthly ambient statistics:

```text
T̄a,F        = annual mean ambient (°F);  ΔT_month,F = (warmest − coolest monthly mean) (°F)
ratio       = ratioC0 + ratioC1·(T̄a,F − 44)          (fitted ratioC1 = 0 in all zones)
lag         = lagC0   + lagC1·(T̄a,F − 44)            (fitted lagC1 = 0 in all zones)
modelDay    = d               (northern hemisphere)
            = ((d+181) mod 365) + 1                   (southern: 182-day phase shift)
T_mains,F(d)= (T̄a,F + offsetF) + ratio · (ΔT_month,F / 2) · sin(0.986·(modelDay − 15 − lag) − 90°)
```

converted to °C and bucketed into `byDay[1..365]` + monthly averages. **[VERIFIED-CODE]** (`calculateLocalTMains()`, `js/app.js`).

Zone selection at runtime: `findClosestBcAusSwhReference()` picks the **geographically closest** of four solar-water-heater (SWH) reference locations by haversine distance — Rockhampton (zone 1), Alice Springs (zone 2), Sydney (zone 3), Melbourne (zone 4). Canberra (zone 5) is excluded because its source deck is air-source-heat-pump (ASHP)-only. The chosen reference name and distance are stored in the model result and shown in the UI. Users can override the model with 12 custom monthly values (`getEffectiveMains()`). **[VERIFIED-CODE]**

Where the output goes: `T_in` for Model A/B collector inlet each hour; ΔT for dairy, brewery and laundry water heating; daily makeup-water ΔT for aquatic centres — i.e. every thermal result in the calculator depends on this model. **[VERIFIED-CODE]**

Fitted production constants (all **[VERIFIED-CODE]**, `js/bc_aus_zone_constants.js`):

| Zone | Reference city | offsetF (°F) | ratioC0 (–) | lagC0 (days) | MAE (°C) | RMSE (°C) | max abs (°C) |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 (SWH+ASHP) | Rockhampton | +5.424 | 0.802 | −6.740 | 0.667 | 0.697 | 0.998 |
| 2 (SWH+ASHP) | Alice Springs | −0.473 | 1.061 | −8.622 | 0.779 | 0.950 | 1.636 |
| 3 (SWH+ASHP) | Sydney | −0.377 | 1.034 | −0.086 | 0.523 | 0.602 | 1.251 |
| 4 (SWH+ASHP) | Melbourne | −0.822 | 0.973 | +0.701 | 0.496 | 0.502 | 0.613 |
| 5 (ASHP-only, never selected) | Canberra | +0.045 | 1.031 | +31.822 | 0.587 | 0.694 | 1.103 |

Overall in-sample RMSE across all five decks: **0.705 °C**. Bias is 0.000 per zone (a property of the fit, not independent evidence — see §7). Note how the fitted offsets replace Hendron's fixed +6 °F: only tropical Rockhampton retains a large positive offset (+5.4 °F); the temperate zones sit near zero.

---

## 3. Reference data lineage (what "validated against CER" actually means)

- The reference targets are the **monthly cold-water temperature tables inside five legacy CER DomDecks TRNSYS input decks** (`UNIT 17 TYPE 14`, "Monthly cold water temperature"), revision 20/07/15, stored verbatim as fixtures: `validation/fixtures/cer/zone1..4_NW_Domestic.inc` and `ZONEHP5_Au_Domestic.inc`. **[VERIFIED-CODE]**
- Identity is parsed **from the decks themselves** (`ASSIGN` weather filename, `zone =`, `LAT =`, revision line), not from a hand-written city list, and each fixture's canonical-LF SHA-256 is embedded in the generated constants — so a silent zone/city swap cannot recur (this matters historically, §7). **[VERIFIED-CODE]** (`tools/fit_bc_aus_by_zone.py` → `parse_cer_fixture()`).
- The driving ambient series are monthly means previously derived from the CER weather files named by `ASSIGN` (`rockhampton2.tmy` etc.). The original CER weather files are **not distributed** in the repository; this limitation is emitted into the generated metadata (`ambientDataLimitation`). **[VERIFIED-CODE]**
- Scope declaration (repeated in the generator header, the constants file, `docs/model-specification.md` and the app UI): these decks are a **legacy CER/SRES domestic reference**, *not* AS/NZS 4234:2021 engineering data, and the nearest-reference selection is *not* an official CER postcode determination. **[VERIFIED-CODE]**
- A genuine CER **postcode→zone registry** (`js/cer_postcode_zones.js`, from the official CER postcode-zones document, version 3, effective 2020-01-01, SWH and ASHP families kept separate) exists and is fully tested — but it is deliberately **not** used to select the runtime mains model (asserted by the test, §5). It exists for display/lookup purposes. **[VERIFIED-CODE]**

---

## 4. Fitting history — two generations

**Generation 1 (superseded, still in repo):** `tools/fit_bc_aus.py` fitted a *single national* five-parameter Burch–Christensen set to all 60 reference points (5 zones × 12 months) with `scipy.optimize.least_squares` (2026-04-14). Results recorded in `data/bc_aus_constants.js`: with Hendron's original +6 °F offset RMSE = **4.590 °C**; with the offset dropped RMSE = **3.556 °C**. `tools/fit_bc_zone_corrections.py` then produced additive per-zone monthly corrections (`data/bc_zone_corrections.js`). These files are **not** wired into `index.html` — historical artefacts only. **[VERIFIED-CODE]**

**Generation 2 (production):** `tools/fit_bc_aus_by_zone.py` fits **each zone separately** with exactly **three identifiable parameters** (offset + one effective amplitude + one effective lag, obtained by expanding the sinusoid into sine/cosine components and solving a deterministic 3×3 linear system — no scipy, no optimizer). `ratioC1 = lagC1 = 0` by construction, because for one fixed ambient series the five-parameter form is rank-deficient (the earlier five-parameter fit produced *different but model-equivalent* constants on Windows vs Linux — the direct motivation for this redesign). Validation metrics are computed from the exact 8-decimal shipped constants, not hidden extra digits. Result: overall RMSE **0.705 °C** — a ~5× improvement over the national fit. `--check` mode re-generates and compares within 2e-6 for cross-platform determinism. **[VERIFIED-CODE]**, regeneration **[VERIFIED-RUN]** (executed inside `test:mains-zones`, §5).

---

## 5. Validation evidence, by family

### 5.1 In-sample agreement with the CER reference decks (production constants)

Fit-quality metrics per zone as tabulated in §2 (RMSE 0.50–0.95 °C, max abs ≤ 1.64 °C, overall 0.705 °C). These are **in-sample**: fitted to, and evaluated against, the same 12 monthly reference points per zone, driven by the CER-era ambient series.

The only page that renders the **production** per-zone constants is `pages/cer_comparison.html` — it is the sole page that loads `js/bc_aus_zone_constants.js` (`computeBC()` with `zoneParams`). Its zone selector plots "Regional Australian recalibrated Burch-Christensen" against the CER DomDecks reference. Captured figures: `docs/thesis/figures/fig-regional-vs-original-zone-{1..5}-*.png`. **[VERIFIED-RUN]** (rendered live 2026-07-21; the regional curve tracks the reference visually to well under 1 °C — consistent with the tabulated RMSE).

*What this demonstrates:* the fitted sinusoid reproduces its own reference decks to sub-degree accuracy. *What it does not:* out-of-sample or runtime accuracy (§5.1a), or accuracy against real Australian mains water (§7.3).

### 5.1a **[CONFLICT]** The "Validation 1–5" pages do NOT test the production model

`pages/validation.html`, `validation2.html`, `validation3.html`, `validation4.html` and the explainer `validation5.html` all hard-code the **original US Hendron/Burch–Christensen coefficients**:

```text
ratio = 0.4 + 0.01·(T̄a,F − 44)      lag = 35 − (T̄a,F − 44)      offset = +6 °F (V1/V3/V4 default) or 0 °F (V2)
```

(`pages/validation.html` and `validation2.html` lines ~249–260; `validation3.html`/`validation4.html` lines ~314–325; `validation5.html` lines 52–58.) **[VERIFIED-CODE]** These are *not* the shipped per-zone constants (offsetF −0.82…+5.42, ratioC0 0.80–1.06, lagC0 −8.62…+31.82, ratioC1 = lagC1 = 0). Despite page titles reading "BC-Aus vs CER reference", they characterise the **un-refitted** correlation.

Running them live against PVGIS TMY on 2026-07-21 gave **[VERIFIED-RUN]**:

| Page | Model tested | Reference | Average MAE |
|---|---|---|---:|
| Validation 1 | US coefficients, +6 °F | CER decks | **3.49 °C** (4 of 5 zones "Poor") |
| Validation 2 | US coefficients, 0 °F | CER decks | **2.39 °C** (all "Acceptable") |
| Validation 3 | US coefficients | EnergyPlus 0.5 m ground | **3.79 °C** (+6) / **2.01 °C** (0) |
| Validation 4 | US coefficients | EnergyPlus 2.0 m ground | **3.56 °C** (+6) / **1.25 °C** (0) |

Consequences for the thesis:

- **Do not** present 3.49 °C or 2.39 °C as the production BC-Aus error — they belong to the original correlation. They are excellent *motivation* evidence for why the refit was done.
- **Do not** present 0.705 °C as validated runtime accuracy — it is in-sample fit quality under CER-era ambient data.
- ~~**[MISSING]** No page or test evaluates the fitted per-zone constants driven by PVGIS TMY ambient against any reference.~~ **[RESOLVED 2026-07-21 — [VERIFIED-RUN]]** `pages/cer_comparison.html` carries a *Regional BC-Aus / PVGIS weather* series that populates only after live weather is fetched. Running that for all five zones gives the production model's out-of-sample error against the CER reference: **mean MAE 1.02 °C** (Rockhampton 0.67, Alice Springs 1.77, Sydney 0.76, Melbourne 0.90) versus **0.62 °C in-sample**. The in-sample column reproduces the per-zone MAEs published in `js/bc_aus_zone_constants.js`, confirming the extraction is faithful. Figure: `docs/thesis/figures/fig-combined-bcaus-insample-vs-live.png`; full table in `FIGURES.md` §0b. **Quote 1.02 °C for runtime accuracy, 0.705 °C RMSE only for fit quality.** Both are agreement with a legacy certification schedule, not measured mains water (§7.3 remains open).
- `pages/validation5.html`, the formula explainer, likewise documents the original `+6 / 0.4 / 35` forms, so it does **not** describe the equation the calculator actually runs. Annotate or redraw it before using it as a method figure.

A further consistency note: Validation 1 reports Rockhampton as the *only* "Good agreement" zone under +6 °F (MAE 1.15 °C) while every temperate zone is "Poor"; under 0 °F the ordering inverts (Rockhampton degrades to 2.60 °C, all others improve). This is precisely the signal that motivated a per-zone offset, and it matches the production constants retaining a large +5.42 °F offset for Rockhampton alone. **[VERIFIED-RUN]**

### 5.2 Independent cross-check against EnergyPlus ground temperatures

- `pages/validation3.html` — **"Validation 3: BC-Aus vs EnergyPlus 0.5 m ground temperatures"** and `pages/validation4.html` (same at **2.0 m** depth). Monthly 0.5 m / 2.0 m undisturbed ground temperatures are hardcoded from EnergyPlus TMYx `.stat` files stored at `validation/fixtures/energyplus/` (Canberra, Sydney/Mascot, Alice Springs, Rockhampton, Melbourne; sourced from climate.onebuilding.org; standard soil diffusivity 2.3226e-3 m²/day). Both report the +6 °F and 0 °F variants side by side.
- The pages themselves state the caveats: these are **calculated** ground temperatures (not one measured calendar year), and site effects such as Canberra's 575 m elevation are outside the model (it uses air temperature only). **[VERIFIED-CODE]**
- Executed live 2026-07-21: **0.5 m** → MAE 3.79 °C (+6 °F) / 2.01 °C (0 °F); **2.0 m** → MAE 3.56 °C (+6 °F) / **1.25 °C (0 °F)**. **[VERIFIED-RUN]** Figures: `fig-ground-0p5m-*.png`, `fig-ground-2p0m-*.png`.

*Why this matters:* buried mains pipes track shallow ground temperature, so this is the closest thing in the repository to an **independent physical cross-check** — the reference data was not used in fitting. Agreement **improves with depth** and with the offset removed (best result of any check: 1.25 °C at 2.0 m, 0 °F), which is physically sensible for buried reticulation and independently corroborates dropping Hendron's +6 °F. *Limits:* ground temperature is a proxy, not a mains measurement; and per §5.1a these pages run the **original US coefficients**, so the result validates the correlation family, not the shipped per-zone fit.

### 5.3 Automated regression, identity and determinism tests — executed

`npm run test:mains-zones` (`validation/unit/test_mains_zones.mjs`) ran as part of the full offline suite on 2026-07-20 and **passed**. **[VERIFIED-RUN]** It asserts:

1. **Postcode registry correctness** — spot postcodes (4700→zone 1, 0870→zone 2, 2000→zone 3, 3000→zone 4; 7000 is SWH zone 4 but ASHP zone 5), every range's endpoints resolve, ranges never overlap, SWH family contains exactly zones 1–4.
2. **Generated-constants identity** — zone 1 must be Rockhampton/`rockhampton2.tmy` and zone 2 Alice Springs/`alicesprings2.tmy` (regex source locks), and each zone's embedded SHA-256 must equal the canonical-LF hash of its `.inc` fixture recomputed at test time.
3. **Physical legibility bounds** — ratioC1 = lagC1 = 0; 0.5 < ratioC0 < 1.5; |lagC0| < 60 days; |offsetF| < 10 °F; per-zone RMSE < 1.1 °C.
4. **Runtime wiring** — the old climate-fingerprint selector (`findNearestCERZone`) must be absent from `js/app.js`; `findClosestBcAusSwhReference` must exist; the four runtime reference entries match the deck identities; the postcode lookup is **not** used for mains selection; executing the actual selector source in a VM confirms Rockhampton/Alice Springs/Sydney/Melbourne coordinates map to zones 1/2/3/4 and that a Canberra coordinate can **never** select zone 5.
5. **Cross-platform determinism** — spawns `python tools/fit_bc_aus_by_zone.py --check`, which re-fits from the fixtures and requires numerical equivalence with the shipped file within 2e-6.

### 5.4 Downstream integration checks — executed

Within `npm run test:industry` (43/43 pass, 2026-07-20 **[VERIFIED-RUN]**), the "AQUATIC MAINS PROFILE" block verifies the daily `byDay` profile actually drives demand: constant profile ≡ scalar mains; evaporation/sensible terms unaffected; annual makeup preserved under a zero-mean seasonal swing; winter-day demand rises with cold winter mains, summer-day demand falls with warm summer mains. Dairy/brewery/laundry tests confirm Q = m·c_p·max(0, T_target − T_mains,day). The in-app supply loop takes `T_in = mains.byDay[dayN]` (fallback annual average, then 14 °C). **[VERIFIED-CODE]**

---

## 6. Diagrams and figures available for the thesis

**34 print-quality figures have been captured** to `docs/thesis/figures/` with titles, captions and the live numbers behind them — see **`docs/thesis/FIGURES.md`**. Summary of what exists:

| Diagram | Where | Model actually plotted | Captured file(s) |
|---|---|---|---|
| Per-zone monthly overlay vs CER, +6 °F | `pages/validation.html` | **original US** coefficients | `fig-cer-offset6f-*` |
| Per-zone monthly overlay vs CER, 0 °F | `pages/validation2.html` | **original US** coefficients | `fig-cer-offset0f-*` |
| Per-site overlay vs EnergyPlus ground temps | `validation3.html` (0.5 m), `validation4.html` (2.0 m) | **original US** coefficients | `fig-ground-0p5m-*`, `fig-ground-2p0m-*` |
| Interactive zone comparison | `pages/cer_comparison.html` | **production per-zone BC-Aus** | `fig-regional-vs-original-*`, `fig-regional-bcaus-*` |
| Step-by-step formula walkthrough | `pages/validation5.html` | **original US** forms (annotate before use) | `fig-formula-explainer.png` |
| Definitions of compared variants | `pages/cer_comparison.html` info box | — | `fig-what-is-compared.png` |
| In-app daily mains profile chart + monthly T_mains table | `index.html` mains display; SVG modal `buildMainsChartSvg()` in `js/app.js` | production model | not captured (needs a full calculation run) |
| Plain-language evidence summary | `pages/validation-hub.html` | — | not captured |
| Narrative document | `docs/water-mains-temperature-explained.docx` | — | binary, not audited |

The reference monthly series themselves (`referenceMonthlyC` per zone) are embedded in `js/bc_aus_zone_constants.js`, so any thesis figure can be regenerated from repository data alone. **[VERIFIED-CODE]**

---

## 7. Inconsistencies, history and limitations (read before citing)

1. **[CONFLICT — historical, remediated]** The independent audit (`docs/independent-model-audit-2026-07-10.md`, rated the model "Red") found the fitting/runtime registries had **swapped the zone 1 / zone 2 identities** (Alice-Springs-like ambient paired with Rockhampton mains values and vice versa), meaning the then-reported low RMSE was "fit quality against the wrong identity, not validation". The current pipeline parses identity directly from the raw decks, pins fixtures by SHA-256, and locks zone 1 = Rockhampton / zone 2 = Alice Springs in an executed test (§5.3). The audit document describes a **superseded** state; current code is consistent. A thesis telling the validation story should cite this as found-and-fixed.
2. **[CONFLICT — historical, remediated]** The same audit criticised a **five-parameter fit to 12 in-sample points** (rank-deficient, platform-dependent constants) and an **"invented" climate-similarity zone selector** used in production. Both were replaced: three identifiable parameters with a deterministic linear solve + cross-platform `--check` (§4), and a transparent geographic nearest-reference selector with the old selector's absence test-asserted (§5.3).
3. **[MISSING — the key open gap]** There is **no validation against measured Australian mains-water temperatures** anywhere in the repository. Every quantitative check is against the CER decks (in-sample) or EnergyPlus ground temperatures (independent, but a proxy). Zero per-zone bias and sub-degree RMSE are properties of the fit, not field accuracy. Do not present the 0.705 °C RMSE as accuracy against real mains water.
3a. **[CONFLICT — current, unresolved] The validation pages test the un-refitted US correlation, not the shipped model.** Pages titled "BC-Aus vs CER" (`validation.html`, `validation2.html`, `validation3.html`, `validation4.html`) and the formula explainer (`validation5.html`) hard-code Hendron's US coefficients (`ratio = 0.4 + 0.01·…`, `lag = 35 − …`, offset +6/0 °F); only `cer_comparison.html` loads the production per-zone constants. Their headline MAEs (3.49 / 2.39 / 3.79 / 3.56 °C) therefore describe the *original* model. Full detail, live numbers and thesis wording in §5.1a. **Two actions:** (i) never quote those MAEs as the calculator's accuracy; (ii) the missing experiment — fitted constants driven by PVGIS TMY, compared against the CER/EnergyPlus references — is the highest-value piece of new validation you could add, and would let you state the production model's out-of-sample error for the first time.
3b. **[CONFLICT — new, 2026-07-21] The fitted model does not reproduce the physical behaviour its own equation describes.** The BC-Aus form contains an amplitude term (`ratio`) and a phase term (`lag`) precisely because buried mains should show a *damped* and *delayed* version of the ambient cycle. In the shipped constants both are largely fitted away:

    | Zone (runtime) | `ratio` (damping) | `lag` (days) |
    |---|---:|---:|
    | 1 — Rockhampton | 0.802 | −6.74 |
    | 2 — Alice Springs | **1.061** (amplifies) | −8.62 |
    | 3 — Sydney | 1.034 | −0.09 |
    | 4 — Melbourne | 0.973 | +0.70 |
    | 5 — Canberra (never selected) | 1.031 | +31.82 |

    Running the production function over all seven locked weather fixtures and comparing the day of the modelled mains minimum against a 31-day centred moving mean of ambient air gives: Brisbane +1 d, Melbourne 0 d, Adelaide +6 d, Sydney −13 d, Perth −21 d, Hobart −29 d, Darwin −30 d. In most cases **the modelled mains minimum arrives *before* the ambient minimum**, which is physically backwards, and the amplitude ratio is near unity rather than the ~0.4–0.6 damping the original correlation applies. **[VERIFIED-RUN]**

    Two causes, both consequences of the fitting design (§4): the per-zone fit had only 12 monthly targets and no physical prior constraining `lag` to be positive; and the sinusoid's phase is fixed per *zone*, so a site far from its reference (Darwin → Alice Springs, Hobart → Melbourne) inherits a phase anchored to a different climate. Note that the one zone retaining a conventional lag (+31.8 d, close to Hendron's ~35 d) is Canberra — the zone the selector can never choose.

    **Implications:** the model is best described as *a fitted seasonal curve reproducing the CER reference schedules*, not as a physical soil-thermal-lag model; do not claim it captures ground-thermal damping and lag. It also means the near-unity `ratio` passes more seasonal swing into T_in than a physical model would, which — given the ~6% demand change per kelvin (`FIGURES.md` §0b, Figure 6) — systematically exaggerates the seasonal *swing* of process-heat demand even where the annual mean is accurate. Figure: `docs/thesis/figures/fig-concept-damping-and-lag.png`.

4. **In-sample fit, no hold-out.** 12 monthly targets and 3 parameters per zone leave 9 residual degrees of freedom; no held-out city or year exists. The independent audit's phrasing is worth adopting: agreement with the decks shows the model *emulates its reference*, and the repo must (and now does) declare whether BC-Aus is an engineering inlet-temperature model or an SRES-deck emulation — production docs label it a legacy-reference engineering approximation.
5. **Nearest-reference ≠ postcode zone.** A site anywhere in Australia inherits the *closest of four cities'* fitted curve (e.g. Canberra → Sydney's curve; Hobart → Melbourne's; Darwin → Alice Springs' or Rockhampton's by distance). The official CER postcode registry in the repo is deliberately not used for this. The approximation is disclosed in-app; a thesis should state it plainly.
6. **Reference decks are dated and regulatory-scoped**: legacy CER/SRES domestic decks (revision 2015), not AS/NZS 4234:2021, and zone 5 (Canberra) is ASHP-only, so the coldest-climate deck never drives the SWH mains model.
7. **Ambient-series provenance**: the monthly ambient means used in fitting came from CER weather files that are not redistributable in the repo (`ambientDataLimitation` in the constants metadata) — the fit is reproducible from stored numbers, but the ambient inputs themselves are not independently re-derivable from repository data.
8. **Runtime-vs-fit ambient mismatch**: at runtime the sinusoid is driven by the *loaded PVGIS TMY's* annual mean and monthly swing at the user's site, while the constants were fitted with the *reference city's CER-era* ambient statistics. This is by design (it is how Burch–Christensen generalises), but it means the fitted RMSE does not bound runtime error at arbitrary sites. **[INFERRED]** from §2 + §4 mechanics.
9. **Superseded Gen-1 artefacts remain** (`data/bc_aus_constants.js`, `data/bc_zone_corrections.js`, `tools/fit_bc_aus.py`, `tools/fit_bc_zone_corrections.py`) — useful to narrate the method's evolution (national fit 3.6–4.6 °C → per-zone 0.705 °C) but not part of the production path.
10. **Hemisphere/day conventions**: the 182-day southern phase shift and the fixed 365-day calendar are shared exactly between the fitting script and the runtime (`compute_bc_monthly()` mirrors `calculateLocalTMains()`); the generator's month bucketing uses a 30.44-day approximation while the runtime buckets by true calendar months — a small structural difference inside the fit metrics, not in production output. **[VERIFIED-CODE]**

---

## 8. Suggested defensible thesis claims

- "A per-zone refit of the NREL Burch–Christensen mains model to the five legacy CER DomDecks reference decks reproduces their monthly cold-water temperatures with an overall RMSE of 0.70 °C (worst zone 0.95 °C, worst month 1.64 °C), a ~5× improvement over a single national fit." ✔ supported (§2, §4).
- "Reference-deck identity is cryptographically pinned (SHA-256 per fixture) and regenerated deterministically across platforms, after an independent audit exposed and we corrected a zone-identity permutation and a rank-deficient fit." ✔ supported (§5.3, §7.1–2).
- "The unmodified US correlation, driven by PVGIS TMY data, showed a mean absolute error of 3.49 °C against the CER reference schedules with a systematic warm bias in winter, motivating an Australian recalibration; removing Hendron's +6 °F offset reduced this to 2.39 °C, and cross-checks against EnergyPlus 2.0 m ground temperatures reached 1.25 °C." ✔ supported by figures captured 2026-07-21 (§5.1a, §5.2, `FIGURES.md` §1–3).
- "The model was independently cross-checked against EnergyPlus TMYx 0.5 m and 2.0 m undisturbed ground temperatures at the five reference sites, with agreement improving with depth." ✔ supported, with the proxy caveat (§5.2).
- ✘ **Not** supportable: "validated against measured Australian mains-water temperatures" or any field-accuracy figure (§7.3). Recommended future work: obtain utility mains-temperature records (or install an inlet sensor at a study site) for at least one hold-out location and compare monthly profiles.
- "Evaluated against the CER reference schedules, the per-zone recalibration achieves 0.62 °C mean absolute error using the ambient series it was fitted to, and 1.02 °C when driven by the PVGIS typical-meteorological-year weather the calculator uses at runtime." ✔ supported as of 2026-07-21 (§7.3a, `FIGURES.md` §0b) — this is the sentence to use for accuracy.
- ✘ **Not** supportable: quoting 3.49 °C / 2.39 °C as the *shipped* model's error (those belong to the original US correlation, §5.1a), or presenting 0.705 °C as runtime accuracy when 1.02 °C is now measured.

---

## 9. Traceability

| Item | Location |
|---|---|
| Runtime model | `js/app.js` → `calculateLocalTMains()`, `findClosestBcAusSwhReference()`, `haversineKm()`, `getEffectiveMains()`, `BC_AUS_SWH_REFERENCE_LOCATIONS` |
| Production constants (+ per-zone metrics, SHA-256s, reference series) | `js/bc_aus_zone_constants.js` |
| Generator / fit method | `tools/fit_bc_aus_by_zone.py` (`parse_cer_fixture`, `fit_zone`, `compute_bc_monthly`, `--check`) |
| Superseded Gen-1 fit | `tools/fit_bc_aus.py`, `tools/fit_bc_zone_corrections.py`, `data/bc_aus_constants.js`, `data/bc_zone_corrections.js` |
| Reference fixtures | `validation/fixtures/cer/*.inc` (5 decks); `validation/fixtures/energyplus/*.stat` (5 sites) |
| Postcode registry (display/lookup only) | `js/cer_postcode_zones.js` |
| Automated test (executed, pass) | `validation/unit/test_mains_zones.mjs` via `npm run test:mains-zones` |
| Downstream integration tests (executed, pass) | `validation/unit/test_industry.mjs` (mains-profile blocks) |
| Validation pages | `pages/validation.html` (+6 °F), `validation2.html` (0 °F), `validation3.html` (0.5 m), `validation4.html` (2.0 m), `validation5.html` (formula), `cer_comparison.html` (interactive), `validation-hub.html` (summary) |
| History / audit trail | `docs/independent-model-audit-2026-07-10.md` §6 (identity finding), `docs/audit-report-2026-07.md` §B6, `docs/model-specification.md` (selection policy), `docs/water-mains-temperature-explained.docx` |

*Generated read-only on 2026-07-20; the only repository changes from this session are the two documents under `docs/thesis/`.*

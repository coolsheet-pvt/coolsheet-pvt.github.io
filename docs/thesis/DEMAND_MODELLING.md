# Industry Demand Modelling — Dairy, Brewery and Others

Audit date: 2026-07-21. Branch/commit: `main` @ `6d4cf9c`.
Companion to `docs/thesis/REPOSITORY_TECHNICAL_AUDIT.md` and `docs/thesis/MAINS_WATER_VALIDATION.md` (same evidence conventions: **[VERIFIED-CODE]** read from source, **[VERIFIED-RUN]** executed during this audit, **[DOC-ONLY]**, **[CONFLICT]**, **[MISSING]**).

This document explains how CoolSheet turns an industry throughput into an hour-by-hour heat and electricity demand, and how that demand is matched against PVT supply. **Dairy and brewery are treated as the primary models** and are documented process-by-process with formulas, constants, worked numbers and the reasoning behind each choice. Hotel, aquatic centre and commercial laundry are covered more briefly. A dedicated section (§8) lists every inconsistency or weakness found, ranked, so they can be fixed.

All five demand models live in `js/app.js`. They are called from the industry branches of `calcAnnualPVT()` and produce hourly arrays aligned to the 8,760-record Typical Meteorological Year (TMY).

---

## 1. Why these models exist and what they are (and are not)

The calculator's supply side estimates how much electricity and low-temperature heat a PVT array produces each hour. That is only useful to a site if there is demand to absorb it. The industry demand models generate an **hourly thermal demand** (litres of process water heated from mains temperature to a target) and an **hourly electrical demand**, so the tool can compute how much solar output is actually used (the *solar fraction*), how much is unmet (needs backup), and how much is wasted (exported or dumped). **[VERIFIED-CODE]**

Every model is explicitly a **scenario**, not a certified facility forecast. Each carries an evidence class shown in the UI (`INDUSTRY_EVIDENCE`, `js/app.js`): **[VERIFIED-CODE]**

| Industry | Evidence class (verbatim) | Status |
|---|---|---|
| Dairy | "Australian audit benchmark + engineering assumptions" | "scenario, not a certified site forecast" |
| Brewery | "Literature benchmark + engineering assumptions" | "scenario, not Australian metered validation" |
| Hotel | "NABERS boundary + engineering assumptions" | "scenario, not a NABERS rating" |
| Aquatic | "Physics model + order-of-magnitude Australian cross-check" | "scenario pending facility hold-out validation" |
| Laundry | "First-principles water heating + user assumptions" | "hot-water washing only" |

This honesty is itself a defensible methodological stance for the thesis: the models are transparent, benchmark-anchored and editable, and the UI never claims they are metered truth.

---

## 2. The shared mathematical framework

Dairy, brewery and laundry are all **water-heating** models built on one identity — the sensible heat needed to raise a mass of water through a temperature difference:

```text
Q = m · c_p · ΔT
```

with water density ρ = 1 kg/L and specific heat c_p = 4.184 kJ/kg·K (both implicit constants). In code, for hour *h* of the year:

```text
V_h  = (Throughput · kWater / 365) · seasonalFactor(month) · normHourlyWeight[h]      [litres]
Q_h  = V_h · 4.184 · max(0, T_target − T_mains,day) / 3600                             [kWh]
```

Line-by-line (`calcDairyHourlyDemand` / `calcBreweryHourlyDemand`, `js/app.js`): **[VERIFIED-CODE]**

- **`Throughput · kWater / 365`** — the mean daily volume of process water. `kWater` is litres of heated water per litre of product (milk or beer). Dividing annual throughput by 365 gives a flat daily baseline before seasonal and hourly shaping.
- **`seasonalFactor(month)`** — a 12-value monthly multiplier, **normalised** so its day-weighted annual mean is exactly 1.0 (see §2.1). This bends the flat baseline into the industry's real seasonal production shape without changing the annual total.
- **`normHourlyWeight[h]`** — a 24-value hourly shape, normalised to sum to 1 across a day (`_normW`), placing each process's water use at the clock hours it actually occurs.
- **`4.184 / 3600`** — converts litres·K into kWh (1 kWh = 3600 kJ; ρc_p = 4.184 kJ/L·K).
- **`max(0, T_target − T_mains,day)`** — the temperature lift, floored at zero so the model never invents "negative heat" when mains is already above target. `T_mains,day` is the daily BC-Aus mains-water temperature (`CURRENT_MAINS.byDay[dayN]`; see `MAINS_WATER_VALIDATION.md`).

Electricity is generated the same way but with an intensity per unit product and its own hourly/seasonal shape:

```text
Electrical_h = (Intensity · Throughput_scaled / 365) · seasonalFactor(month) · normElecWeight[h]   [kWh]
```

### 2.1 Seasonal normalisation — why, and what it guarantees

`normalizeSeasonalFactors(seasonal)` (`js/app.js`) scales the 12 raw monthly factors so that `Σ (MONTH_DAYS[m] · factor[m]) = 365`, i.e. the **day-weighted mean is exactly 1.0**. `MONTH_DAYS = [31,28,…,31]` (365-day year, no leap day). **[VERIFIED-CODE]**

The code comment gives the reasoning: *"Without this, the raw dairy factors averaged ~0.94, understating annual demand ~6%."* Normalisation keeps the seasonal *shape* but forces the annual total to land on the stated benchmark. **[VERIFIED-CODE]**

**Precise guarantee (important for the thesis, and a wording risk — see §8-F):**

- Annual **water volume** = `Throughput · kWater` **exactly**, and annual **electricity** = `Intensity · Throughput` **exactly**. This is because the hourly weights sum to 1 per day and the seasonal factors sum (day-weighted) to 365. Verified by `test_industry.mjs` ("Total heated water = 1.37 L/L", "Electrical = 51.7 kWh/kL benchmark", "Day-weighted seasonal sum = 365"). **[VERIFIED-RUN]**
- Annual **thermal energy (kWh)** is **not** fixed by the benchmark, because `ΔT = max(0, T_target − T_mains,day)` varies day to day with the mains profile (and the zero-floor can bind in hot months). The thermal kWh is therefore an emergent product of production seasonality × mains seasonality — physically correct, but it means "normalised so the annual total matches the benchmarks" refers to *water/electricity*, not to heat.

### 2.2 Matching, savings and emissions (shared by all industries)

Each model's thermal series is matched against the PVT thermal supply, and its electrical series against the PV electrical supply, **hour by hour with no storage** (`calculateHourlyEnergyBalance`): `matched = Σ min(supply_h, demand_h)`, plus unmet and excess. A month-level match is retained only as a labelled "ideal storage" upper bound. Savings then follow the shared economics (`thermalFuelSavings = matched_th · 3.6 / boilerEff · gasPrice`, etc.). These are documented in `REPOSITORY_TECHNICAL_AUDIT.md` §12.9 and are identical across the five industries. **[VERIFIED-CODE]**

The demand *shape* therefore matters as much as its total: PVT heat arrives midday in summer, so a demand that peaks in summer daylight (e.g. brewery production peak) is matched better than one that peaks on cold winter mornings.

---

## 3. Dairy model (primary)

Entry point: `industry === "dairy_farm"` branch of `calcAnnualPVT()` → `calcDairyHourlyDemand(throughput_L, "continuous", selectedKeys, met, CURRENT_MAINS, getDairyAssumptions())`. Reasoning/sources rendered by `buildDairyModelBasisHtml()`. **[VERIFIED-CODE]**

### 3.1 Inputs

| UI input id | Meaning | Default | Editable |
|---|---|---|---|
| `throughputInput` | Raw milk throughput (L/yr) | 5,000,000 | yes |
| `dairyElectricKWhPerKL` | Electricity intensity | 51.7 kWh/kL | yes |
| `dairyFattyWater` | Fatty-film rinse water | 0.30 L/L milk | yes |
| `dairyCipWater` | CIP pre-heating water | 0.57 L/L milk | yes |
| `dairyBoilerWater` | Boiler feedwater pre-heat | 0.50 L/L milk | yes |
| `dairyTargetTemp` | Preheat target (all processes) | 35 °C | yes (15–95) |

Operating profile is **forced to "continuous"** (24/7/365) — dairies are biologically continuous (cows are milked daily year-round), so the Mon–Fri option is struck through in the UI and ignored in code. **[VERIFIED-CODE]**

### 3.2 The three thermal processes

`DAIRY_PROCESS_PARAMS` (`js/app.js`), each with a water rate `kWater`, a target temperature, and a 24-hour weight array (index 0 = 00:00): **[VERIFIED-CODE]**

| Process | `kWater` (L/L milk) | Target | Hourly weighting (from `weights24`) | Reasoning (from `buildDairyModelBasisHtml`) |
|---|---:|---:|---|---|
| **A — Fatty film rinse** | 0.30 | 35 °C | 50% at **07:00**, 50% at **17:00** | Pre-/post-milking equipment rinse, tied to the two daily milkings |
| **B — CIP pre-heating** | 0.57 | 35 °C | 25% each at **08:00, 09:00, 17:00, 18:00** | Clean-in-place cycles follow each milking |
| **C — Boiler feedwater pre-heat** | 0.50 | 35 °C | Even across all 24 h | Boiler makeup is a continuous background draw |

Total heated water = 0.30 + 0.57 + 0.50 = **1.37 L per L of milk**. **[VERIFIED-RUN]** (`test_industry.mjs`: "Total heated water = 1.37 L/L").

The hourly weights are the *shape* only; `_normW` divides each array by its sum so it integrates to 1 over the day. Fatty-film → 0.5/0.5; CIP → 0.25×4; boiler → 1/24 each. **[VERIFIED-CODE]**

### 3.3 Seasonal factors

`DAIRY_SEASONAL = [0.85, 0.80, 0.85, 0.90, 0.85, 0.75, 0.75, 0.80, 1.10, 1.30, 1.30, 1.05]` (Jan→Dec). **[VERIFIED-CODE]** Peaks in **Sep–Nov (1.10–1.30)**, reflecting the Australian spring calving / peak-milk period; trough in winter (0.75). After `normalizeSeasonalFactors`, the day-weighted mean is 1.0, so annual milk-water and electricity totals are preserved while the monthly demand tracks real production.

### 3.4 Electricity

`DAIRY_ELEC_PARAMS = { kWhPerKL: 51.7, weights24: […] }`. Annual electricity = `51.7 · (Throughput_L / 1000)` kWh, shaped by the same seasonal factor and a fixed hourly profile that **peaks 05:00–07:00 and 15:00–17:00** (vacuum pumps, milk cooling and CIP around the two milkings), with a low overnight baseload. **[VERIFIED-CODE]** Only the intensity is editable; the hourly shape is fixed.

### 3.5 Worked example (illustrative, constant mains)

Throughput 5,000,000 L/yr, all three processes selected, target 35 °C, mains held at 18 °C:

- Annual heated water = 1.37 × 5,000,000 = **6,850,000 L**.
- ΔT = 35 − 18 = 17 K.
- Annual thermal ≈ 6,850,000 × 4.184 × 17 / 3600 ≈ **135,300 kWh/yr**.
- Annual electricity = 51.7 × 5,000 kL = **258,500 kWh/yr**.

With the real daily mains profile (Sydney fixture, mean 18.0 °C but 13–23 °C seasonal) the thermal figure is ≈133,600 kWh/yr — slightly lower because summer mains rises toward the 35 °C target, shrinking ΔT. This ~1% difference and its seasonal redistribution is exactly the mains-sensitivity effect quantified in `FIGURES.md` (Figure 6). **[VERIFIED-RUN]** (production functions executed over the fixture).

### 3.6 Sources and evidence (dairy)

The model-basis panel cites Australian context: RACE for 2030, the Northern Australian Dairy Hub "Dairy Shed Energy Use Check", Eco-efficiency for the Dairy Processing Industry, and Energy Smart Farming. The **51.7 kWh/kL** intensity is cross-checked against the Australian dairy audit range **27–75 kWh/kL (mean ≈48)**, so it sits near the national average. **[VERIFIED-CODE]**

**Evidence gap (see §8-C):** the primary justification for the exact water rates (0.30/0.57/0.50 L/L) and the hourly weightings is an **internal, unpublished report** — in code the link is disabled (`dairyPdfHref = "#"`). So the electricity intensity has a public cross-check, but the per-process water splits and schedules rest on an unpublished source.

---

## 4. Brewery model (primary)

Entry point: `industry === "brewery"` branch → `calcBreweryHourlyDemand(...)`. Reasoning by `buildBreweryModelBasisHtml()`. Structurally identical to dairy: same `V_h → Q_h` water-heating identity, same seasonal-normalisation machinery, per-process hourly weights. **[VERIFIED-CODE]**

### 4.1 Inputs

| UI input id | Meaning | Default |
|---|---|---|
| `throughputInput` | Beer produced (L/yr) | 500,000 |
| `breweryElectricKWhPerHL` | Electricity intensity | 11.5 kWh/hL |
| `breweryCipWater` | CIP pre-rinse water | 0.80 L/L beer |
| `breweryRinseWater` | Bottle/keg rinse water | 0.45 L/L beer |
| `breweryBoilerWater` | Boiler feedwater pre-heat | 0.60 L/L beer |
| `breweryCipTarget` | CIP / boiler preheat target | 45 °C |
| `breweryRinseTarget` | Bottle/keg rinse target | 40 °C |

Profile forced to "continuous" (see §8-D — brewery runs 24/7/365, weekend shutdown not modelled).

### 4.2 The three thermal processes

`BREWERY_PROCESS_PARAMS`: **[VERIFIED-CODE]**

| Process | `kWater` (L/L beer) | Target | Hourly shape | Reasoning (from model basis) |
|---|---:|---:|---|---|
| **A — CIP pre-rinse** | 0.80 | 45 °C | Single extended shift, ramping to a **14:00–16:00 peak** | Warm water strips yeast/protein/hop residue before caustic/steam — the PVT-eligible pre-rinse |
| **B — Bottle/keg rinsing** | 0.45 | 40 °C | Packaging day-shift, plateau **10:00–15:00** | Moderate-temp rinse avoids thermal shock, supports packaging hygiene |
| **C — Boiler feedwater pre-heat** | 0.60 | 45 °C | Follows wort boil, peak **10:00–11:00** | PVT handles only the low-temp lift to 45 °C; the boiler still provides the final steam lift |

Total warm water = 0.80 + 0.45 + 0.60 = **1.85 L per L of beer**. **[VERIFIED-RUN]** ("Total warm water = 1.85 L/L beer"). In `getBreweryAssumptions`, the boiler-preheat target is tied to the **CIP target** (both 45 °C), and the rinse target is separate (40 °C). **[VERIFIED-CODE]**

**Design boundary (well-reasoned, worth quoting in the thesis):** all three processes are capped at 40–45 °C, so *"the brewery model is explicitly limited to direct PVT-eligible pre-heating rather than full steam duty."* PVT cannot make process steam; the model only claims the low-temperature pre-heat that a flat-plate/PVT collector can realistically deliver. **[VERIFIED-CODE]**

### 4.3 Seasonal factors

`BREWERY_SEASONAL = [1.25, 1.10, 0.95, 0.85, 0.80, 0.75, 0.78, 0.88, 1.05, 1.15, 1.22, 1.35]`. **[VERIFIED-CODE]** **Summer-peaked** (Dec 1.35, Jan 1.25; winter trough Jun 0.75), reflecting Australian beer-consumption/production seasonality. Sources cited: an R-based beer-production time-series analysis and a Kaggle Australian-beer-production forecast. Note this is a *consumption/production* seasonality proxy, not a metered brewery load curve (see §8-E).

The summer peak is favourable for solar matching: brewery demand and PVT supply both peak in summer daylight — but the *thermal* demand's ΔT is smallest then (warm mains), so the two effects partly offset.

### 4.4 Electricity

`BREWERY_ELEC_PARAMS = { kWhPerHL: 11.50, kWhPerL: 0.115 }`. Annual electricity = `(kWhPerHL / 100) · Throughput_L` (1 hL = 100 L). Hourly profile: **~0.40 overnight baseload** (continuous refrigeration) rising to a **~1.0 daytime plateau** (brewhouse + packaging). **[VERIFIED-CODE]** Editable intensity; fixed shape.

### 4.5 Worked example

Throughput 500,000 L/yr:

- Annual warm water = 1.85 × 500,000 = **925,000 L**.
- Annual electricity = 0.115 × 500,000 = **57,500 kWh/yr** (= 11.5 kWh/hL × 5,000 hL). **[VERIFIED-RUN]** ("Electrical = 11.50 kWh/hL benchmark").
- Thermal depends on the three per-process ΔTs against daily mains; with mains 18 °C: CIP 0.80 L/L at 45 °C (ΔT 27), rinse 0.45 L/L at 40 °C (ΔT 22), boiler 0.60 L/L at 45 °C (ΔT 27).

### 4.6 Sources and evidence (brewery)

The model basis cites CIP-optimisation literature, packaging/pasteurisation references, boiler-feedwater and brewhouse-energy studies, and RACE for 2030 / solar-process-heat work for the PVT boundary. Unlike dairy, brewery links are all public. **Caveat:** the exact 1.85 L/L and 11.5 kWh/hL rest mainly on **international/secondary** sources; the audit flags them as "not Australian metered validation" (§8-E). **[VERIFIED-CODE]**

---

## 5. Hotel model (secondary)

Entry point: `industry === "hotel"` branch; helpers `hotelProcessWeight`, `hotelProcessWeightSum`, `calcHotelElectricalHourlyDemand`, `getHotelRealityCheck`; reasoning `buildHotelModelBasisHtml`. **[VERIFIED-CODE]**

- **Basis:** energy per **occupied room-night**, not per litre. Occupied room-nights = `rooms × 365 × occupancy%`.
- **Thermal processes** (`HOTEL_PROCESS_PARAMS`, kWh/occupied-room-night): domestic hot water 4.5, kitchen/dishwashing 1.6, laundry 1.2, pool heating 4.2. Each has its own 24-hour and 12-month weight arrays (`HOTEL_HOURLY_WEIGHTS`, `HOTEL_MONTHLY_FACTORS`), normalised so annual totals are preserved exactly.
- **Electricity:** 15 kWh/room-night, shaped by an hourly profile × monthly factor × an **ambient weather factor** (`calcHotelElectricalWeatherFactor`: cooling-degree slope above `coolingBaseC`, heating-degree below `heatingBaseC`, clamped) — so hot and cold hours draw more, while the annual benchmark is preserved.
- **Reality Check** (`getHotelRealityCheck`): optional metered fuel (annual GJ or 12 monthly values) × `GJ_TO_KWH` (1000/3.6) × boiler efficiency → useful heat; can calibrate the modelled profile to a meter.
- **Evidence:** NABERS Hotels v4.3 and SA Water. Critically, **NABERS is whole-building** and does **not** validate the per-process kWh/room-night decomposition — stated in-app. DHW was tuned 5.5→4.5 kWh/room-night to match the SA Water ≈3 kWh/guest-night benchmark.

## 6. Aquatic-centre model (secondary)

Entry point: `industry === "aquatic_centres"` → `calcAquaticHourlyDemand`; reasoning `buildAquaticModelBasisHtml`. This is a **physics** model, not a throughput model. Per pool type (indoor/outdoor/kids/sauna, `AQUATIC_PROCESS_PARAMS`), per m² of water surface, per hour: **[VERIFIED-CODE]**

```text
Evaporation = coeff · (1 + 0.22·wind) · (P_water − P_air) · splash · area · 0.68 kWh/kg    (latent)
Makeup      = (L/m²/day · area / openHours) · c_p · max(0, T_target − T_mains,day)
Sensible    = (U_conv + U_rad) · area · max(0, T_target − T_air) / 1000
```

Saturation vapour pressures use the Tetens/Magnus form (`saturationVaporPressureKPa`); outdoor pools use validated PVGIS relative humidity, indoor pools a fixed design RH. A pool cover cuts off-hour evaporation by 60%. Evaporation dominates (~56%), matching the ASHRAE/EnergyPlus split. Electricity = area × 250 kWh/m²/yr, split 55% base + 45% tracking the thermal shape. **[VERIFIED-CODE]** Sources: ASHRAE/Shah evaporation, EnergyPlus pool model, Sydney Water, NSW Government, Deakin (Victoria). Caveat: water-surface-area denominator must not be compared directly with conditioned-floor-area benchmarks.

## 7. Commercial-laundry model (secondary)

Entry point: `industry === "commercial_laundry"` → `calcCommercialLaundryHourlyDemand`; reasoning `buildLaundryModelBasisHtml`. **Hot-water washing only** — drying, ironing, steam finishing, motors, ventilation and whole-site electricity are explicitly out of scope (the electrical series is all zeros). **[VERIFIED-CODE]**

```text
Annual kg   = kg/day · operatingDays/week · 52
Q_wash      = kg_h · L/kg · hotFraction   · c_p · max(0, T_wash  − T_mains,day)
Q_rinse     = kg_h · L/kg · rinseFraction · c_p · max(0, T_rinse − T_mains,day)
Q_loss      = (selected Q_wash + Q_rinse) · userLossFraction     (default loss 0)
```

Mass is spread over operating days and a daytime shift (08:00–17:00). Water use is exposed as editable sensitivity cases (10/12/15/17/22 L/kg) because **WELS does not yet regulate commercial clothes washers** — there is no Australian regulatory benchmark to anchor to. **[VERIFIED-CODE]** Verified against a hand calc `Q = m c_p ΔT` in `test_industry.mjs`. **[VERIFIED-RUN]**

---

## 8. Issues, inconsistencies and weaknesses (ranked)

These are candidates to fix or to disclose in the thesis. None are arithmetic errors in the core `Q = mc_pΔT` path — that is verified by tests. They are scope, evidence and code-hygiene issues.

### High / medium — worth addressing before the thesis leans on them

**8-C · [MISSING] Dairy's core assumptions rest on an unpublished source.** The exact water splits (0.30/0.57/0.50 L/L milk) and the hourly weightings are justified only by an internal report; in code the citation link is disabled (`dairyPdfHref = "#"`, `buildDairyModelBasisHtml`). Only the 51.7 kWh/kL electricity intensity has a public cross-check (27–75 kWh/kL range). **Impact:** a thesis reader cannot verify the dairy water model against a citable Australian source. **Fix options:** (a) find a public substitute source for the process-water splits, (b) reframe them explicitly as "engineering assumptions pending site-meter validation" (the UI already hedges this way), or (c) obtain permission to publish the internal report. This is the single biggest evidence gap in the demand modelling. **[VERIFIED-CODE]**

**8-D · [CONFLICT] Brewery is modelled as 24/7/365; real breweries are not.** `calcBreweryHourlyDemand` hardcodes `dayOn = 1` with the comment *"Brewery baseline currently assumes year-round operation; weekday shutdown scaling is not yet applied."* The `isMonToFriDay` helper exists but is unused here. **Impact:** annual totals are preserved (normalisation), but demand is spread onto weekends when many craft breweries are idle, flattening the weekly load and changing hour-by-hour solar matching. **Fix:** apply an operating-day weight (as commercial laundry already does via `laundryOperatingDayWeight`) or expose an operating-days input. Medium severity. **[VERIFIED-CODE]**

**8-E · [DOC-ONLY→scenario] Brewery defaults are international/literature, not Australian-metered.** 1.85 L/L and 11.5 kWh/hL draw mainly on secondary/vendor/international sources; the seasonal curve is a beer-*production/consumption* proxy, not a metered brewery thermal load. **Fix:** label as scenario (already done in `INDUSTRY_EVIDENCE`) and, for the thesis, validate against one metered Australian brewery if possible. Medium. **[VERIFIED-CODE]**

**8-G · [scope clarity] "CIP" and "boiler feedwater" are modelled as 35–45 °C pre-heats, not full duty.** Dairy heats *all* processes to a single 35 °C (`dairyTargetTemp`); real CIP often needs 60–80 °C. Brewery caps at 45 °C. This is a deliberate PVT-preheat boundary (explicit for brewery, implicit for dairy), but the process labels ("CIP pre-heating", "Boiler feedwater pre-heating") could be read as full-duty. **Fix:** state in the thesis that these are the *PVT-eligible low-temperature fraction* of each duty, not the whole CIP/boiler load. Medium (framing). **[VERIFIED-CODE]**

### Low — cosmetic or maintainability

**8-F · [wording] ~~"Normalised so the annual total matches the benchmarks" is precise for water/electricity, loose for heat.~~ FIXED 2026-07-21.** The guarantee is on water volume and electricity, not thermal kWh (§2.1). **Fix applied:** both `buildDairyModelBasisHtml` and `buildBreweryModelBasisHtml` now carry a note stating normalisation fixes the water/electricity totals while the thermal kWh follows Q = m c_p ΔT with the daily mains temperature. Display-only; offline suite still 100% green. **[VERIFIED-RUN]**

**8-B · [stale display] ~~Model-basis "How it works" formulas show hard-coded literals.~~ FIXED 2026-07-21.** `buildDairyModelBasisHtml` printed `Electrical_h = (51.7 …)` with a hard-coded target of 35 °C, and `buildBreweryModelBasisHtml` printed `(0.115 …)`, while the key-values table above showed the *live editable* value. **Fix applied:** the dairy electrical intensity, both dairy heat-formula target temperatures, and the brewery electrical intensity are now interpolated from the live inputs (`D.electricalKWhPerKL`, `DP.fatty_film_rinse.T_target`, `B.electricalKWhPerHL/100`). Verified in-browser by editing the inputs to non-defaults and confirming the rendered formulas track them (e.g. intensity 60 → `(60.0 x …)`, target 50 → `max(0, 50 - T_mains)`, 20 kWh/hL → `(0.200 x …)`). Display-only; no calculation path touched. **[VERIFIED-RUN]**

**8-G(dairy) · [scope clarity] ADDRESSED 2026-07-21.** The dairy panel previously lacked the explicit "PVT pre-heat only" framing that the brewery panel already had. **Fix applied:** a note now states the target is the low-temperature PVT pre-heat duty, not the full CIP/boiler temperature (a boiler still provides any final high-temperature lift). The broader labelling concern (§8-G below) is unchanged.

**8-A · [dead code] The operating-profile selector is inert for dairy and brewery.** Both branches hardcode `"continuous"`; the passed `profileType` argument, the `dayOn` variable and (for these two) `isMonToFriDay` are effectively dead. Consistent with the struck-through UI option, but misleading to a maintainer. **Fix:** drop the unused parameter/branch or wire the selector. Low. **[VERIFIED-CODE]**

### Checked and cleared (not issues)

- Unit conversions (`4.184/3600`, `/1000` for kL, `/100` for hL) are dimensionally correct throughout. **[VERIFIED-RUN]**
- The 0-floor on ΔT (`max(0, …)`) correctly prevents negative demand when mains exceeds target.
- Hourly weights integrate to 1/day and seasonal factors are day-weighted to 365, so annual water/electricity totals equal the stated benchmarks (three passing tests). **[VERIFIED-RUN]**
- Thermal matched against PVT thermal supply, electrical against PV electrical supply — no cross-wiring. **[VERIFIED-CODE]**
- Boiler efficiency is applied in the correct direction (÷η on displaced fuel) in savings. **[VERIFIED-CODE]**

---

## 9. Traceability index

| Concept | `js/app.js` symbol |
|---|---|
| Dairy demand | `calcDairyHourlyDemand()`, `DAIRY_PROCESS_PARAMS`, `DAIRY_ELEC_PARAMS`, `DAIRY_SEASONAL`, `getDairyAssumptions()` |
| Dairy reasoning/sources | `buildDairyModelBasisHtml()`, `buildDairyWeightingGraphHtml()` |
| Brewery demand | `calcBreweryHourlyDemand()`, `BREWERY_PROCESS_PARAMS`, `BREWERY_ELEC_PARAMS`, `BREWERY_SEASONAL`, `getBreweryAssumptions()` |
| Brewery reasoning/sources | `buildBreweryModelBasisHtml()`, `buildBreweryWeightingGraphHtml()`, `buildWeightSummary()` |
| Shared framework | `normalizeSeasonalFactors()`, `_normW()`, `hourIndexFromHourN()`, `isMonToFriDay()`, `monthFromDayN()`, `MONTH_DAYS` |
| Hotel | hotel branch, `hotelProcessWeight()`, `calcHotelElectricalHourlyDemand()`, `calcHotelElectricalWeatherFactor()`, `getHotelRealityCheck()`, `HOTEL_PROCESS_PARAMS`, `buildHotelModelBasisHtml()` |
| Aquatic | `calcAquaticHourlyDemand()`, `saturationVaporPressureKPa()`, `AQUATIC_PROCESS_PARAMS`, `buildAquaticModelBasisHtml()` |
| Laundry | `calcCommercialLaundryHourlyDemand()`, `laundryOperatingDayWeight()`, `LAUNDRY_DEFAULTS`, `buildLaundryModelBasisHtml()` |
| Matching / savings | `calculateHourlyEnergyBalance()`, `calculateHourlyElectricityBalance()`, `calculateMonthlyEnergyBalance()` |
| Evidence classes | `INDUSTRY_EVIDENCE`, `industryEvidenceText()` |
| Tests | `validation/unit/test_industry.mjs`, `validation/unit/test_industry_evidence.mjs` |

*Generated read-only 2026-07-21 against `main` @ `6d4cf9c`. No repository source file was modified to produce this document.*

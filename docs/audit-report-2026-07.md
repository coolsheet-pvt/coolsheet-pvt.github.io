# Full Codebase Audit - July 2026 (v13.11 → v13.12)

Senior-review audit of formula correctness, unit consistency, numerical robustness,
code quality, and UI/UX. **Model A and Model B were treated as frozen reference
models: no equation, coefficient, sign, iteration, or output was changed.**
All Model A/B lock tests pass unchanged before and after this audit.

---

## A. Calculation flow map

```
User inputs (index.html)
  │  address, area A (m²), tilt (°), azimuth (° 0=N), albedo (0–1),
  │  flow rate (L/s/m²), ηPV (0–1), γ (%/°C), NOCT (°C),
  │  Model A a0/a1/a2  or  Model B η0,a1,a2,a3,a4,a6,a8,Tout0,iterMax,
  │  industry + throughput + processes, prices, boiler η, CAPEX/OPEX/life/discount
  ▼
Geocoding (Nominatim) → lat/lon
  ▼
Weather backend (pvt-tmy-api/server.py, FastAPI + pvlib)
  │  PVGIS TMY → 8,760 records {dayN 1–365, hourN 1–24 local clock,
  │  solarHour (true solar time, EoT + longitude corrected), dni, dhi, ghi,
  │  ta (°C), vwind (m/s, 10 m)} + IANA timezone
  ▼
normalizeWeatherRecords()  (hourN → 0–23; field-name tolerant)
  ▼
Mains water (calculateLocalTMains - BC-Aus)
  │  °F-domain NREL Burch–Christensen sinusoid, zone-refit constants
  │  (bc_aus_zone_constants.js, nearest CER zone by climate similarity),
  │  southern-hemisphere 182-day phase shift → byDay[1..365] °C
  │  Optional user monthly overrides (step profile) → CURRENT_MAINS
  ▼
Hourly supply loop (calcAnnualPVT, 8,760 steps)
  │  TiltedSurfaceRadiation: Cooper declination, hour angle from solarHour,
  │  isotropic transposition → G (W/m² POA)   [validated vs pvlib ≤0.2 %]
  │  Tin = mains byDay
  │  ── Model A (frozen): η = clamp(a0 + a1·(Tin−Ta)/G + a2·u, 0, 1); Q̇ = η·G·A
  │  ── Model B (frozen): ISO 9806 Eq.12, Tm=(Tin+Tout)/2, Newton on Tout,
  │       Q̇ = ṁcp(Tout−Tin), Swinbank E_L when a4>0, Q̇ clamped ≥ 0
  │  Tout = Tin + Q(kWh)·3600 / (ṁ(kg/h)·4.184)
  │  PV: pv_stc = ηPV·G·A/1000 (kWh); NOCT cell temp; PVT cell temp =
  │       NOCT − Q̇/(U_L·A), clamped [Tin, uncooled]; P·[1+γ(Tcell−25)] ≥ 0
  ▼
Demand models (hourly kWh series)
  │  dairy / brewery: throughput·kWater/365 · seasonal(normalised) · weights24
  │       → V_h; Q_h = V_h·4.184·max(0,Ttarget−Tmains)/3600
  │  hotel: kWh/occupied-room-night × hourly/monthly weights (+ storage tank sim)
  │  aquatic: per-m² evaporation + makeup + sensible loss physics
  │  laundry: kg/day schedule × L/kg × cp·ΔT
  ▼
Hourly matching (calculateHourlyEnergyBalance)  - no storage, direct-use
  │  met = Σ min(S_h, D_h); unmet; excess; solar fraction
  │  (monthly matching kept only as "ideal storage" upper bound)
  ▼
Economics & emissions
  │  elec saving = met_e × price; export = excess_e × FiT;
  │  heat saving = met_th × 3.6 / boilerη × gas $/MJ;
  │  CAPEX = $/m²·A; OPEX = %CAPEX; SPP; NPV (annuity); CRF; LCOE/LCOH split;
  │  CO₂-e = met_e × grid kg/kWh + gas GJ × 51.4 kg/GJ (NGA 2025)
  ▼
Outputs
     summary cards ▸ detail tables ▸ SVG demand charts ▸ Chart.js supply charts
     ▸ hourly CSV ▸ summary CSV ▸ PDF report window ▸ share link (#s= base64)
     - all fed from CURRENT_CALC_RESULT (single calculation state)
```

---

## B. Formula audit table

Status legend: ✅ correct · 🔧 fixed this audit · ⚠️ questionable (flagged, unchanged) ·
🔍 needs external validation · 🔒 frozen Model A/B (verified, locked, unchanged).

| # | Formula / calculation | Location (app.js) | Units in → out | Status | Notes |
|---|---|---|---|---|---|
| 1 | Cooper declination δ = 23.45·sin(360/365·(n+284)) | `declinationAngle` | day → ° | ✅ | ±1.5° known Cooper error, tested |
| 2 | Hour angle ω = 15(h−12) | `hourAngle` | solar h → ° | ✅ | uses backend true solar time; clock-hour fallback documented |
| 3 | cos θz = sinδ sinφ + cosδ cosφ cosω | `zenithAngle` | ° | ✅ | clamped acos |
| 4 | Incidence angle (Duffie–Beckman 1.6.2, γ = azimuth−180) | `incidenceAngle` | ° | ✅ | 0°=N UI convention converted correctly; works in southern hemisphere |
| 5 | Isotropic POA = DNI·cosθi + DHI·(1+cosβ)/2 + GHI·ρ·(1−cosβ)/2 | `calculate` | W/m² | ✅ | validated vs pvlib isotropic ≤0.2 % annual (golden reference) |
| 6 | BC-Aus mains: T = (T̄a,F+offset) + ratio·(ΔT_F/2)·sin(0.986(d−15−lag)−90°) | `calculateLocalTMains` | °F internally → °C | ✅ | NREL Burch–Christensen form verified; southern-hemisphere phase shift correct; zone constants fitted separately |
| 7 | Model A: η = clamp(a0 + a1(Tin−Ta)/G + a2·u, 0, 1); Q̇=ηGA | main loop | °C, W/m², m/s → W | 🔒 | matches displayed equation exactly; a1<0 = heat loss; see §D |
| 8 | Model B: ISO 9806 Eq.12 + Newton on Tout | main loop | °C, W/m², m/s, kg/h → W | 🔒 | matches displayed equation; derivative algebra verified term-by-term (d(dT)/dTout=½); see §D |
| 9 | Swinbank E_L = 5.31e-13·Ta_K⁶; net = E_L − σTa_K⁴ | main loop | K → W/m² | 🔒 | Kelvin used correctly; only active when a4>0 (default 0) |
| 10 | ṁ = flow(L/s/m²)·A·3600 → kg/h; ṁcp = ṁ/3600·4184 W/K | main loop | ✓ dims check | ✅ | water ρ=1 kg/L implicit (fine for mains temps) |
| 11 | Tout = Tin + Q_kWh·3600/(ṁ_kg/h·4.184) | main loop | kWh, kg/h → °C | ✅ | dimensionally exact; equals Model B's internal Tout |
| 12 | NOCT cell temp T = Ta + G/800·(NOCT−20) | `calcNoctPanelTempC` | °C, W/m² | ✅ | standard NOCT form; returns Ta at night |
| 13 | PVT cell temp = NOCT temp − Q̇/(U_L·A), clamp [Tin, uncooled] | `calcPvtPanelTempC` | W, W/m²K, m² → °C | ⚠️ | heuristic: U_L borrowed from Model A/B a1; bounded so it cannot create unrealistic gains; **feeds economics** (comment corrected 🔧) |
| 14 | PV factor = max(0, 1 + γ(Tcell−25)) | `calcPvTemperatureFactor` | %/°C→1/°C ✓ | ✅ | γ entered as %/°C, divided by 100 once |
| 15 | pv_stc = ηPV·G·A/1000 | main loop | W → kWh/h | ✅ | P_STC = ηPV·1000 W/m² implicit; **no inverter/wiring/soiling losses - DC-optimistic ~10–14 % vs PVGIS "loss 14 %"** (documented in validation/pv-only-benchmark.md) |
| 16 | Dairy/brewery V_h = T·kWater/365·seas·w_h; Q=V·4.184·ΔT/3600 | `calcDairyHourlyDemand`, `calcBrewery...` | L, °C → kWh | ✅ | seasonal factors day-weight normalised so annual = benchmark; tested to 1 % |
| 17 | Dairy elec 51.7 kWh/kL; brewery 11.5 kWh/hL | same | ✅/🔍 | benchmarks locked by tests; source PDFs cited in model-basis modals, one internal (unpublished) |
| 18 | Hotel Q = room-nights·kWh/unit, weights normalised over year | hotel branch | kWh | ✅ | annual preserved exactly (÷ weight sum); DHW 4.5 kWh/rn 🔍 (SA Water/NABERS-implied) |
| 19 | Hotel tank: cap = V·4.184·(35−Tmains)/3600 kWh; hourly charge/draw | `calculateThermalStorage` | L, °C → kWh | 🔧/⚠️ | capacity now follows the daily mains profile (C6); 35 °C target still hard-coded; lossless tank (labelled in UI) |
| 20 | Aquatic evaporation = c·(1+0.22u)·(Pw−Pa)·splash·A·0.68 | `calcAquaticHourlyDemand` | kPa, m/s, m² → kWh | ✅/🔍 | Shah/ASHRAE-form; magnitudes plausible (~6–8 L/m²/day Sydney); fixed design RH per pool (TMY has no RH - wording fixed 🔧) |
| 21 | Aquatic makeup = L/m²/day ÷ open-h × cp × (Ttarget−Tmains) | same | 🔧 | now uses daily mains byDay (was annual average - fixed as C6, user-approved) |
| 22 | Aquatic sensible = (Uconv+Urad)·A·(Ttarget−Tair)/1000 | same | W/m²K → kWh | ✅ | 1 h timestep implicit |
| 23 | Saturation vapour pressure (Tetens 0.61078·e^(17.2694T/(T+237.3))) | `saturationVaporPressureKPa` | °C → kPa | ✅ | standard Tetens/Magnus |
| 24 | Laundry Q = kg_h·L/kg·fraction·cp·ΔT | `calcCommercialLaundryHourlyDemand` | ✅ | uses daily mains ✓; annual kg = kg/day·days/wk·52 (364-day year, consistent internally) |
| 25 | Hourly balance met=Σmin(S,D) etc. | `calculateHourlyEnergyBalance` | kWh | ✅ | honest no-storage baseline; monthly variant only as storage upper bound (labelled) |
| 26 | Heat saving = met_th·3.6/boilerη·gas$/MJ | all branches | kWh→MJ→AUD | ✅ | boiler efficiency in correct direction (÷); tested |
| 27 | Elec saving = met_e·price; export = excess_e·FiT | all branches | kWh·AUD/kWh | ✅ | no double counting (met + excess disjoint) |
| 28 | CO₂-e = met_e·EF_grid + (met_th·3.6/η/1000)·51.4, ÷1000 t | `buildSavingsTable` | kWh·kg/kWh + GJ·kg/GJ | ✅/🔍 | dims correct; DCCEEW NGA-2025 factor values not independently verifiable offline |
| 29 | CRF = i(1+i)^N/((1+i)^N−1); NPV = −C + B·annuity; SPP = C/B | supply card | ✅ | textbook-verified by tests; i→0 limits handled |
| 30 | LCOE/LCOH energy-weighted CAPEX split (f_th2e = 1) | supply card | ⚠️ | 1 kWh heat valued = 1 kWh elec for the *split only*; explicitly labelled in UI; not an exergy weighting |
| 31 | Supply "annual value" = E_pv·price + heat saving − OPEX | supply card | ✅ | 100 % utilisation upper bound - labelled as such in UI |
| 32 | Installed cost: $/W × ηPV·1000 W/m² → $/m²; ÷10.764 → $/ft² | `getInstalledCostBasis` | ✅ | |
| 33 | Monthly/daily chart aggregation | `aggregateMonthlyAll/DailyAll` | kWh | 🔧 | **was timezone/leap-year sensitive (dropped Jan 1, shifted all days). Now keyed on TMY dayN - fixed** |
| 34 | Economics input parsing | `calcAnnualPVT` reads | - | 🔧 | **explicit 0 was silently replaced by defaults (CAPEX 0→800 etc.). Fixed via finite-check parsing** |
| 35 | Weather export metadata annual sums (Wh→kWh) | `buildWeatherExportMetadata` | ✅ | |
| 36 | PVGIS cross-check link (peakpower kW = A·ηPV; aspect = az−180 normalised) | `buildPvgisValidationLink` | ✅ | azimuth convention conversion verified both hemispheres |

---

## C. Bugs found and fixed (all outside Model A/B)

### C1 - Supply chart/table aggregation shifted by one day and dropped Jan 1 (MEDIUM, fixed)
- **Where:** `calcAnnualPVT` timeSeries construction + `aggregateMonthlyAll` + `aggregateDailyAll`.
- **Problem:** date strings were built with `new Date(BASE_YEAR,0,1) … .toISOString().slice(0,10)` and re-parsed with `new Date(string)`. `toISOString()` is UTC; parsing a date-only string is UTC; the getters are local-time. In **any non-UTC browser timezone** (this machine is UTC+10) every day shifted one day earlier: Jan 1 disappeared from the monthly/daily charts and tables, Feb 1's energy was counted in January, and daily rows were labelled one day off. In leap display-years the mapping also drifted after Feb 28 and created a phantom Feb 29 slot.
- **Fix:** month/day now derive directly from the TMY `dayN` via the fixed 365-day calendar (`monthDayFromDayN`); no `Date` round-trip anywhere in the aggregation path.
- **Effect on results:** annual totals, economics, industry matching, CSV hourly detail were **never affected** (they aggregate by `dayN`). Only the Chart.js monthly/daily supply charts and their tables change - they are now correct and identical in every timezone. Verified live: sum of 12 monthly PVT values now equals the annual figure exactly (91,479.4 = 91,479.4 kWh, Sydney fixture, 250 m²).
- **Tests:** `validation/unit/test_supply_aggregation.mjs` (26 assertions, explicit expected values, source-locks against reintroducing `toISOString()`).

### C2 - Explicit “0” in economics inputs silently replaced by defaults (MEDIUM, fixed)
- **Where:** input reads at the top of `calcAnnualPVT`.
- **Problem:** `parseFloat(x) || fallback` treats `0` as falsy. Entering 0 gave: CAPEX 0 → **800 AUD/m²**, OPEX 0 %/yr → **1.5 %**, discount 0 % → **6 %**, system life 0 → 25. NPV/SPP/LCOE silently computed with values the user did not enter.
- **Fix:** all economics reads now use the existing `getInputNumber` (finite-check) helper; blank/invalid still falls back to the documented default; range clamps unchanged. `boilerEff` entered as 0 now clamps to the documented floor 0.5 instead of silently becoming 0.85 (0 was always out of the 0.5–1 range).
- **Deliberately NOT changed:** Model B coefficient reads (`isoEta0 … isoIterMax`) still use `|| default` - changing them would alter frozen-model behaviour for the "user types 0" case. Documented in §D as a known trap with a recommended future fix.
- **Tests:** `validation/unit/test_input_parsing.mjs` (22 assertions incl. source-locks that the frozen reads are untouched).

### C3 - Incorrect code comment: panel-temperature model claimed “comparison-only” (LOW, fixed)
- **Where:** NOCT block header comment (~line 4940).
- **Problem:** comment said the PVT cell-temperature correction "feeds the PV temp-correction display, not the economics". False: `pvtFactor` scales `pv_kWh → E_pv_kWh`, which drives electricity savings, payback, NPV, and the industry electricity balance.
- **Fix:** comment corrected. (Behaviour unchanged - this was documentation.)

### C4 - Misleading UI text: aquatic humidity "from TMY" (LOW, fixed)
- **Where:** aquatic detailed-results assumption callout.
- **Problem:** claimed evaporation uses "relative humidity when available from TMY". The TMY feed carries no humidity field; the model uses a fixed design RH per pool type (50–62 %).
- **Fix:** wording now states the fixed design RH and that TMY has no humidity data.

### C5 - Dead code removed (LOW, fixed)
All verified unreferenced by grep across app, pages, and the whole test suite:
- `TiltedSurfaceRadiation.beamRadiationRatio` (never called),
- `calculateMonthlyElectricityBalance` (never called),
- `buildIndustryQuickRead` (never called),
- aquatic branch dead economics (`pvtRatedWp/pvCapex/thermalCapex/panelSubtotal/installedCapex/simplePaybackYears` - computed then discarded) and their constants `PVT_CAPEX_PV_PER_W`, `PVT_CAPEX_THERMAL_PER_W`, `PVT_BOS_MULTIPLIER`.
- **Approved and removed:** the "Evan view" machinery (`buildEvanIndustryViewHtml`, `renderHotelPrimaryChart`, `renderAquaticPrimaryChart`, `renderCurrentEvanView`, `formatEvanMetricValue`, `buildPrimaryLegend`, `renderMetricCards*`, `CURRENT_EVAN_VIEW`, `evanPrimaryChartInstance`) - it was unreachable (`CURRENT_EVAN_VIEW` was only ever assigned `null`). Recoverable from git history.

### C6 - Aquatic makeup water & hotel tank now use the daily mains profile (MEDIUM, fixed - user-approved)
- **Where:** `calcAquaticHourlyDemand` (makeup ΔT) and `calculateThermalStorage` (tank capacity).
- **Problem:** both used the *annual-average* mains temperature while dairy, brewery, and laundry use the daily BC-Aus profile - inconsistent with the UI statement that T_in comes from the monthly mains model. Aquatic winter demand was understated and summer demand overstated.
- **Fix:** aquatic makeup ΔT now uses `mains.byDay[dayN]` (scalar fallback retained for callers without a mains model); the hotel tank accepts an optional per-hour mains array - usable capacity now varies seasonally, and the reported capacity is the annual average (identical to the old scalar when the profile is flat).
- **Effect on results:** aquatic annual totals are nearly unchanged when the mains swing is symmetric (ΔT is linear and the 0-clamp never binds at pool setpoints) but the *monthly* profile now correctly peaks in winter, which changes solar-fraction and backup-heat numbers slightly. Hotel storage results shift marginally (capacity higher in winter, lower in summer).
- **Tests:** new blocks in `test_industry.mjs`: constant-profile equivalence with the old scalar path (backwards compatibility), annual-total preservation under a zero-mean swing, winter-day increase / summer-day decrease, tank capacity hand-value 122.03 kWh, tank energy-balance closure, colder-mains-larger-capacity.

### Not bugs (checked and cleared)
- hourN 1–24 ↔ 0–23 conversions are consistent end-to-end (backend → normalize → CSV re-offset).
- Boiler efficiency is applied in the correct direction everywhere (÷η on displaced fuel).
- AUD/kWh vs AUD/MJ conversion (×3.6) correct everywhere it appears.
- Feed-in tariff applies only to hourly PV excess; no overlap with self-consumption savings.
- No divide-by-zero paths found in live code (guards on G, flow, area, demand totals, weight sums).
- `test:no-nan` and all fixture integrity checks pass.

---

## D. Model A and Model B report (frozen - behaviour unchanged, confirmed)

### Model A - simple linear thermal model
- **Implementation vs displayed equation:** exact match. UI shows η_th = a0 + a1·((Tin−Ta)/G) + a2·u; code is `etaTh = a0 + a1*((Tin - r.ta)/G) + a2*r.vwind`, clamped to [0,1], `Q̇ = η·G·A`.
- **Inputs/units:** Tin, Ta °C; G W/m² (POA); u m/s (10 m TMY wind); A m². Output W → kWh/h.
- **Signs:** internally consistent - defaults a1 = −10.528 (loss when Tin>Ta), a2 = −0.0081 (wind penalty). The clamp to [0,1] silently absorbs any user sign error.
- **Edge cases (tested):** G ≤ 1e-6 → η = 0, Q = 0 (night ✓); very cold inlet → η clamps at 1 (cannot exceed 100 %); hot inlet/low G → η clamps at 0 (no negative heat, i.e. **no night/overcast losses are modelled**).
- **Questionable (documented only, not changed):**
  1. Reduced temperature uses **Tin**, not mean fluid temperature Tm - an inlet-based curve. Fine if the coefficients were fitted that way; must not be mixed with ISO 9806 (Tm-based) coefficient sets.
  2. The [0,1] clamp hides physically meaningful negative efficiency (nighttime radiative loss).
  3. Wind term multiplies raw 10 m TMY wind, not collector-height wind.
- **Recommended future improvements (separate, needs approval):** report η unclamped in a diagnostics view; document the coefficient provenance (fitted dataset) next to the inputs.
- **Tests locking behaviour:** `test_pvt_models.mjs` - source-string lock of the exact equation, hand-computed numeric case (η = 0.645, Q̇ = 10,320 W), zero-irradiance case. **Pass before and after audit.**

### Model B - ISO 9806 Eq. 12 with Newton iteration
- **Implementation vs displayed equation:** exact match, term for term, including signs:
  Q = A[η0G − a1ΔT − a2ΔT² − a3uΔT + a4(E_L−σTa⁴) − a6uG − a8ΔT⁴], ΔT = Tm−Ta, Tm = (Tin+Tout)/2.
- **Newton step verified analytically:** solving f(Tout) = ṁcp(Tout−Tin) − Q_model(Tout) = 0.
  d(ΔT)/dTout = ½, so dQ/dTout = A(−a1/2 − a2ΔT − a3u/2 − 2a8ΔT³) - matches code exactly. Step = f/f′ with f′ = ṁcp − dQ/dTout. No double-counted or sign-flipped terms.
- **Units:** ṁcp in W/K from kg/h ✓; E_L and σTa⁴ both from Kelvin ✓; a-coefficients in standard ISO units (labelled in UI) ✓.
- **T_out follows Q = ṁcpΔT:** yes - the converged Tout is definitionally consistent, and the displayed Tout recomputed from Q gives the same value.
- **Edge cases:** G ≤ 1e-6 or zero flow → Q = 0 ✓; final Q clamped ≥ 0 ✓ (no negative heat); zeroed a3/a4/a6/a8 remove those terms exactly ✓ (fallback `|| 0` preserves an entered 0 for these four).
- **Stability/failure modes (documented, not changed):**
  1. With physical coefficients (a1>0 entered as positive) f′ = ṁcp + positive > 0 - stable, converges in ≤5 iterations for realistic conditions.
  2. **No divergence guard:** a pathological user coefficient set (e.g. a1 entered negative, or huge a8 with large ΔT) can push f′ toward 0 → giant step → NaN/oscillation. `isoIterMax` caps iterations but there is no residual check or step limiter.
  3. **Input-parsing trap (frozen):** typing 0 into η0, a1, a2, Tout0, or iterMax silently substitutes the default (0.762/3.93/0.0095/40/5) because of `|| default`. a3/a4/a6/a8 honour 0.
  4. No convergence flag is surfaced; the 5th-iteration value is used regardless.
- **Recommended future improvements (separate, needs approval):** residual tolerance check + bisection fallback; honour explicit 0 in coefficient fields with a visible warning instead of silent substitution; expose a "converged?" diagnostic in the hourly CSV.
- **Tests locking behaviour:** source-string locks (Newton branch, Swinbank constant), locked numeric case (Q̇ = 11,515.064590968854 W, η = 0.7196915369355533), zero-irradiance case. **Pass before and after audit - bit-identical.**

**Confirmation:** no line inside either model's computation was modified. The only changes near the models are the corrected comment above the NOCT block (C3) and economics input reads (C2), both outside the frozen paths; source-lock tests assert the frozen reads are byte-identical.

---

## E. Assumptions register

| Assumption | Where used | Reasonable? | UI explains it? | Recommended wording/action |
|---|---|---|---|---|
| Water ρ = 1 kg/L, cp = 4.184 kJ/kg·K | all thermal paths | Yes (10–90 °C) | implicit | fine as-is; now noted here |
| PV has no inverter/soiling/wiring losses | pv_stc | DC-optimistic ~10–14 % | **yes - note added this audit** (η field + modern assumptions card) | done |
| PVT cooling ΔT = Q̇/(U_L·A) with U_L = |a1| | `calcPvtPanelTempC` | heuristic but bounded | NOCT explainer covers intent | keep; documented in §B13 |
| Tin = mains water byDay (no return-loop preheat) | supply loop | Yes for preheat duty | yes (inlet-block note) | fine |
| ~~Aquatic makeup/pool uses annual-average mains~~ | aquatic, hotel tank | **fixed this audit (C6)** - now daily byDay | n/a | done |
| dayN = 1 is a Monday (Mon–Fri & laundry schedules) | `isMonToFriDay`, hotel, laundry | Arbitrary but harmless (TMY has no weekday) | no | add note to profile selector |
| Hotel tank: lossless, 35 °C usable target | `calculateThermalStorage` | simplification | yes ("usable storage to 35 °C") | fine for prototype |
| Fixed design RH per pool type (50–62 %) | aquatic evaporation | standard practice | **fixed this audit** (C4) | done |
| No thermal storage in headline matching by default | all industries; hotel only uses storage when tank volume > 0 | conservative & honest | yes (storage note banner + hotel tank field) | fine |
| f_th2e = 1 (heat kWh = elec kWh for CAPEX split only) | LCOE/LCOH | simplification, not exergy | yes (explicit UI note) | fine |
| Grid EF defaults (0.62 national etc., NGA 2025) | emissions | plausible | yes + DCCEEW link | 🔍 needs external validation against published tables |
| Gas EF 51.4 kg CO₂-e/GJ scope 1 | emissions | plausible (NGA ~51.5) | cited in table row | 🔍 verify against NGA 2025 |
| Seasonal factors (dairy/brewery) day-weight normalised to 1.0 | demand | yes - keeps benchmarks exact | model-basis modals | fine |
| 365-day year, no Feb 29, no DST in demand scheduling | everywhere | standard TMY practice | no | note added here; acceptable |
| Supply-card value = 100 % utilisation of both streams | supply economics | upper bound | yes ("upper bound" label) | fine |
| Mon–Fri disabled for dairy/brewery/laundry | profile UI | yes (documented reasons) | yes (struck-through options) | fine |

---

## F. UI/UX change report

**Classic UI changes (text only, no layout/workflow change):**
1. Aquatic humidity assumption wording corrected (C4).
2. PV efficiency note now states output excludes inverter/wiring/soiling losses (≈10–14 % for AC yield).
3. Version label 13.11 → 13.12 (header, cache-bust).
4. Economics fields honour an explicit 0 - invisible except when a user actually types 0.
5. One new header link: "Try modern UI (beta)".

**Modern UI (beta) - user-approved, implemented as a flagged presentation layer:**
- **Activation:** open `index.html?ui=modern`. The classic UI is the default and untouched.
- **Files:** `js/ui-modern.js` + `css/ui-modern.css` (all styles scoped under `body.ui-modern`). Contains **no calculation logic**; verified in-browser that annual results are bit-identical under the flag (91,479.4 / 120,311.5 / 85,648.8 kWh, Sydney fixture).
- **What it adds:** beta banner with a one-click "switch back to classic" link; sticky 3-step navigation (Site & system → Demand & economics → Results) with scroll highlighting; provenance chips distinguishing *you enter* / *model* / *assumption* on 16 key inputs + the mains block; a reading legend; an "Assumptions at a glance" card (TMY, BC-Aus mains, PV loss exclusion, no-storage matching, editable economics).
- **How to revert:** don't use the flag (classic is default), or delete `js/ui-modern.js`, `css/ui-modern.css`, and their two include lines in `index.html`.

**Still open for future approval:** a visible warning when Model B coefficients are edited away from datasheet values (relates to the frozen zero-parsing trap, §D).

---

## G. Test report

**How to run:** `npm test` (offline, no network). Full list in README.

| Suite | Assertions | Validates |
|---|---|---|
| test_geometry | 17 | declination, zenith, incidence, POA vs hand values |
| test_industry | 40 | dairy/brewery/hotel/aquatic/laundry benchmarks & Q=mcpΔT; **new:** aquatic daily-mains profile equivalence/redistribution, hotel tank capacity hand-value + energy-balance closure |
| test_economics | 12 | CRF, NPV, LCOE split, payback, heat-saving conversion |
| verify_js_e2e (solar-e2e) | 9 | end-to-end solar path on fixtures |
| test_golden_reference | 9 | POA + PV annual vs pvlib ≤0.2 % (3 cities) |
| test_pvt_models | 9 | **Model A/B equation locks + numeric locks - unchanged ✓** |
| test_weather_fixtures | 119 | 8,760-record fixture integrity, checksums |
| test_backend_solarhour | (py) | backend solar-time contract |
| test_no_nan | 13 | no NaN/non-finite in any locked JSON |
| test_export_share | 7 | exports/share links read calculation state first |
| **test_supply_aggregation (new)** | **26** | chart/table monthly & daily bucketing, timezone-independence, Jan-1 regression, leap-year slot regression, legacy-row fallback, source locks |
| **test_input_parsing (new)** | **22** | explicit-0 semantics, defaults on blank/invalid, source locks incl. frozen Model-B reads untouched |

**Result:** all suites pass (baseline pass → post-fix pass). Model A/B numeric locks bit-identical.

**Remaining gaps (recommended next):**
- No automated test drives the full browser `calcAnnualPVT` against a locked fixture asserting the *annual* numbers (the browser smoke test exists; a numeric golden for the full pipeline incl. Model A/B + NOCT correction would lock the whole chain).
- PDF report content is not snapshot-tested.
- Hotel storage simulation has no dedicated unit test with hand-computed SOC trace.

---

## H. Final engineering judgement

**Is it usable as an academic prototype? Yes** - with the caveats below. The supply
side is genuinely validated (POA within 0.2 % of pvlib; solar time validated to
~0.4° zenith RMS; BC-Aus mains fitted and cross-checked against CER/EnergyPlus
data; a real 19-day field comparison exists). The economics arithmetic is
textbook-correct and unit-consistent. The demand models are transparent,
benchmark-anchored, and honestly labelled.

**Reliable outputs:** POA irradiance; PV-only *DC* electricity (add ~10–14 % system
losses before quoting AC); Model A/B thermal yield *given their coefficients*;
hourly matching arithmetic; savings/payback/NPV arithmetic; mains-water profile
for Australian sites.

**Treat cautiously:**
- PVT *electrical cooling gain* - the U_L-heuristic cell temperature is bounded
  but not validated against measured PVT electrical data; the SOAC field work
  showed field thermal η ≈ 0.63× certified ISO η, so datasheet-coefficient
  results are optimistic for real installations.
- Industry demand absolute magnitudes (benchmarks are national averages; site
  variation is large - the UI says this, keep it).
- Aquatic centre totals (fixed RH, annual-average mains, U-values are engineering
  estimates).
- Emissions factors (plausible but verify against the published NGA 2025 tables).

**Validate next against measured data:** (1) PVT electrical output vs a real
cooled installation (the weakest validated link); (2) one metered industry site
per demand model, starting with the SOAC aquatic data you already have;
(3) Model B with a real ISO 9806 datasheet coefficient set vs the collector's
certified power curve at the standard test points (G=1000, ΔT=0/20/40 K).

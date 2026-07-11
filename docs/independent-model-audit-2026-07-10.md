# Independent engineering model audit — 2026-07-10

Repository: CoolSheet PVT Calculator  
Audit type: adversarial, audit-only Phase 1  
Disposition: **do not use as a design guarantee, investment-grade forecast, regulatory calculation, or verified industry benchmark in its current form**  
Frozen boundary: Model A and Model B inspected and fingerprinted; not changed, retuned, reformatted, bypassed, or “corrected”

## 1. Executive verdict

The calculator's core bookkeeping and many unit conversions are logically coherent. That is not enough to make the model fully justifiable. The Australian mains-water lineage contains a material identity error, the production weather service is not reproducible, the deployed backend is stale, and most exact industry defaults are assumptions rather than values substantiated at the claimed denominator and system boundary.

| Component | Verdict | Basis |
|---|---:|---|
| Frozen Model A implementation | Green for integrity; Not validated scientifically in this audit | Protected code and numeric lock are unchanged. One copied-equation test is not independent validation. |
| Frozen Model B implementation | Green for integrity; Not validated against ISO 9806:2025 | Protected code and numeric lock are unchanged. ISO 9806:2025 is now current, but a clause-by-clause compatibility review was not possible from the public catalogue. |
| Weather acquisition and provenance | Red | Unversioned PVGIS URL, unpinned dependencies, incomplete retained metadata, live/local drift, and no immutable scenario weather hash. |
| Clock, solar time and calendar | Red | Solar time is sound in the local backend, but `coerce_year=1990` plus historical time-zone conversion creates duplicated/missing local demand hours for Sydney and Rockhampton. The deployed backend supplies no `solarHour`. |
| Solar geometry and isotropic POA | Amber | Results agree closely with pvlib isotropic benchmarks, but tests duplicate formula logic and do not execute an imported production module. Shading and several loss mechanisms are excluded. |
| PV electrical and PVT cooling | Red | Output is DC-like and omits inverter/wiring/mismatch/clipping/availability/soiling/degradation. The cooling heuristic is outside Models A/B and lacks independent validation. |
| BC-Aus mains-water model | Red | Raw CER zone 1 is Rockhampton and zone 2 is Alice Springs; the fitting/runtime registries reverse those identities. A five-parameter fit to 12 in-sample points and an invented selector are used in production. |
| Dairy demand | Red / Not validated | Arithmetic is traceable, but the exact 1.37 L/L, 51.7 kWh/kL, schedules and seasonality are not substantiated by an independent, page-level Australian source. |
| Brewery demand | Red / Not validated | Exact 1.85 L/L and 11.5 kWh/hL defaults rely mainly on secondary/vendor/international sources; whole-site and PVT-eligible preheat boundaries remain weak. |
| Aquatic-centre demand | Red | Engineering equations are explicit, but fixed RH ignores available weather RH; 10 m wind and water-surface area are compared with conditioned-floor-area total-energy data. |
| Hotel demand | Red / Not validated | NABERS is whole-building evidence and does not directly establish 4.5/1.6/1.2/0.8 thermal or 15 electrical kWh per occupied room-night. |
| Commercial laundry | Amber arithmetic; Red default evidence | Scope exclusions are unusually clear. The 10 L/kg default is below Sydney Water's 12–15 L/kg efficient-with-reuse and 17–22 L/kg efficient-without-reuse ranges. WELS does not currently regulate commercial clothes washers. |
| Hourly matching and conservation | Amber | Direct-use identities are logically correct and browser results close within display rounding. Historical-DST clock keys and idealised storage claims prevent Green. |
| Economics | Amber | CRF, NPV, displaced-gas and payback arithmetic pass hand checks. Results omit material financial terms and use editable examples as point estimates; combined LCOE uses arbitrary `f_th2e=1`. |
| Emissions | Amber/Red | Electricity dropdown matches NGA 2025 location-based Scope 2 factors. Natural gas is labelled CO2-e but uses the CO2-only 51.4 kg/GJ rather than combined Scope 1 51.53 kg CO2-e/GJ. Grid selection is manual and incomplete. |
| Tests, CI and documentation | Red for validation claim | Green tests mostly characterize current behaviour. Strict live validation fails; CI omits strict live, links, flow and deterministic regeneration; several tests mirror production equations. |

**Overall verdict: Red for a fully justified Australian engineering model.** It is a useful transparent scenario calculator, but several headline outputs are assumption-based and at least one upstream Australian data identity is wrong.

## 2. Audit baseline and reproducibility record

### 2.1 Repository state before this report

- Commit: `a4f57d4340d9ddefc697b2f73f2b24e4a1596e37`
- The worktree was already dirty. These entries pre-date this audit and were preserved:

```text
 M docs/model-specification.md
 M index.html
 M js/app.js
 M package.json
 M validation/unit/test_industry.mjs
?? css/ui-modern.css
?? docs/audit-report-2026-07.md
?? js/ui-modern.js
?? validation/unit/test_input_parsing.mjs
?? validation/unit/test_supply_aggregation.mjs
```

This audit created only this new report as a tracked-worktree-visible deliverable. Test runners updated their already-ignored generated result directories.

### 2.2 Runtime and installed dependency versions

| Runtime/package | Audited version |
|---|---:|
| Node.js | 22.16.0 |
| npm | 10.9.2 |
| Python | 3.14.3 |
| pvlib | 0.15.0 |
| pandas | 3.0.1 |
| fastapi | 0.135.1 |
| uvicorn | 0.41.0 |
| timezonefinder | 8.2.1 |
| tzdata | 2025.3 |
| requests | 2.32.5 |
| numpy | 2.4.2 |
| scipy | 1.17.1 |
| Playwright test package | package range `^1.61.1` |

`pvt-tmy-api/requirements.txt` uses lower bounds (`pvlib>=0.15.0`, `pandas>=1.3`, and others) and leaves FastAPI/uvicorn unversioned. `npm install` is used in CI rather than a locked clean install. A future installation is therefore not a deterministic recreation of this audit.

### 2.3 Commands and observed results

| Command | Result | Interpretation |
|---|---:|---|
| `npm test` | PASS, 276 asserted checks; solar e2e table has no assertion | Behaviour regression suite is Green, not independent scientific validation. |
| `npm run test:browser` | PASS, 3/3 | UI loads; selected controls/state contracts exist. Does not calculate all production scenarios. |
| `npm run test:flow-rate` | Exit 0; prints Model A/B table | Diagnostic only; no pass/fail assertions. Model A thermal energy is invariant with flow in that script; Model B varies. |
| `npm run test:links` | 28 OK, 2 bot-blocked review, 0 broken | Reachability does not verify that a citation supports the exact number. |
| `LIVE_MATRIX_STRICT_SOLARHOUR=1 npm run test:live-industries` | **FAIL** | 15 scenarios; 15 hard failures. Live Sydney/local comparison is outside tolerance for all five industries. Live Sydney and Melbourne contain `solarHour` in 0/8760 records (10 scenario failures). |
| Local `/tmy` checks | 8760 records and 8760 numeric solar-hour values | Local backend contract works, but local-clock `(dayN,hourN)` is not unique at several sites. |

The strict live failure is decisive evidence of deployed/local version drift. The hosted service silently falls back to local clock for solar geometry in `js/app.js:4906-4910`, so a published live scenario can change after backend redeployment.

## 3. Architecture and calculation dataflow

```text
Address / coordinates
  -> geocoder
  -> local or hosted FastAPI /tmy
  -> pvlib get_pvgis_tmy (currently unversioned URL; ERA5/PVGIS metadata)
  -> UTC index -> Australian zoneinfo clock + separately computed true solarHour
  -> frontend numeric normalisation
      -> solar geometry -> DNI/DHI isotropic POA
      -> BC-Aus zone selector -> 365-day mains-temperature profile
      -> frozen Model A or Model B -> hourly thermal supply
      -> NOCT + PVT cooling heuristic -> hourly electrical supply
      -> industry-specific hourly thermal/electrical demand
      -> direct hourly matching and optional idealised storage summaries
      -> tariffs / gas / finance / emissions
      -> UI cards, tables, charts, CSV/HTML exports and share payload
```

The most consequential upstream dependency chain is:

`fixture identity -> fitted BC-Aus constants -> runtime zone selector -> Tin -> both frozen thermal models + every water-heating demand -> matching -> savings/emissions/economics`.

## 4. Model A/B integrity boundary

### 4.1 SHA-256 fingerprints

The hashes below were computed before analysis and recomputed after creating this report. “After” equals “before”. Line numbers refer to the audited dirty worktree, not an immutable release tag.

| Protected item | Span | Before SHA-256 | After SHA-256 |
|---|---|---|---|
| Model A production branch | `js/app.js:4917-4920` | `ebfadb6baa9c0f531e7a62c5029d3ba4d657a7c7693ab8205d8ba55ada47813b` | same |
| Model B Newton branch | `js/app.js:4922-4959` | `b98f688138a72bc9e9b4f0a8fa0b67aa44bc57c9aebc2872a7a8670c988e4479` | same |
| Model coefficient reads/selection | `js/app.js:4835-4862` | `02429560216d41e0ba7750daa1321ac5fb7b3fc2251211b2cdf709069ff39dc1` | same |
| Model defaults | `js/app.js:4716-4720` | `436287354cca8bd18fb04084fda355125e001d6a69f630c750f995bfd6c12353` | same |
| Model reset behaviour | `js/app.js:4790-4800` | `e3bedace58ba0a8bbd677439e027647ea05bbfbacac9b2c1bd281afcdcf90696` | same |
| Model UI equations/fields | `index.html:180-248` | `153500fe517c94d256e0294a9f3edae4141127a92941ecc288a821640520c07a` | same |
| Whole `js/app.js` | file | `b5292fbbe0545e814f86578aec45e1a21d4b4b81ecd552db128f662c24a476bf` | same |
| Whole `index.html` | file | `a92c7e96fdd38ec812f9058fc6cea3e39628da842ce21868d9f2899177177bfe` | same |
| Model lock test | `validation/unit/test_pvt_models.mjs` | `350a3ec9765f732cb228647c4ae8c33492b22a226f8860fe09d31acfe9dde47e` | same |
| Frozen parsing assertions | `validation/unit/test_input_parsing.mjs` | `502015ba257620f2a568ef8efb11720c75cfcbb453dc45c2f83c6e07967e1894` | same |

### 4.2 Locked numeric cases

| Case | Locked result |
|---|---:|
| Model A: G=800 W/m², A=20 m², Tin=25°C, Ta=20°C, wind=3 m/s | efficiency 0.645; thermal power 10,320 W |
| Model B: same conditions, 0.02 L/s/m² and audited defaults | efficiency 0.7196915369355533; thermal power 11,515.064590968854 W |
| Both at zero irradiance | 0 W |

### 4.3 Frozen findings — report only

1. ISO 9806:2025 Edition 3, published October 2025, now supersedes ISO 9806:2017. This audit confirms only that the public ISO scope covers hybrid solar collectors. It does **not** claim clause-level compatibility of the existing Model B equation or coefficients. No change is permitted without a separately approved standards review.
2. The current PVGIS TMY response does contain relative humidity and downward long-wave infrared fields. The Model B comment at `js/app.js:4925` saying the TMY carries no measured long-wave is factually stale. The backend drops that field. This does not mean it is safe to wire PVGIS `IR(h)` into Model B: observed parsed values included negatives, so semantics and units require separate validation first.
3. Model B uses five Newton iterations by default and exits early at `abs(step)<1e-4`. The lock test checks one nominal point; it does not sweep convergence, singular derivatives, non-finite coefficients, or extreme flow/temperature conditions.
4. `parseFloat(...) || default` makes an explicitly entered zero revert to defaults for several Model B coefficients. This is protected behaviour in this phase.
5. Model A and Model B produce materially different thermal supply under the audited Sydney UI scenario: 120,635 versus 344,055 kWh/year for 250 m², a 185% Model-B-over-A difference. That is model uncertainty, not evidence that either one is correct.

## 5. Complete calculation and traceability ledger

Evidence classes: **M** certified/measured, **R** regulatory, **V** externally validated model, **C** calibrated empirical value, **D** derived, **A** editable engineering assumption, **U** unsupported placeholder. Rows group display/export/chart variants that are direct formatting or aggregation of the same runtime quantity.

### 5.1 Weather, time, geometry and supply

| Runtime input/output or constant | Parsing, equation, units and time basis | Production location | Source / class | Test and downstream uncertainty |
|---|---|---|---|---|
| Latitude/longitude/address | Geocoded decimal degrees; finite coordinate | `js/app.js:814-1061` | External geocoder / D | Cache and fallback exercised only partially; affects every result. |
| TMY selection | `get_pvgis_tmy(lat,lon,map_variables=True)`, defaults: horizon yes, start/end database defaults, URL unversioned, year coerced to 1990 | `pvt-tmy-api/server.py:135-161` | PVGIS TMY / V | 8760 checked. API version and selected months are not immutable. |
| DNI/DHI/GHI | pvlib mappings; W/m² hourly records | `server.py:187-198`, `app.js:1071-1093` | PVGIS-ERA5 / V | Finite/sum checks. “Checksums” are mutable totals, not independent hashes. |
| Air temperature | `temp_air`/`t2m`, °C | same | PVGIS ERA5 / V | Used by solar, mains, PV, Model A/B, aquatic and hotel. |
| Wind | `wind_speed`/`ws10m`, m/s at 10 m | same | PVGIS ERA5 / V | Used directly at collector and pool surface without height/exposure correction / A. |
| RH and long-wave | Present upstream as RH (%) and `IR(h)` (W/m²) but discarded | `server.py:187-199` | PVGIS / V | No runtime test. Fixed aquatic RH and Swinbank Model B remain. |
| `hourN` | Local timestamp hour + 1, nominal 1..24; demand clock | `server.py:167-198` | Derived / D | Historical 1990 DST creates duplicate/missing keys. Some UI helper code assumes 0..23, an additional convention risk. |
| `solarHour` | UTC hour + longitude/15 + Spencer equation of time, modulo 24 | `server.py:173-183` | Derived solar time / D | Local backend 8760/8760; deployed backend 0/8760. |
| Day/calendar | timestamp day-of-year; 365-day TMY; charts map fixed non-leap months | backend and `monthFromDayN` | Derived / D | Annual aggregation passes. Weekday scheduling assumes a fixed Monday without a source year. |
| Declination/zenith/incidence | Cooper declination; true solar hour; southern convention 0°=north | `TiltedSurfaceRadiation` in `js/app.js` | Standard engineering model / V | Benchmarks agree within 0.2% with pvlib isotropic; test duplicates implementation. |
| POA beam | `max(0,DNI*cos(theta))`, W/m² | production radiation class | Derived / D | Night/negative guards tested. No row shading or horizon-profile use after TMY. |
| POA diffuse | isotropic `DHI*(1+cos tilt)/2` | same | Model choice / A | Perez is only a benchmark; annual model-choice sensitivity not exposed. |
| Ground reflected | `GHI*albedo*(1-cos tilt)/2` | same | albedo default 0.2 / A | Editable 0..1. No site/season data. |
| PV STC energy | `etaPV*G*A/1000`, kWh per one-hour record | `app.js:4914-5010` | efficiency default 0.20 / A | DC-like. Area and efficiency linear. |
| PV-only panel temperature | `Ta+(G/800)*(NOCT-20)` | `app.js:4737-4750` | NOCT default 45°C / A | Formula tested indirectly; no module/inverter temperature model. |
| PVT cooling temperature | subtracts `Q/(UL*A)` then clamps to Tin/uncooled | `app.js:4752-4778` | heuristic / U | No independent validation; feeds electrical yield and economics. |
| PV temperature factor | `max(0,1+gamma*(Tcell-25))`, gamma entered %/°C then /100 | `app.js:4753-5009` | gamma default −0.40%/°C / A | Unit conversion is correct. No manufacturer range/provenance. |
| Model A thermal | Protected linear branch, W then kWh/hour | `app.js:4917-4920` | frozen calibrated model / C | Integrity lock only. |
| Model B thermal | Protected ISO-labelled Newton branch, W then kWh/hour | `app.js:4922-4959` | frozen model / C | Integrity lock only; 2025 clause compatibility Not validated. |
| Outlet temperature | `Tin + th_kWh*3600/(kg/h*4.184)`, °C | `app.js:4962-4967` | water heat capacity / D | Dimensionally correct; no fluid-property variation or hydraulic limit. |
| Annual PVT electricity/thermal/total | sums hourly kWh; total is arithmetic electrical + thermal energy | `app.js:4893-5054` | Derived / D | Finite tests. “Total” is not exergy or delivered useful energy. |
| Charts/CSV/HTML/share values | fixed-calendar aggregation or formatting of runtime arrays/state | `app.js:1690-3950`, `5184+` | Derived / D | Aggregation tests pass; share links cannot recreate mutable live weather unless source is retained. |

### 5.2 Mains water and industry demand

| Runtime input/output or constant | Parsing, equation, units and time basis | Production location | Source / class | Test and downstream uncertainty |
|---|---|---|---|---|
| Annual/monthly ambient statistics | average hourly Ta and monthly extrema | `app.js:1118-1134` | Derived / D | Correct arithmetic, but depends on mutable TMY. |
| BC-Aus zone choice | minimum `|mean-mean_anchor| + |swing-swing_anchor|`; geographic fallback | `app.js:3973-4023` | invented classifier / U | It affects production despite “display only” comments. No postcode authority or national boundary tests. |
| BC-Aus parameters | five values per selected zone; sinusoid based on annual mean, monthly swing and lag | `app.js:1136-1165`, `js/bc_aus_zone_constants.js` | fitted to 12 deck points / C | Identity swap and overfit described in §6. |
| Custom mains | 12 user monthly values interpolated/effective daily profile | `app.js:1228-1305` | site input / M or A | Real production path used for counterfactual. No range validation against potable-water limits. |
| Dairy thermal | daily throughput × 0.30/0.57/0.50 L/L × `4.184*max(0,target−Tin)/3600`; normalized schedules | `app.js:1371-1435,2119-2158` | exact rates/targets/schedules A/U | Hand arithmetic test; evidence not page-level verified. |
| Dairy electricity | 51.7 kWh/kL × throughput, hourly/seasonal normalized | `app.js:1390-1393,2119-2158` | A/U | Annual total test mirrors formula. |
| Brewery thermal | 0.80/0.45/0.60 L/L to 45/40/45°C; normalized seasonal/hourly weights | `app.js:1409-1470,2159-2198` | secondary evidence; A | Whole-site versus low-temperature boundary is explicit but exact values not validated. |
| Brewery electricity | 11.5 kWh/hL × production, normalized | same | A/U | Arithmetic test only. |
| Aquatic evaporation | vapour-pressure difference × coefficient × wind × splash × area × 0.68 kWh/kg | `app.js:1888-1990` | engineering model / V with tuned constants A | Fixed process RH; 10 m wind; output sensitive to area and operating assumptions. |
| Aquatic makeup/sensible | L/m²/day × area × cp × ΔT; combined U×area×ΔT | same | mixed V/A | Daily mains profile now used. U, cover and makeup values are assumptions. |
| Aquatic electricity | 250 kWh/m²/year × selected pool-water surface, weather-shaped | `app.js:1472+,1990-2020` | denominator-mismatched A/U | Deakin evidence is total energy per conditioned floor area, not electricity per water surface. |
| Hotel thermal | occupied room-nights × 4.5/1.6/1.2/0.8 kWh; normalized profiles | `app.js:1482-1660` | derived assumptions / A | Energy balance arithmetic passes; process intensities not directly supported by NABERS. |
| Hotel electricity | 15 kWh/room-night; time reshaped by weather then annual-normalized | `app.js:1662-1686` | A/U | Annual total preserved; not a NABERS-derived process value. |
| Hotel storage | lossless finite tank, usable energy to hard-coded 35°C target | hotel matching branch | idealized / A | Conservation can close, but losses, temperature stratification and equipment are absent. |
| Laundry thermal | kg/hour × L/kg × fraction × cp × ΔT; optional rinse and user loss | `app.js:2199-2285` | transparent A | Hand calculation passes. Default 10 L/kg conflicts with current Sydney Water benchmark ranges. |
| Laundry electricity | exactly 0/out of scope | same | explicit exclusion | Unit test locks exclusion. Results must not be called whole-site savings. |
| Process schedules/seasonality | weights normalized to preserve annual benchmark | industry functions | assumptions / A | Annual normalization tested; site operations can dominate matching but lack ranges. |

### 5.3 Matching, economics and emissions

| Runtime input/output or constant | Parsing, equation, units and time basis | Production location | Source / class | Test and downstream uncertainty |
|---|---|---|---|---|
| Thermal used/unmet/excess | per hour: used=min(s,d), unmet=max(0,d−s), excess=max(0,s−d) | `app.js:3075-3097` | Derived / D | Equations conserve by construction. Clock-key defect affects timing. |
| Electrical self-use/grid/export | same direct-use balance using PV and demand | `app.js:3100-3109` | Derived / D | No battery, inverter, clipping or demand-charge model. |
| Monthly storage bound | monthly min/max totals, equivalent to free lossless intra-month shifting | `app.js:3049-3072` | ideal upper bound / A | Correctly separated in comments; terminology can still be mistaken for physical storage. |
| Heat coverage and solar fractions | used/demand | industry branches | Derived / D | Display rounding can create ±1 kWh apparent discrepancies. |
| Electricity saving | self-used PV × AUD/kWh | industry branches | tariff A | Tariff examples are not location/date market data. |
| Export value | excess PV × feed-in AUD/kWh | industry branches | tariff A | No export limit or time-varying tariff. |
| Gas saving | used heat kWh × 3.6 MJ/kWh ÷ boiler efficiency × AUD/MJ | `app.js:5275-5278` and peers | Derived / D | Units correct. Some documentation says AUD/GJ. |
| CAPEX | area × AUD/m² | `app.js:5027` | A | Static HTML says 800, but checked auto-fill produces 540 from 1.20+1.50 AUD/W at 200 Wp/m². |
| OPEX | CAPEX × annual percentage | `app.js:5034` | A | Default 1.5%/year; no source/escalation. |
| Supply annual value | all PV at retail + all heat displaced − OPEX | `app.js:5028-5035` | upper-bound scenario / A | Explicitly labelled 100% utilization; not demand-matched. |
| CRF | `i(1+i)^N/((1+i)^N−1)`, or 1/N at zero | `app.js:5037-5039` | standard finance / D | Textbook hand check passes. Real/nominal basis unspecified. |
| NPV | `−capex + netBenefit*annuityFactor` | `app.js:5051-5053` | standard finance / D | Omits escalation, degradation, replacement, residual, tax, financing and GST treatment. |
| Simple payback | capex/net annual benefit | `app.js:5050` | Derived / D | Point estimate only. |
| LCOE/LCOH/combined | CRF+OPEX divided by energy; CAPEX split by energy with `f_th2e=1` | `app.js:5040-5049` | derived with arbitrary allocation / A | Arithmetic reconciles; allocation is neither market value nor exergy. |
| Electricity emissions avoided | matched/self-used electricity × selected kg CO2-e/kWh | industry output | NGA 2025 Scope 2 / R | Manual dropdown; NWIS/off-grid/location mapping absent. |
| Gas emissions avoided | heat/efficiency × 3.6 MJ/kWh × 51.4 kg/GJ | emissions branch | NGA component mislabel / R | 51.4 is CO2 only; combined pipeline-gas Scope 1 is 51.53. Scope 3 is excluded. |
| Result cards/reports | format the above metrics | `app.js:5100+` | Derived / D | No uncertainty interval is emitted. |

## 6. Highest-priority finding: BC-Aus data identity and fitting

### 6.1 Raw fixture reconstruction

Every fixture states “Revised 20/07/15 — for use with domestic system decks.” The identity must come from the fixture, not the later registry label.

| Fixture | `ASSIGN` weather | Declared zone | Latitude | Monthly cold-water °C, Jan…Dec | Audited identity |
|---|---|---:|---:|---|---|
| `zone1_NW_Domestic.inc` | `rockhampton2.tmy` | 1 | −23.4 | 28, 28, 27, 25, 23, 20, 20, 21, 24, 26, 28, 28 | Rockhampton |
| `zone2_NW_Domestic.inc` | `alicesprings2.tmy` | 2 | −23.5 | 29, 27, 24, 20, 14, 11, 9, 12, 18, 23, 26, 28 | Alice Springs |
| `zone3_NW_Domestic.inc` | `sydney2.tmy` | 3 | −33.4 | 23, 23, 21, 18, 15, 12, 11, 12, 15, 19, 21, 22 | Sydney |
| `zone4_NW_Domestic.inc` | `melbourne2.tmy` | 4 | −37.8 | 20, 20, 18, 15, 11, 9, 8, 10, 12, 15, 17, 19 | Melbourne |
| `ZONEHP5_Au_Domestic.inc` | `canberra2.tmy` | 5 | −35.3 | 18, 18, 19, 15, 13, 9, 5, 5, 7, 8, 12, 16 | Canberra; filename identifies ASHP zone 5 |

The official CER postcode document (Version 3, effective 1 January 2020) places Rockhampton postcode 4700 in zone 1 (range 4620–4724) and Alice Springs 0870 in zone 2 (range 0870–0875). This agrees with the raw fixtures and contradicts:

- `tools/fit_bc_aus_by_zone.py:83-96`;
- `js/bc_aus_zone_constants.js:9-28`;
- `js/app.js:3982-3985`;
- the comparison/validation pages that call zone 1 Alice and zone 2 Rockhampton.

The script pairs Alice-like ambient temperatures with Rockhampton mains values for its mislabeled “zone1”, and Rockhampton-like ambient temperatures with Alice mains values for “zone2”. The resulting low RMSE is therefore fit quality against the wrong identity, not validation.

### 6.2 Four SWH zones versus five ASHP zones

The current CER material explicitly distinguishes four solar-water-heater zones and five air-source-heat-pump zones. The fifth fixture is named `ZONEHP5...`, yet the runtime treats all five as one generic AS/NZS 4234 zone family. That use is not justified.

Two authorities must remain separate:

- **Current engineering standard:** AS/NZS 4234:2021 and Supplement 1:2021.
- **SRES regulatory method:** Renewable Energy (Method for Solar Water Heaters) Determination 2016, which intentionally retains legacy AS/NZS 4234:2008-era regulatory inputs for its purpose.

The calculator must declare whether BC-Aus is an engineering inlet-temperature model or an emulation of SRES domestic rating decks. It presently blends the two. The legacy fixtures should not simply be discarded as “obsolete”; they are valid only for the legacy regulatory use case they define.

### 6.3 Fit diagnostics

Current in-sample diagnostics were independently recomputed from the committed runtime constants. Phase is the circular difference between the month of predicted and reference extrema. “LOMO” is leave-one-month-out refitting; it is still not geographic out-of-sample validation.

| Current registry key | MAE °C | RMSE °C | Bias °C | Max abs °C | Peak/trough phase months | LOMO MAE/RMSE/max °C |
|---|---:|---:|---:|---:|---:|---:|
| zone1 (mislabelled Alice) | 0.667 | 0.697 | 0.000 | 0.998 | 0 / 1 | 0.890 / 0.930 / 1.330 |
| zone2 (mislabelled Rockhampton) | 0.779 | 0.950 | 0.000 | 1.636 | 0 / 0 | 1.039 / 1.267 / 2.181 |
| zone3 Sydney | 0.523 | 0.602 | 0.000 | 1.251 | 0 / 0 | 0.697 / 0.802 / 1.667 |
| zone4 Melbourne | 0.496 | 0.502 | 0.000 | 0.613 | 0 / 0 | 0.661 / 0.669 / 0.817 |
| zone5 Canberra/ASHP | 0.587 | 0.694 | 0.000 | 1.103 | 1 / 1 | 0.783 / 0.925 / 1.471 |

Zero bias is expected from fitting and is not independent evidence. Five parameters for twelve values leave only seven residual degrees of freedom; no held-out city or metered mains data is used.

### 6.4 Selector and regeneration defects

- `findNearestCERZone` selects by ambient annual mean plus monthly swing, not postcode. It has no regulatory boundary, coast/elevation/ground-temperature model, or validation for remote Australia.
- Comments at `js/app.js:3973` and `4014` say “display only”, while `calculateLocalTMains` uses the selected constants at `1136-1148` in every production run.
- The five anchor climates select their current names largely by construction. That is not a national extrapolation test.
- `tools/fit_bc_aus.py` and `tools/fit_bc_aus_by_zone.py` write generated JavaScript beside the scripts under `tools/`; production loads `data/` and `js/`. There is no canonical source-to-runtime generation path or byte-identical CI check.

## 7. Quantified production-path impact

### 7.1 Method and limits

The real browser UI, local backend, actual hourly production loop, both frozen models and all five industry branches were run without editing code. At Rockhampton and Alice Springs, the current runtime mains profile was compared with a **custom-monthly anchor correction scenario** using the raw CER monthly series for the fixture identity supported by `ASSIGN` and the official postcode table.

This is a materiality counterfactual, not a final corrected BC-Aus implementation. It does not refit the curve, decide SWH versus ASHP authority, or validate interpolation between zones. Models A/B remain untouched.

### 7.2 Supply effect

| Climate / model | Current thermal kWh | Current PV kWh | Current outlet °C | Current supply value AUD/yr | Anchor-scenario change: thermal | PV | outlet | value |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Rockhampton / A | 171,385.5 | 104,965.5 | 23.1 | 40,833.03 | −24.4% | −1.7% | +3.8°C | −9.8% |
| Rockhampton / B | 405,281.6 | 106,931.1 | 26.5 | 61,176.12 | −4.2% | −1.7% | +4.1°C | −3.1% |
| Alice Springs / A | 129,220.9 | 111,313.5 | 29.1 | 38,975.43 | +44.1% | +2.4% | −6.1°C | +14.3% |
| Alice Springs / B | 420,002.5 | 114,077.2 | 32.9 | 64,352.53 | +6.1% | +2.4% | −6.3°C | +4.6% |

The sign differs by climate because the current identity swap makes Rockhampton mains too cold-seasonal and Alice mains too warm-flat relative to the raw fixture identity.

### 7.3 All-industry effect

Each cell is: **thermal demand %, matched solar heat %, coverage percentage-points, annual savings %** under the anchor scenario relative to current runtime.

| Climate / frozen model | Dairy | Brewery | Aquatic | Hotel | Laundry |
|---|---|---|---|---|---|
| Rockhampton / A | −29.4, −38.5, −4.9 pt, −8.1 | −16.8, −20.7, −4.2 pt, −3.2 | −3.1, −24.9, −3.5 pt, −10.7 | 0.0, −19.9, −10.6 pt, −6.8 | −12.9, −23.0, −9.1 pt, −14.9 |
| Rockhampton / B | −29.4, −27.3, +1.6 pt, −7.3 | −16.8, −17.8, −1.1 pt, −2.9 | −3.1, −5.2, −0.7 pt, −3.4 | 0.0, −8.2, −5.2 pt, −3.7 | −12.9, −12.6, +0.3 pt, −8.9 |
| Alice Springs / A | +77.4, +106.7, +5.1 pt, +11.3 | +36.0, +52.7, +9.9 pt, +5.3 | +4.1, +50.7, +4.2 pt, +15.9 | 0.0, +38.6, +14.4 pt, +9.8 | +24.2, +46.2, +11.9 pt, +25.2 |
| Alice Springs / B | +77.4, +71.3, −1.9 pt, +12.1 | +36.0, +39.2, +2.2 pt, +4.6 | +4.1, +8.1, +1.1 pt, +5.0 | 0.0, +13.9, +7.8 pt, +5.5 | +24.2, +23.6, −0.5 pt, +15.1 |

Hotel annual thermal demand is mains-independent because its process intensities are fixed kWh/room-night; its matched heat still changes because supply changes. Coverage may move opposite annual demand when the hourly supply and demand shapes shift differently.

### 7.4 Sydney production-path characterization

At the audited 250 m² Sydney scenario and current UI inputs:

| Frozen model | PVT electricity | Thermal | PV-only | Cooling gain | Total | Outlet | Supply upper-bound value |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 91,868 kWh | 120,635 kWh | 86,029 kWh | 5,839 kWh | 212,504 kWh | 19.9°C | $32,997.97/yr |
| B | 93,801 kWh | 344,055 kWh | 86,029 kWh | 7,772 kWh | 437,855 kWh | 23.2°C | $52,444.63/yr |

This table is a locked behavioural characterization, not validation. Model choice is the largest observed supply driver.

## 8. Weather and independent Australian cross-checks

### 8.1 Actual current PVGIS behaviour

Installed pvlib 0.15.0 defaults to `url='https://re.jrc.ec.europa.eu/api/'`, `usehorizon=True`, unspecified start/end years and `coerce_year=1990`. At audit time the unversioned endpoint returned the same Sydney TMY as an explicit PVGIS 5.3 call:

- database PVGIS-ERA5 / ERA5;
- source years 2005–2023;
- horizon enabled and DEM-calculated;
- 12 selected typical months retained only in backend `meta`;
- Sydney annual GHI 1,661.544 kWh/m², DNI 1,801.380 kWh/m².

Explicit v5.2 produced GHI 1,720.029 (+3.5%) and DNI 1,932.250 (+7.3%), with years 2005–2020. Thus the documentation's 5.3 description matches current network behaviour but is not guaranteed by the code. The JRC API documentation explicitly distinguishes `/api/v5_3/` and `/api/v5_2/` and warns that the old unversioned entry point has changed behaviour.

Current PVGIS TMY includes RH and `IR(h)`, contrary to runtime comments. The backend keeps only DNI, DHI, GHI, temperature and 10 m wind in each record. Reports and fixtures do not retain enough request, package, database, month-selection and cryptographic provenance to reconstruct a published scenario.

### 8.2 Time-key defect

The raw PVGIS UTC sequence contains 8760 unique continuous instants. After forcing the composite TMY to 1990 and converting through historical Australian zone rules:

| Location | Records / solarHour | Unique `(dayN,hourN)` | Duplicate key | Missing key | Cause |
|---|---:|---:|---|---|---|
| Sydney | 8760 / 8760 local | 8759 | day 63, hour 3 | day 301, hour 3 | 1990 NSW DST |
| Rockhampton | 8760 / 8760 local | 8759 | day 63, hour 3 | day 301, hour 3 | 1990 Queensland DST trial encoded in tzdata |
| Perth | 8760 / 8760 local | 8760 | none | none | no 1990 DST discontinuity |
| Alice Springs | 8760 / 8760 local | 8760 | none | none | no 1990 DST discontinuity |

This does not change the number of annual supply records, but it changes which local demand hour receives supply and creates one duplicated/missing clock slot. Melbourne also had only 8759 unique local day/hour keys. Solar geometry should remain on the UTC-derived `solarHour`; demand scheduling needs a deliberately synthetic, unique 365×24 standard-time clock rather than historical 1990 civil time.

### 8.3 Independent climatological checks

These checks are deliberately modest: a climatological annual GHI agreement is not hourly validation.

| Site | PVGIS TMY GHI converted to mean daily exposure | BOM station climatology | Difference |
|---|---:|---:|---:|
| Sydney | 16.39 MJ/m²/day | Observatory Hill 16.3 MJ/m²/day | about +0.5% |
| Alice Springs | 21.59 MJ/m²/day | Airport 21.7 MJ/m²/day | about −0.5% |

NatHERS 2022 has BOM-derived hourly Reference Meteorological Year files for 69 climate zones using 1990–2015 observations. They are available for research by request and are not present in the repository. Until an approved comparison is performed, hourly Australian weather validation remains **Not validated**.

## 9. Industry evidence review

### 9.1 Dairy

- Functional unit: litres of raw milk throughput per year.
- Included: three low-temperature water-heating processes and a whole-site-like electricity intensity.
- Excluded/unclear: product mix, milk cooling heat recovery, refrigeration technology, steam system, CIP chemistry/cycles, effluent, facility scale.
- The exact 1.37 L/L warm-water total and 51.7 kWh/kL electricity value are arithmetic locks, but the UI's most specific “source” is an unpublished internal justification. Current Dairy Australia guidance supports the general importance of vat wash, cooling and yard water, not these exact intensities, targets or schedules.
- Classification: editable assumptions pending public Australian plant-level evidence. Required range: site-metered or dataset-derived by product/facility class.

### 9.2 Brewery

- Functional unit: litres/hectolitres of beer.
- Included: low-temperature CIP/rinse/feedwater preheat; refrigeration/daytime electricity profile.
- The exact water rates, 40–45°C targets, seasonality and 11.5 kWh/hL are supported mainly by RPubs, Kaggle, vendor/blog, ResearchGate copies and international sources.
- Australian government/RACE material supports low-temperature process-heat opportunity, not these exact plant defaults.
- Classification: editable scenario assumptions. Whole-site energy must not be conflated with PVT-eligible preheat.

### 9.3 Hotel

- Functional unit: occupied room-night.
- NABERS Hotels Rules v4.3 (April 2026) is current and governs whole-building rating data. It does not directly decompose 4.5/1.6/1.2/0.8 thermal or 15 electrical kWh/room-night.
- Weather reshaping preserves the annual assumed electrical total, so it cannot validate the total.
- Classification: derived assumptions. Require a transparent water-volume/occupancy/temperature derivation or metered Australian submeter data, with hotel class and services boundary.

### 9.4 Aquatic centres

- Functional unit is inconsistently used: heat is per pool-water surface; the cited Deakin range is total energy per conditioned floor area; the electrical default is applied per water surface.
- PVGIS supplies RH, but `getAquaticRelativeHumidity` always returns a fixed process value. Outdoor vapour pressure therefore ignores actual climate humidity.
- 10 m wind is used at the water surface without terrain/building/indoor correction.
- SOAC field evidence covers only 19 days and reportedly yields about 0.63× the certified thermal curve. It cannot validate national annual defaults or the electrical cooling heuristic.
- Classification: engineering model with assumptions, not independently calibrated national model.

### 9.5 Commercial laundry

- Functional unit: kg linen processed; thermal hot-water scope only.
- Sydney Water current benchmark table: efficient commercial laundries are 17–22 L/kg without reuse and 12–15 L/kg with reuse. The 10 L/kg UI default is 17% below the low end of efficient reuse and 41% below the low end without reuse.
- With all other inputs fixed, replacing 10 L/kg by 12–15 increases volume-dependent wash/rinse heat 20–50%; 17–22 increases it 70–120%.
- WELS' 2025–26 expansion work lists commercial clothes washing machines as a candidate category, which confirms they are not currently a normal regulated WELS product class. Household washer labels cannot substantiate the commercial default.
- Classification: transparent editable assumption, but the default and citation should be corrected. Drying, ironing, finishing steam, motors, ventilation and whole-site electricity remain explicitly excluded.

## 10. Source register

Access date for every source: 2026-07-10. “Page/table” states the exact supporting location when publicly accessible; “catalogue/scope only” means the source cannot support a numerical clause claim.

| Publisher | Title / edition / date | Page/table or supporting item | Geography / denominator / transformation | Evidence class and audit use | URL |
|---|---|---|---|---|---|
| Clean Energy Regulator | Postcode zones for air source heat pumps and solar water heaters, Version 3, effective 2020-01-01 | Postcode rows 0870–0875 and 4620–4724; notes: 5 ASHP zones, 4 SWH zones | Australia; postcode to regulatory zone | R; confirms zone 1 Rockhampton and zone 2 Alice identities | https://cer.gov.au/document/postcode-zones-solar-water-heaters-and-heat-pumps |
| Federal Register of Legislation | Renewable Energy (Method for Solar Water Heaters) Determination 2016 | Instrument text and incorporated AS/NZS 4234:2008 method references | Australia; SRES regulatory rating, not general engineering truth | R; explains legitimate legacy use | https://www.legislation.gov.au/F2017L00028/asmade |
| Standards Australia | AS/NZS 4234:2021 and Sup 1:2021, published June 2021 | Public announcement and scope; numerical clauses not publicly verified | AU/NZ heated-water simulation | R/V; current engineering authority, clause audit pending licensed access | https://www.standards.org.au/news/revised-standard-to-assist-in-lowering-household-energy-consumption |
| ISO | ISO 9806:2025, Edition 3, 2025-10 | Official catalogue scope and lifecycle only | International collector testing including hybrid collectors | R/V; current version check only, Model B frozen | https://www.iso.org/standard/78801.html |
| European Commission JRC | PVGIS API non-interactive service | API entry points and TMY input table (`usehorizon`, start/end defaults) | Global/Europe service; site TMY | V; proves versioned endpoints and defaults | https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en |
| European Commission JRC | PVGIS TMY generator / PVGIS 5 user manual | TMY variable list: RH, G(h), Gb(n), Gd(h), IR(h), WS10m; timestamp notes | Hourly TMY fields | V; disproves “no RH/long-wave” claim and identifies time-offset semantics | https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-tools/pvgis-typical-meteorological-year-tmy-generator_en |
| pvlib | `get_pvgis_tmy`, documentation for current stable series | Function signature: unversioned URL, horizon true, coerce_year 1990 | Python client behaviour | V/software; reproduces installed defaults | https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.iotools.get_pvgis_tmy.html |
| NatHERS | NatHERS 2022 Climate Files | 69 RMY zones; 1990–2015; BOM-derived hourly fields | Australia; climate-zone weather | M/V; required independent hourly comparison, files absent | https://www.nathers.gov.au/climate-files |
| Bureau of Meteorology | Climate statistics, Sydney Observatory Hill | “Mean daily solar exposure” row, annual 16.3 MJ/m² | Sydney station climatology | M; annual GHI cross-check only | https://www.bom.gov.au/climate/averages/tables/cw_066062_All.shtml |
| Bureau of Meteorology | Climate statistics, Alice Springs Airport | “Mean daily solar exposure” row, annual 21.7 MJ/m² | Alice Springs station climatology | M; annual GHI cross-check only | https://www.bom.gov.au/climate/averages/tables/cw_015590_All.shtml |
| DCCEEW | National Greenhouse Accounts Factors 2025 | Table 1 location-based Scope 2; natural-gas row: CO2 51.4, CH4 0.1, N2O 0.03, combined 51.53 kg CO2-e/GJ | Australia; reporting factors by grid/fuel/scope | R; electricity verified, gas boundary mismatch found | https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-account-factors-2025.pdf |
| DCCEEW | Australian Energy Update 2025 / Australian Energy Statistics, 2023–24 | National tables by sector/fuel | Australia; aggregate PJ, not process intensity | R/M; context only, cannot justify dairy/brewery defaults | https://www.energy.gov.au/energy-data/australian-energy-statistics |
| ABS | Energy Account, Australia 2023–24, released 2025-11-20 | Physical supply/use tables and methodology | Australia; aggregate industry/household PJ | R/M; context only, unsuitable process denominator | https://www.abs.gov.au/statistics/industry/energy/energy-account-australia/latest-release |
| NABERS | Energy and Water for Hotels Rules v4.3, April 2026 | Whole-building hotel rating rules | Australia; hotel building/rating boundary, not process kWh/room-night | R/V; current source but does not support exact decomposition | https://www.nabers.gov.au/publications/nabers-energy-and-water-hotels-rules |
| Sydney Water | Benchmarks for water use | Commercial laundries table: 17–22 L/kg no reuse; 12–15 L/kg with reuse | Sydney service area; litres/kg linen | M/official benchmark; challenges 10 L/kg | https://www.sydneywater.com.au/your-business/managing-your-water-use/benchmarks-for-water-use.html |
| Water Rating / DCCEEW | New product nomination; 2025–26 work plan, modified 2026-06-15 | Ranked candidate “Commercial clothes washing machines” | Australia; regulatory product scope | R; confirms commercial washers are proposed, not current normal WELS scope | https://www.waterrating.gov.au/industry/register/new-product-category-nomination |
| Dairy Australia | Dairy Water Savings | Guidance on cooling, vat wash and yard water | Australian dairy farms; no exact audited process intensity | Industry guidance; corroboration only | https://www.dairyaustralia.com.au/en/soils-and-water/water-management/dairy-water-savings |
| energy.gov.au | Food and beverage manufacturing; Process heat and steam | Process-heat and preheat guidance | Australia; sector opportunity, not exact plant intensity | Government guidance; scope corroboration only | https://www.energy.gov.au/business/sector-guides/manufacturing/food-and-beverage |
| RACE for 2030 | Electrification & renewables to displace fossil fuel process heating | Food/beverage site and process-heat discussion | Australia; technology opportunity | Research/industry; corroboration, not exact runtime defaults | https://www.racefor2030.com.au/content/uploads/B3-OA-Project-Final-Report-July-2021-20210721a-compressed.pdf |

No source reviewed supports treating national ABS/Australian Energy Statistics aggregates as a derivation of any exact process-specific intensity in the app.

## 11. Issue register, ordered by severity

| ID / severity | Evidence | Affected outputs | Direction and quantified/expected impact |
|---|---|---|---|
| C1 Critical — zone 1/2 identity reversal | raw fixtures versus fitting/runtime labels (§6) | Tin, both thermal models, all water-heating demand, matching, savings, emissions, economics | Production counterfactual: thermal supply −24.4% to +44.1%; matched heat up to +106.7%; savings −14.9% to +25.2% across audited climates/industries. |
| H1 High — deployed backend drift | strict live test: 0/8760 solarHour; five Sydney live/local mismatches | geometry, every result, share/reproduction | Unknown sign; deployed fallback uses civil clock as solar time. Must block claims of reproducibility. |
| H2 High — unversioned weather/dependencies | `server.py:137`; loose requirements | all supply and weather-shaped demand | Sydney PVGIS 5.2 versus 5.3 GHI differs +3.5%, DNI +7.3%; future endpoint/package changes can silently move output. |
| H3 High — historical-DST duplicate/missing demand hour | `coerce_year=1990`, zone conversion; unique-key audit | hourly matching and schedules | Annual record count unchanged; one duplicated and one missing local key in tested DST locations. Timing effect scenario-dependent. |
| H4 High — BC zone-family/selector unsupported | generic five-zone runtime; climate-fingerprint selection | national mains profile and downstream outputs | Unknown outside anchors; can choose a non-regulatory zone anywhere in Australia. |
| H5 High — industry exact defaults not substantiated | §9 and source register | demand, coverage, savings, sizing claims | Potentially order-one. Laundry alone is 20–120% higher volume heat at current official efficient ranges versus 10 L/kg. |
| H6 High — PV cooling heuristic unvalidated | `calcPvtPanelTempC`; SOAC evidence too short | PV gain, total energy, value, emissions | Sydney audited cooling gain is 5,839–7,772 kWh/year (6.8–9.0% over PV-only), all currently unsupported as an independently validated annual gain. |
| H7 High — aquatic boundary and climate inputs | fixed RH; 10 m wind; floor/surface denominator | aquatic demand and savings | Direction varies. Electrical default may be materially mis-scaled because area and energy boundary differ. |
| H8 High — non-deterministic/broken regeneration | scripts write under `tools/`, runtime under `data/`/`js/` | BC constants and validation claims | Stale runtime artifacts can persist after a “successful” refit. |
| M1 Medium — natural-gas factor boundary | 51.4 labelled CO2-e versus NGA combined 51.53 | avoided emissions | Combined Scope 1 would be +0.253% versus current gas avoided-emission number; Scope 3 would add more and is location-specific. |
| M2 Medium — local/weather metadata discarded | backend returns meta; frontend/export does not retain full provenance | reproducibility, audit trail | A scenario cannot prove database years/months/version/request after the fact. |
| M3 Medium — economic point estimate and unit wording | `app.js:5027-5053`; docs AUD/GJ mismatch | payback, NPV, LCOE/H, value | Sign and scale depend on omitted tariffs/escalation/degradation/replacement/tax/GST. Gas price unit error would be ×1000 if a user follows AUD/GJ wording literally. |
| M4 Medium — CAPEX “default” has two states | HTML 800 AUD/m²; checked auto-fill produces 540 | NPV, payback, LCOE | 32.5% lower runtime CAPEX than static field value; source status remains A. |
| M5 Medium — idealised storage | monthly free-shift bound; lossless hotel tank and 35°C target | coverage/backup/storage interpretation | Always optimistic relative to lossy finite storage; magnitude scenario-dependent. |
| M6 Medium — tests are not independent | copied geometry/economics/model equations; nonasserting e2e | confidence claims | Green tests can preserve a shared defect. No direct numeric impact, high assurance impact. |
| M7 Medium — DC/AC and system-loss omissions | PV result labels and equations | electrical yield/value/emissions | Direction is optimistic; magnitude not independently calculated in this audit. Must be explicit or modelled. |
| L1 Low — stale comments/docs/counts | display-only selector, no RH/IR, stale validation counts/claims | user interpretation | Misleads reviewers even where code arithmetic is correct. |

## 12. Uncertainty and sensitivity

### 12.1 Ranked observed drivers

1. **Frozen thermal-model choice:** Sydney Model B annual thermal is 185% above Model A under the same inputs. This uncertainty cannot be reduced by changing Models A/B in this workstream.
2. **Mains identity/profile:** observed thermal supply envelope is −24.4% to +44.1% for Model A and −4.2% to +6.1% for Model B; all-industry savings envelope is −14.9% to +25.2% for A and −8.9% to +15.1% for B.
3. **Industry intensity and denominator:** exact defaults lack defensible distributions. Laundry's official efficient ranges alone imply +20% to +120% volume-dependent heat relative to 10 L/kg.
4. **PVGIS version/database:** Sydney v5.2 versus v5.3 changed annual GHI by 3.5% and DNI by 7.3% before any collector model.
5. **PVT electrical cooling heuristic:** contributes 6.8–9.0% above PV-only in the audited Sydney scenario, with no validated uncertainty range.
6. **Area, efficiency and throughput:** largely linear before clamps/matching; input measurement uncertainty transfers directly.
7. **Schedules and storage:** annual demand normalization hides potentially large changes in direct hourly coverage and export.
8. **Tariffs, CAPEX and finance:** savings are linear in prices; NPV and levelised costs are sensitive to CAPEX/discount/life and omitted degradation/escalation/replacement.

### 12.2 Defensible range statement

The only defensible numerical range presently available is the **observed scenario envelope above**, not a statistical confidence interval. The repository contains no validated probability distributions for weather-year variation, collector coefficients, industry intensities, schedules, tariffs or capital cost. Emitting a P10/P50/P90 range would manufacture certainty.

A later phase should use source-defined or metered ranges and report at least local sensitivity, scenario envelopes and Monte Carlo intervals. Model A/B coefficients must remain fixed during upstream sensitivity tests.

## 13. Software assurance and documentation gaps

- `validation/unit/test_geometry.mjs` contains a copied geometry class; it does not import the browser production implementation.
- economics tests mirror formulas, which verifies arithmetic but not implementation wiring or financial applicability.
- `validation/scripts/verify_js_e2e.mjs` prints pvlib differences and exits successfully without an assertion threshold.
- weather “checksums” are annual sums stored alongside the mutable fixture, not SHA-256 hashes anchored to an independent manifest.
- live matrix covers only Sydney/Melbourne and ordinarily records missing `solarHour` as known; strict mode fails today.
- `.github/workflows/validation.yml` runs offline and three browser smoke tests only. It omits strict live, flow diagnostic, link review, all CER anchors and regeneration.
- requirements and Node dependency ranges are not deterministic.
- existing validation documentation has stale assertion counts and claims; a passing test should not be called external validation unless it is independent.

## 14. Prioritized fix plan — outside Model A/B only

No item below is authorized by this report. Implement only after explicit approval.

1. **Quarantine the current BC-Aus regional mapping.** Stop presenting it as correct. Parse fixture identity directly from `ASSIGN`, declared zone and latitude. Decide and document SWH engineering versus SRES regulatory use before generating constants.
2. **Build an authoritative zone registry.** Use official CER postcode ranges for the chosen regulatory case; do not infer regulatory zone from weather similarity. Keep ASHP and SWH zone families distinct. For non-regulatory engineering mains, use a separately named, validated model.
3. **Regenerate deterministically.** One raw-data directory, one identity manifest with SHA-256, one generator, explicit output paths to runtime assets, no timestamps in generated bytes, and CI byte-for-byte regeneration.
4. **Pin weather provenance.** Explicit PVGIS `/api/v5_3/`, database/years/horizon/request parameters, lock Python dependencies, retain selected months and full request metadata, and hash every hourly scenario dataset.
5. **Separate UTC/solar/standard demand clocks.** Preserve UTC instants and solarHour; generate a unique synthetic 365×24 local-standard-time demand calendar. Add deliberate DST policy rather than historical 1990 conversion.
6. **Redeploy and gate the hosted backend.** Refuse production calculations when required contract/version fields are absent; strict live must pass before release.
7. **Retain current weather fields outside Model B.** Carry RH and source long-wave metadata through the backend. Use RH for aquatic sensitivity only after unit/quality validation. Model B integration remains prohibited.
8. **Reclassify industry defaults.** Replace “validated” language with evidence class and editable range. Prefer Australian metered data; otherwise publish transparent assumptions. Update laundry to a sourced scenario choice (reuse/non-reuse), not one false universal default.
9. **Validate the PVT cooling heuristic independently.** Compare against manufacturer/metered paired PV/PVT temperatures and AC energy over seasons. If evidence is inadequate, expose it as optional sensitivity and exclude it from headline “validated” output.
10. **Clarify PV system boundary.** Label DC energy or add independently tested inverter/system losses outside Models A/B. Report every excluded loss.
11. **Correct reporting boundaries.** Natural gas label/value/scope, grid location selection, 100% utilization upper bound, storage idealizations, AUD/MJ wording, DC/AC status, and whole-site exclusions.
12. **Add uncertainty outputs.** Ranges must come from traceable evidence or measured site inputs, never unsourced percentages.

## 15. Required tests for proposed corrections

| Proposed correction | Mandatory test |
|---|---|
| Fixture identity | Parser asserts weather filename, zone, latitude, revision and all 12 values for every raw deck. A permutation-kill test must fail if any two identities are swapped. |
| CER authority | Postcode boundary tests for first/last postcode in every zone, plus 0870 and 4700; SWH and ASHP registries cannot cross-load. |
| BC fitting | Per-zone MAE/RMSE/bias/max/phase; leave-one-month-out and held-out-city/metered validation; reject fits with wrong manifest hash. |
| Regeneration | Clean CI generation must leave committed runtime artifacts byte-identical; generator output path is asserted. |
| Frozen boundary | Recompute the protected SHA-256 table and locked numeric cases on every change; failure blocks merge. |
| Weather pinning | Contract asserts API URL/version, database, source years, horizon, selected months, package versions, request parameters and hourly SHA-256. |
| Clock model | Exactly 8760 unique UTC, solar and demand-clock records for all Australian zones; no duplicate/missing `(day,hour)`; known noon/weekday cases. |
| Hosted backend | Strict live contract at all five CER anchors and major states; zero tolerance for missing `solarHour`/provenance version. |
| Geometry | Extract/import actual production module; compare randomized cases with pvlib solarposition and POA, including south/north hemispheres, azimuths, night and polar edges. |
| PV cooling | Production-path paired tests against independent measured fixtures; sensitivity with heuristic disabled/enabled; AC/DC boundary conservation. |
| Industry models | Page-level source manifest; hand calculations; annual normalization; zero/edge/property tests; measured hold-outs by facility type; range propagation. |
| Aquatic | RH/weather and fixed-RH comparisons; water-surface versus floor-area schema test; wind-height/indoor policy; component energy closure. |
| Laundry | 10, 12, 15, 17 and 22 L/kg scenarios; explicit reuse flag; thermal-only exclusion remains visible in every report. |
| Matching/storage | Hourly supply=used+excess, demand=used+unmet; SOC closure including losses; PV self-use/export exclusivity; monthly/daily/annual identity through production UI. |
| Economics | Production-path fixtures for AUD/MJ and AUD/GJ rejection, real/nominal basis, zero rate, escalation/degradation/replacement/residual scenarios, and CAPEX auto-fill state. |
| Emissions | NGA version/scope snapshot, all grid options including NWIS/off-grid policy, natural-gas component sum 51.4+0.1+0.03=51.53. |
| Documentation | Generated claim/source inventory fails CI if numeric defaults lack evidence class, denominator, source date and scope. Assertion counts are generated, not hand-written. |

## 16. Residual limitations

- ISO 9806:2025 numerical clauses and AS/NZS 4234:2021/Supplement 1 licensed content were not available for a full clause-by-clause audit. No inference was substituted.
- NatHERS RMY hourly files were not present; only BOM climatological annual solar exposure was independently compared.
- No Australian plant-level metered datasets were available for dairy, brewery, hotel, aquatic or laundry hold-out validation.
- No manufacturer-certified PVT AC electrical dataset or long-duration paired PV/PVT field series was available for the cooling heuristic.
- No probabilistic uncertainty distributions can presently be defended.
- The anchor correction scenarios quantify materiality but are not a final corrected or refitted BC-Aus model.
- Existing dirty-worktree changes were treated as the audit baseline and not attributed, reverted or modified.

## 17. Phase-1 conclusion

Verified: many unit conversions, finance equations, hourly min/max matching identities, fixed-calendar aggregation, finite guards, local `solarHour` calculation, and protected Model A/B integrity.

Benchmark-agreeing but not independently validated: isotropic solar/POA arithmetic and annual PVGIS/BOM GHI climatology.

Assumption-based: most industry intensities/schedules, PV electrical cooling, costs/tariffs, storage idealizations and several equipment/system boundaries.

Incorrect or non-reproducible: BC-Aus zone 1/2 identity, generic five-zone use, deployed solar-hour contract, historical-1990 demand clock, unversioned weather/dependencies, natural-gas CO2-e labelling, and several source/applicability claims.

**Stop here. Await explicit approval before implementing any proposed correction.**

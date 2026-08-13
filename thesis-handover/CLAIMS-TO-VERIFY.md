# CoolSheet PVT Calculator — thesis claims to verify against the code

**Context.** A UNSW thesis report documents this codebase. The methodology chapter makes
specific, checkable assertions about what the software does. Your job is to confirm each
one against the actual implementation, and to extract a few values the report still needs.

**Do not change the code to match the report.** The report is the thing that will be
corrected. Report what the code actually does.

Repository entry points referenced by the report: `index.html`, `js/app.js`,
`pvt-tmy-api/server.py`, `validation/`.

---

## Part 1 — Claims asserted in the report

For each: mark **MATCH**, **MISMATCH** (state what the code actually does), or
**NOT FOUND** (claim can't be located in the code). Cite file and line.

### III.A Architecture
1. Frontend is static HTML, CSS and vanilla JavaScript — no framework, no build/compile step.
2. A separate Python **FastAPI** backend retrieves and preprocesses weather data only.
3. The full annual simulation (supply, demand, matching, economics) runs **client-side** in the browser.
4. Results are stored in **one common result object**, not recalculated per display component.

### III.B Inputs and boundaries
5. User inputs fall into four groups: site/PVT system; facility demand; economics and emissions; optional overrides.
6. Array is modelled as a single **fixed-tilt homogeneous** array — no tracking, no per-string shading.
7. Wiring, mismatch, soiling and availability are combined into **one** user-defined system-loss factor.
8. **No thermal storage and no battery storage.** Excess heat is discarded; surplus electricity may be exported.
9. Unmet thermal demand → auxiliary heater; unmet electrical demand → grid.
10. Monthly mains-water temperatures can optionally be entered manually to override the model.

### III.C Weather acquisition
11. Address → coordinates via **OpenStreetMap Nominatim**.
12. TMY retrieved from **PVGIS version 5.3** using pvlib's **`get_pvgis_tmy`**.
13. Retrieval period is **fixed at 2005–2023** (not rolling/latest).
14. Returns **365 days × 24 hours = 8,760** records.
15. Fields used: DNI, DHI, GHI, ambient temperature, wind speed.
16. **Daylight saving is excluded** — every day has exactly 24 unique hourly records.
17. Two separate time bases: **local standard clock time** for demand scheduling, **true solar time**
    (from UTC timestamp, longitude, equation of time) for solar geometry only.

### III.D Solar geometry and transposition
18. Declination uses the **Cooper** correlation: `δ = 23.45 sin[360/365 (n+284)]`.
19. Hour angle `ω = 15(h_s − 12)`, computed from **true solar** time.
20. Interface azimuth convention is 0°=N, 90°=E, 180°=S, 270°=W, converted internally by
    **subtracting 180°** so 0° = south-facing.
21. Transposition is **isotropic** (not Perez/Hay-Davies): `G_d = DHI(1+cosβ)/2`,
    `G_r = G_HI·ρ_g·(1−cosβ)/2`.
22. Beam is zeroed when the sun is below the horizon **or behind the collector plane**;
    negative irradiance cannot propagate.

### III.E PVT supply model
23. **Two** thermal models exist: Model A (inlet-temperature correlation) and Model B (ISO 9806).
24. Model A: `η = clamp[a0 + a1·(T_in − T_a)/G + a2·u, 0, 1]`, then `Q̇ = η·G·A`.
25. Model B in production reduces to the **quadratic** form
    `Q̇ = A[η0·G − a1(T_m − T_a) − a2(T_m − T_a)²]` — i.e. the wind and long-wave
    coefficients (a3, a4, a6, a8) are **zero by default**.
26. Because T_m depends on T_out, Model B is solved iteratively by **Newton–Raphson**.
27. Model A's outlet temperature is computed **directly** from the fluid energy balance.
28. Negative useful thermal power is clamped to zero in **both** models.
29. PV cell temperature uses the **NOCT** relation `T_cell = T_a + (G/800)(T_NOCT − 20)`.
30. A separate **cooled** PVT cell temperature is clamped between `T_in` and the uncooled
    `T_cell,PV`; U_L is the absolute first-order heat-loss coefficient of the active thermal model.
31. `f_T = max[0, 1 + γ_P(T_cell − 25)]` — note the **max(0, …)** floor.
32. AC conversion: `E_AC = E_DC(1 − L_sys)·η_inv`.
33. A **PV-only baseline** is computed alongside PVT, and the cooling correction **can be disabled**
    so the two are identical.

### III.F BC-Aus mains-water model
34. Sinusoidal Burch–Christensen form, evaluated in **Fahrenheit**, then converted to °C.
35. Southern-Hemisphere day shift: `d_m = ((d + 181) mod 365) + 1`.
36. **Four** runtime reference locations: Rockhampton, Alice Springs, Sydney, Melbourne.
37. Fitted coefficients (offset °F / amplitude ratio / phase lag days):
    Rockhampton +5.424 / 0.802 / −6.740; Alice Springs −0.473 / 1.061 / −8.622;
    Sydney −0.377 / 1.034 / −0.086; Melbourne −0.822 / 0.973 / +0.701.
38. **Canberra is excluded** from runtime selection (fitted but not selectable).
39. Nearest reference selected by **haversine** distance; selected reference and its distance
    are retained in the result and shown to the user.
40. Coefficients are applied to the **actual site's** PVGIS climate statistics — a site assigned to
    Melbourne does **not** receive Melbourne's stored profile.
41. Output is one temperature per day (365), applied to all hours of that day.

### III.G.1 Dairy demand model
42. Boundary is a dairy **farm/shed**, not a processing factory (no pasteurisation, homogenisation,
    evaporation, drying).
43. Three thermal processes with water coefficients **0.30, 0.57, 0.50 L per L milk** (total **1.37**).
44. All three preheat targets are **35 °C**.
45. Hourly allocation: fatty-film rinse 50% at 07:00 + 50% at 17:00; CIP 25% each at 08:00, 09:00,
    17:00, 18:00; boiler feedwater uniform across 24 h.
46. Monthly seasonal factors Jan–Dec: 0.85, 0.80, 0.85, 0.90, 0.85, 0.75, 0.75, 0.80, 1.10, 1.30, 1.30, 1.05.
47. Factors are **normalised** so `Σ D_m·s_m = 365` and hourly weights sum to 1 per day.
48. Default electricity intensity **51.7 kWh per kL** of milk.
49. Electrical profile has overnight baseload plus milking peaks at roughly **05:00–07:00 and 15:00–17:00**.
50. Dairy model runs **every day of the year** (no shutdown periods).

### III.H Hourly matching
51. `matched = min(supply, demand)`, `unmet = max(0, demand − supply)`, `excess = max(0, supply − demand)`,
    applied **per hour**, independently for thermal and electrical.
52. Solar fraction = Σ matched ÷ Σ demand over 8,760 hours.
53. A **monthly** matching calculation exists but is used only as an idealised storage upper bound,
    **not** for the headline results.

### III.I Economics and emissions
54. Matched electricity valued at purchase tariff; exported at feed-in tariff; matched heat converted to
    avoided gas via **boiler efficiency**, with a **3.6** kWh→MJ factor.
55. Excess thermal energy is assigned **zero** economic value.
56. `C_0 = c_A·A` and `C_O&M = r_O&M·C_0`.
57. SPP, NPV (constant annual savings, no escalation/degradation/tax/financing), and CRF-based LCOE/LCOH.
58. Natural-gas emissions factor **51.53 kg CO₂-e/GJ**.
59. **Electricity exports are excluded** from avoided emissions — only directly matched energy counts.

### III.J Design explorer
60. Collector area is the swept variable; the **full 8,760-hour** thermal calculation is re-run per area
    (not scaled from one annual result).
61. Target solar fraction solved by **bisection**, up to approximately **40 iterations**.

### III.L Validation
62. Test suites exist for: equation locks, boundary/edge cases, backend weather contract,
    pvlib comparison, BC-Aus identity/regeneration/propagation, browser-level integration.
63. Locked weather **fixtures** are used so external PVGIS changes don't move the baseline.
64. SOAC field data: **19 days** of **five-minute** data.

---

## Part 2 — Values the report still needs from you

These were deliberately removed from the report body and belong in appendices that are
not yet written. Please read them out of the code with **full stored precision**:

- **A.** Model A coefficients `a0,A`, `a1,A`, `a2,A` (report previously used 0.279953,
  −10.5284, −0.008136 — confirm or correct).
- **B.** Model B coefficients `η0`, `a1`, `a2` (previously 0.762, 3.93, 0.0095), and confirm
  a3/a4/a6/a8 are zero.
- **C.** Newton–Raphson config: initial outlet estimate, iteration cap, convergence tolerance
  (previously 40 °C, 5 iterations, 1e-4 °C).
- **D.** `c_p` and water density constants as actually coded.
- **E.** Complete **LCOE/LCOH** equations and the electricity/heat cost-allocation fractions,
  plus how a **zero discount rate** is handled.
- **F.** Full input register: every user input — interface label, units, shipped default,
  accepted range/validation rule, and whether it is user-entered, derived or optional.
- **G.** The full weather-response schema, and the **exact PVGIS/contract version strings**.
- **H.** Current **version number and commit hash** to cite.

---

## Part 3 — How to report back

Give me:

1. A table: claim number → MATCH / MISMATCH / NOT FOUND → file:line → note.
2. For every MISMATCH, the corrected wording I should put in the report.
3. Part 2 values, clearly labelled.
4. Anything the code does that the report **doesn't mention but should** — especially
   defaults that silently affect results, or behaviour that would change a reported number.

Prioritise 23–33 (PVT supply), 34–41 (BC-Aus) and 42–50 (dairy) — those carry the
numerical results. Items 1–10 are lower risk.

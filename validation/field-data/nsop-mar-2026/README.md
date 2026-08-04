# NSOP March 2026 - Field Dataset

Real-world monitoring data from an operating PVT (photovoltaic-thermal) collector
array, extracted from a CoolSheet monitoring dashboard and used here as an
**independent field-validation reference** for the CoolSheet PVT calculator.

> **Status: reference dataset, not a validation pass.** Holding this data next to
> the calculator does **not** by itself validate the calculator. See
> [`analysis_report.md`](analysis_report.md) for what can and cannot be compared.

> **Site-name correction:** The author confirmed that this campaign is from
> North Sydney Olympic Pool at Milsons Point. The dashboard copy in this
> archive was updated only to correct its legacy site label. Its numerical
> payload and all extracted CSV values are unchanged. The supplied dashboard's
> SHA-256 was `61b527e0652e4ffe79f564629c64d9c5d71398f7bd04a974f63613ebb397f788`;
> the label-corrected copy is
> `bb8735981b5e189b51a32aadebe21fa75eeccf3ac33568122c5154b0411d356e`.

## Site & system

| Field | Value |
|---|---|
| Site | North Sydney Olympic Pool at Milsons Point (NSOP) |
| Monitoring period | 2026-03-02 to 2026-03-20 (19 days) |
| Commissioning day excluded | 2026-03-01 (not present in the dataset; excluded upstream) |
| Collector / PV area | 534.733164 m² |
| Modules | 207 |
| Sample cadence | 5 minutes (5,472 timestamps) |

## Certified collector (ISO 9806) parameters

These describe the collector model, **not** the measured output.

| Parameter | Value | Meaning |
|---|---|---|
| η₀ | 0.4112 | Zero-loss (optical) thermal efficiency |
| a₁ | 10.358 W/m²K | First-order heat-loss coefficient (certified, 1 m/s wind) |
| a₁ (wind-corrected) | 12.106 W/m²K | Heat-loss coefficient re-derived for the 2 m/s site wind |
| F′ | 0.46 | Collector efficiency factor |
| Site wind | 2 m/s | Wind speed used for the wind correction |

**Wind correction:** an uncovered/unglazed collector loses more heat as wind
increases, so the first-order loss coefficient a₁ rises with wind speed. The
certified a₁ = 10.358 W/m²K is measured at the standard 1 m/s test wind; the
dashboard re-derives a₁ = 12.106 W/m²K for the windier 2 m/s site condition,
which lowers predicted efficiency (see the two η-vs-Tᵢₙ curves in the source
dashboard). Both values are recorded verbatim in `nsop_meta.json`.

## Files in this folder

| File | What it is | Provenance |
|---|---|---|
| `CoolSheet_Dashboard_NSOP_Mar2026_WindCorrected.htm` | Dashboard source with corrected site label | numerical payload preserved |
| `extract_nsop.mjs` | Re-runnable extractor (`node extract_nsop.mjs`) | - |
| `nsop_meta.json` | Site + certified-model metadata | site label corrected; numerical fields verbatim from dashboard `DATA.meta` |
| `nsop_timeseries.csv` | 5-min series: `t, T_in, T_out, T_amb, T1, T2, flow, delta_T, P_kW, P_roll15, eta, eta_roll, G, buf_high, buf_low` | **verbatim** from `DATA.ts` |
| `nsop_daily_energy.csv` | Daily thermal energy `date, E_kWh` (19 rows) | **verbatim** from `DATA.daily` |
| `nsop_scatter.csv` | Operating scatter cloud `G, eta, P_kW, delta_T, T_in` (5,511 rows) | **verbatim** from `DATA.scatter` |
| `analysis_report.md` | Analysis, caveats, and the fair-comparison assessment | derived |
| `NSOP_field_validation_proposal.md` | Proposed "NSOP March 2026 Field Validation" report/page | derived |
| `../../../pages/nsop-field-validation.html` | Field-validation case-study page | derived from the preserved CSV data |

No numerical values in the CSV/JSON files were rounded, rescaled, or recomputed. Nulls in
the source (e.g. efficiency at night when there is no irradiance) are written as
**blank cells**. Re-run `extract_nsop.mjs` to regenerate them from the raw HTML.

## Three data layers - keep them distinct

This matters for an honest thesis comparison:

1. **Raw measured** - sensor readings: `T_in, T_out, T_amb, T1, T2, flow, G`.
2. **Processed dashboard** - quantities the dashboard *computed* from the raw
   readings: `delta_T`, `P_kW` (= flow · cₚ · ΔT), `eta` (= P / (G·A)), the
   rolling averages, `daily.E_kWh`, the scatter cloud, and the headline totals
   in `meta` (e.g. `total_kWh`, `peak_kW`, `median_eta`).
3. **Modelled** - the ISO η-vs-Tᵢₙ curves, stagnation temperatures, and the
   certified η₀/a₁ coefficients. These are **predictions of the collector model**,
   not measurements, and are the objects the CoolSheet calculator's own thermal
   model should be compared against.

## Data-quality flags recorded in the source

- `n_restarts = 220` restart events and `n_transient = 1496` transient samples
  are flagged in `meta`. These are **not steady-state** and should be excluded
  from any steady-state efficiency comparison.
- `has_buffer = false` for this dataset, so all `buf_*` fields are null / empty.

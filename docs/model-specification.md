# Model Specification

## Scope

CoolSheet estimates annual photovoltaic-thermal (PVT) supply and optional industry demand matching for Australian commercial sites. The frontend runs 8,760 hourly timesteps using PVGIS TMY weather, a BC-Aus mains-water temperature model, isotropic plane-of-array irradiance, selectable PVT thermal model A/B, PV temperature correction, and hourly direct-use demand matching.

## Weather And Solar Geometry

- Weather source: PVGIS TMY fetched by `pvt-tmy-api/server.py` through `pvlib.iotools.get_pvgis_tmy`.
- Backend contract 2.1: each hourly record includes `utcTimestamp`, `dayN`, `hourN`, `solarHour`, `dni`, `dhi`, `ghi`, `ta`, `vwind`, `relativeHumidityPct`, and `infraredHorizontalWm2`.
- `utcTimestamp` preserves a unique synthetic TMY UTC instant. `dayN`/`hourN` form a unique 365×24 local-standard-time demand calendar using the location's non-DST UTC offset. Historical 1990 daylight-saving rules are never used for demand scheduling.
- `solarHour` is true solar time and is used for solar geometry.
- PVGIS RH is validated to 0–100% and used only for outdoor aquatic-centre evaporation sensitivity; indoor pools retain a controlled design RH.
- PVGIS `IR(h)` is retained for provenance and export only. It is explicitly prohibited from entering frozen Model B.
- Production calculations fail closed unless `/health` and `/tmy` both report contract 2.1, PVGIS 5.3 and the frozen Model-B long-wave policy. `validation/backend/test_live_contract.py` is the required post-deployment gate across the five CER anchors and major Australian state/territory climates.
- The solar-geometry formula remains the existing Cooper declination/hour-angle implementation.

Reference links:

- [pvlib get_pvgis_tmy](https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.iotools.get_pvgis_tmy.html)
- [PVGIS API](https://re.jrc.ec.europa.eu/api/v5_3/)

## Irradiance Model

The core/default irradiance model is isotropic diffuse transposition:

```text
BHI = DNI * max(0, cos(theta_z))
GHI = BHI + DHI
Beam_POA = DNI * max(0, cos(theta_i))
Diffuse_POA = DHI * (1 + cos(beta)) / 2
Ground_POA = GHI * albedo * (1 - cos(beta)) / 2
POA = max(0, Beam_POA + Diffuse_POA + Ground_POA)
```

Perez is retained only as an external/reference benchmark in validation data. It is not the default scientific model.

## Mains-Water Reference Selection

The BC-Aus mains approximation selects the fitted formula from the geographically closest of four corrected legacy SWH reference locations: Rockhampton (zone 1), Alice Springs (zone 2), Sydney (zone 3), or Melbourne (zone 4). Distance is calculated with the haversine great-circle formula from the geocoded site coordinates. No postcode input is required. Canberra/zone 5 is excluded because its source deck is ASHP-only.

This nearest-reference method is an engineering approximation, not an official CER postcode determination and not AS/NZS 4234:2021 engineering data. The chosen reference and distance are retained in the mains-model result.

## PVT Thermal Model A

Model A is locked as the approved prior-thesis/professor-provided simple linear model:

```text
eta_th = clamp(a0 + a1 * ((Tin - Ta) / G) + a2 * wind, 0, 1)
Q_th = eta_th * G * A
```

No coefficients or equation form were changed in this phase.

## PVT Thermal Model B

Model B is locked as the approved ISO 9806 Eq. 12 implementation with Newton iteration on outlet/mean fluid temperature. The current code preserves:

- absorbed term `eta0 * G`
- first- and second-order heat loss terms `a1 * dT`, `a2 * dT^2`
- wind, long-wave, wind-irradiance, and fourth-order terms where coefficients are non-zero
- Swinbank clear-sky long-wave estimate where long-wave irradiance is not supplied by TMY

No coefficients or equation form were changed in this phase.

## PV Electricity

PV electricity is computed from POA irradiance, collector/PV area, and PV efficiency. The application now keeps the electrical boundary explicit:

```text
gross_DC = eta_STC * POA * area * module_temperature_factor
estimated_net_AC = gross_DC * (1 - non_inverter_system_loss) * inverter_efficiency
```

The editable defaults are 14% non-inverter system losses and 96% inverter efficiency, consistent with the boundary used in NREL PVWatts examples. Temperature loss is modelled separately and is not included again in the 14% input.

The prior PVT cooling-temperature heuristic has not been independently validated against paired field measurements. It is therefore an opt-in sensitivity and is disabled by default. With it disabled, PVT and standalone PV use the same NOCT module temperature, so no cooling electricity gain enters headline energy, economics or industry matching. Gross DC, estimated net AC, system losses, inverter efficiency and cooling-sensitivity state are retained in reports/exports.

- [NREL PVWatts V8 API](https://developer.nrel.gov/docs/solar/pvwatts/v8/)

## Industry Demand

Industry outputs are scenarios with an explicit evidence class and boundary, not certified facility forecasts. Where Australian sources do not substantiate an exact process intensity, the value is labelled as an engineering assumption. Existing industry models include:

- dairy farm: editable process-water rates, preheat target and electricity intensity; the Australian 27–75 kWh/kL audit range is context rather than a universal default
- brewery: editable process-water rates, targets and electricity intensity; literature values are scenarios pending site-meter validation
- hotel: editable occupied-room-night thermal/electrical assumptions; NABERS Hotels v4.3 is whole-building evidence and does not validate the process decomposition; storage-tank usable
  capacity follows the daily mains profile (v13.12)
- aquatic centres: area-based pool heat-loss model; electricity intensity plus evaporation and makeup-water sensitivity multipliers are editable; makeup-water heating uses the daily BC-Aus mains profile

Commercial laundry is now implemented as a hot-water washing model:

```text
Annual kg = kg/day * operating days/week * 52
Q_wash = kg_h * L/kg * hotWaterFraction * cp * max(0, washTemp - Tmains)
Q_rinse = kg_h * L/kg * warmRinseFraction * cp * max(0, rinseTemp - Tmains)
Q_loss = (selected Q_wash + selected Q_rinse) * userLossFraction
```

The commercial-laundry model represents hot-water washing demand only. Drying, ironing, steam finishing, motors, ventilation, and whole-site electricity are not included by default.

Australian public data sources for washing appliances are WELS and Energy Rating. As of July 2026, commercial clothes washing machines are a prioritised WELS Product Expansion category, not an existing regulated WELS category. Direct public commercial-laundry process benchmarks are limited, so water use, hot-water fraction, temperature, and loss fraction are exposed as editable assumptions. The interface provides 10, 12, 15, 17 and 22 L/kg sensitivity cases, including explicit reuse/no-reuse labels; these cases are not regulatory benchmarks.

- [WELS Water Rating](https://www.waterrating.gov.au/)
- [WELS Product Expansion Program 2025–26](https://www.waterrating.gov.au/industry/register/new-product-category-nomination)
- [Energy Rating](https://www.energyrating.gov.au/)
- [NABERS Energy and Water for Hotels Rules v4.3](https://www.nabers.gov.au/publications/nabers-energy-and-water-hotels-rules)

## Economics

Economic calculations use editable tariffs, gas price, boiler efficiency, CAPEX, OPEX, lifetime, and discount rate. Thermal savings convert useful heat to displaced gas fuel as:

```text
gas_fuel_MJ = useful_heat_kWh * 3.6 / boiler_efficiency
thermal_savings_AUD = gas_fuel_MJ * gas_price_AUD_per_MJ
```

Simple payback, NPV, CRF, LCOE, LCOH, and combined LCOE are tested independently.

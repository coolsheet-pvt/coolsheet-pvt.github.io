# Dairy process-water coefficients — literature search

Search for published support for the three dairy water coefficients in the
calculator: fatty-film rinse 0.30, CIP pre-heat 0.57 and boiler feedwater
0.50 L per L of milk (1.37 L/L total, heated to a 35 °C cap).

Compiled 12 August 2026. Each source below is marked **[full text]** where the
document itself was read, or **[secondary]** where the figure comes from a
search result or abstract and the primary was not reachable.

---

## 1. The short answer

No source was found that publishes this three-way split. That is not a gap in
searching — the split does not exist in the literature, because it is a
*processing-plant* framing (pre-rinse / CIP / boiler make-up) applied to a
*farm milking shed*. Farm studies report either litres per cow per day, or
litres per litre of milk, for the shed as a whole.

What can be supported is the **magnitude** and the **35 °C target**. Both have
good sources. See §5 for the one result that should change how the numbers are
described.

---

## 2. Peer-reviewed

**Shortall, J., O'Brien, B., Sleator, R. D., & Upton, J. (2018).** Daily and
seasonal trends of electricity and water use on pasture-based automatic milking
dairy farms. *Journal of Dairy Science*, 101(2), 1565–1578.
doi:[10.3168/jds.2017-13407](https://doi.org/10.3168/jds.2017-13407) **[full
abstract]**

Metered seven seasonal-calving pasture-based farms in Ireland — the closest
published system to an Australian pasture dairy.

- Total water: **3.7 L of water per L of milk**
- Milking shed accounted for **42%** of total farm water (≈1.55 L/L, but this
  includes herd drinking water at the shed, so it is an upper bound on wash
  water)
- Electricity: **62.6 Wh/L = 62.6 kWh/kL** — sits inside the Australian
  27–75 kWh/kL audit range
- Auxiliary water heating: **8% of farm electricity**

**Shine, P., Scully, T., Upton, J., Shalloo, L., & Murphy, M. D.** Electricity
and direct water consumption on Irish pasture-based dairy farms: a statistical
analysis. *Resources, Conservation and Recycling*. **[secondary]**

- Cleaning water: pasture systems **45.2 L/cow/day** (lowest of the three
  system types); confined **84.4 L/cow/day**
- Drinking water: 54.4 L/cow/day (semi-confined) to 87.5 (confined)
- Pre-cooling milk with ground water saved 21% of milk-cooling electricity but
  raised parlour water use 41%

**Shine, P., Upton, J., Sefeedpari, P., & Murphy, M. D. (2020).** A Global
Review of Monitoring, Modeling, and Analyses of Water Demand in Dairy Farming.
*Sustainability*, 12(17), 7201.
doi:[10.3390/su12177201](https://doi.org/10.3390/su12177201) **[not accessible
— MDPI blocked automated access]**

The obvious review to start from: its scope is exactly on-farm water demand,
including "hot washing of milking equipment". Worth retrieving through the UNSW
library.

**Boguniewicz-Zablocka, J., Klosok-Bazan, I., & Naddeo, V. (2017).** Water
quality and resource management in the dairy industry. *Environmental Science
and Pollution Research*, 26(2), 1208–1216.
doi:[10.1007/s11356-017-0608-8](https://doi.org/10.1007/s11356-017-0608-8)
**[full text]**

- Cleaning operations measured at **1.2 and 1.8 m³ per m³ of milk** at two
  dairies (processing plants, not farms)
- Total plant water 3.2–4.6 L/L

**Minogue, D., et al.** Characterisation of dairy soiled water in a survey of 60
Irish dairy farms. **[secondary]**

- **9,784 L/cow/year** of dairy soiled water including rainfall ≈ 26.8
  L/cow/day

---

## 3. Government and industry guidance with concrete volumes

**DAERA Northern Ireland (January 2021).** *Cleaning Systems for Milking
Plants.* **[full text]**

The only source found that gives stage-by-stage volumes and temperatures:

| Stage | Volume | Temperature |
|---|---|---|
| Pre-rinse (removes milk residues) | ~10 L per unit | **~40 °C** (cold also acceptable) |
| Detergent circulation | 10–15 L per unit | **80 °C** |
| Final rinse | 10 L per unit | cold |
| Acidified boiling water (alternative) | ~70 L for a four-point plant | ≥96 °C |

Bucket systems: 30 L per cluster per day.

**Dairy Australia.** *Saving energy on dairy farms.* **[full text, 64 pp]**

- National average **48 kWh/kL of milk** (source given as RMCG National Report,
  2015)
- End-use split: milk cooling **42%**, milk harvesting **21%**, hot water
  **17%**, cleaning and effluent 9%, stock water 4%, shed and lights 4%,
  feed 3%
- Plate coolers run at **2.5–3 L of water per L of milk** (older) or 1.5–2 L/L
  (newer) — this is *cold* water
- "Preheating water to 60–65 °C using solar or heat pump and then boosting it
  to the required temperature with the dairy heater can save more than 40 per
  cent of electricity costs of heating water"
- "For many dairies, the solar system will not produce hot water at a high
  enough temperature for plant wash when required, and the preheated water will
  need to be boosted"

---

## 4. What this supports

**The 35 °C preheat cap — well supported.** DAERA puts the pre-rinse at ~40 °C,
and Dairy Australia describes solar preheating to 60–65 °C followed by boosting
because solar cannot reach plant-wash temperature. Modelling PVT as a preheat
that never delivers the final wash temperature is exactly how the industry
describes it. This is the strongest result of the search.

**Preheating is a recognised measure, with a number attached.** Dairy
Australia's ">40 per cent of electricity costs of heating water" is an
independent Australian figure for the saving the calculator exists to estimate.

**The three-way split — not supported, and unlikely to become so.** Report the
total, not the split.

---

## 5. The result that matters: 1.37 L/L looks about 4× too high

The published Australian numbers can be turned into an implied hot-water volume
and compared with the model.

Hot water is 17% of 48 kWh/kL, so **8.2 kWh per 1,000 L of milk**. Heating
water from a 15 °C mains to 80 °C takes 4.184 × 65 / 3600 = 0.0755 kWh/L, so
that energy corresponds to about **110 L of hot water per 1,000 L of milk —
roughly 0.11 L/L**.

The model instead heats 1.37 L/L through a 20 K rise, which is

    1.37 × 4.184 × 20 / 3600 = 0.032 kWh per L of milk = 32 kWh/kL

against a published hot-water figure of 8.2 kWh/kL. On the shipped 5 ML
default that is **159 MWh/year of modelled thermal demand versus about 41
MWh/year implied by the audit split** — a factor of about 3.9.

Caveats, in fairness:

- The 17% is the *electricity* share. Dairies heating water with LPG or gas
  would have hot-water energy that this split does not capture, so the implied
  volume is a floor rather than a point estimate.
- Boiler feedwater pre-heating (0.50 L/L, 36% of the total) is a processing
  concept. Farm milking sheds generally do not run a boiler, so this term may
  not belong in a farm model at all.
- Plate cooling is genuinely 2–3 L/L, which is larger than the whole 1.37 —
  but it is cold water and is a heat *source*, not a heat demand. It is
  plausible that a plate-cooling figure was at some point mistaken for a
  heating one.

---

## 6. Suggested values

If the coefficients are to be replaced rather than defended:

| Approach | Value | Basis |
|---|---|---|
| Energy-anchored (recommended) | back-calculate from 8.2 kWh/kL | Dairy Australia 17% of 48 kWh/kL; self-consistent with the electricity default |
| Plant-cleaning bottom-up | ~10 L/unit pre-rinse + 10–15 L/unit wash | DAERA 2021; needs units, milkings/day and yield to convert |
| Keep 1.37, restate | describe as *total shed water*, not heated water | Shortall 3.7 L/L total, 42% at shed |

The first is the most defensible: it ties the thermal model to the same
published source as the electricity default, so the two cannot contradict each
other.

---

## 7. Not reachable

Blocked to automated access; worth retrieving manually or through the library:

- Agriculture Victoria, *Dairy Shed Water: How Much Do You Use?* — the most
  directly relevant Australian document, and already cited in the thesis
- Agriculture Victoria, *Measuring water use in the dairy* and *Dairy shed
  water use analysis* pages
- Shine et al. (2020) review, MDPI *Sustainability*
- Journal of Dairy Science full texts (ScienceDirect)

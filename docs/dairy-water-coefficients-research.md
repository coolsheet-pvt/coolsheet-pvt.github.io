# Dairy process-water coefficients — Australian evidence

Search for published Australian support for the three dairy water coefficients
in the calculator: fatty-film rinse 0.30, CIP pre-heat 0.57 and boiler
feedwater 0.50 L per L of milk (1.37 L/L total, heated to a 35 °C cap).

Compiled 12 August 2026. **Australian sources only** — the values below are
derived entirely from Agriculture Victoria and Dairy Australia. Overseas
material is listed in §7 for context and is not used in any calculation.

---

## 1. The short answer

No source publishes this three-way split, and none will: pre-rinse / CIP /
boiler make-up is a *processing-plant* framing applied to a *farm milking
shed*. Australian sources describe the shed as **milking machine cleaning**
and **bulk tank/vat cleaning**, and a farm dairy has no boiler.

Two independent Australian derivations both land near **0.15–0.26 L/L**
against the current 1.37. See §5.

---

## 2. Agriculture Victoria — *Dairy shed water: How much do you use?*

Already cited in the thesis (ref 60). Retrieved and read in full (49 pp).
This is the authoritative Australian document for shed water, and it gives a
method rather than a single coefficient.

**Milking machine cleaning (p.20)**

> "The volume of each rinse and detergent cycle within a wash regime can vary.
> A general rule of thumb is **5–10 litres of water per cluster per cycle per
> wash**. For example, a 32-unit swingover uses about 8 L × 32 units × 3
> cycles per wash × 2 washes per day = 1,536 L/day."

The three cycles are named on p.21 as **rinse, detergent wash, sanitising
rinse** — which is the process sequence the calculator models, from an
Australian source.

**Bulk tank/vat cleaning (p.20, p.22–23)**

> "Older vats require around **1–3% of the vat capacity** for cleaning. Newer
> vats require **1–2%**… Domestic hot water services used to heat water for
> vat washing are generally **250 L, 315 L or 400 L**."

Worked example: 150 L/cycle × 4 cycles × 330 washes/yr = **0.2 ML/yr**.
Re-circulating systems use "about **1.5 times the volume of the hot water
service** for each wash".

## 3. Agriculture Victoria — *Measuring water use in the dairy*

> "**Vat and machine washing** — Requires **comparatively small volumes** of
> the highest quality water, such as rainwater."

The large users are named separately as yard washing, milk cooling and
platform sprays. This matters: the calculator currently assigns the *majority*
of shed water to washing, which is the opposite of what the state agency says.

## 4. Agriculture Victoria — Farm Water Calculator benchmarks

Predicted 75th percentile total dairy shed water (ML/yr):

| Dairy type | 50–100 | 101–200 | 201–300 | 301–400 | 401–500 | 501–600 | 601–700 |
|---|---|---|---|---|---|---|---|
| Swingover | 1.18 | 2.74 | 4.68 | 7.28 | 7.74 | 4.71 | |
| Double-up | 1.73 | 2.82 | 4.84 | 6.49 | 10.95 | | |
| Rotary | | 9.03 | 8.03 | 12.98 | 14.74 | 13.06 | 17.34 |

For a 301–400 cow swingover this is 7.28 ML/yr of **total** shed water, or
about **3.4 L per L of milk** — all uses, mostly cold.

## 5. Two Australian derivations

**(a) Bottom-up, from Agriculture Victoria's own worked example.**
32-unit swingover, 11 cows/unit, 6,000 L/cow/yr → 352 cows, 2.11 ML milk/yr.

| | ML/yr | L per L milk |
|---|---|---|
| Machine cleaning (8 L × 32 × 3 cycles × 680 washes) | 0.52 | 0.247 |
| Vat cleaning (booklet's worked example) | 0.20 | 0.095 |
| **Total cleaning, hot + cold** | **0.72** | **0.342** |

Only some of that is heated — the sanitising rinse is cold, and the vat runs
off a dedicated hot water service:

- detergent cycle + vat heated → **0.18 L/L**
- pre-rinse + detergent + vat heated → **0.26 L/L**

This cleaning total is **10% of the agency's own 7.28 ML/yr shed benchmark**,
which is consistent with "comparatively small volumes".

**(b) Energy-anchored, from Dairy Australia.**
*Saving energy on dairy farms* gives 48 kWh/kL with hot water at **17%**
(source: RMCG National Report 2015), so **8.16 kWh per 1,000 L of milk**.
Heating water from a 15 °C mains to 80 °C costs 0.0755 kWh/L, which
corresponds to about **110 L per 1,000 L of milk = 0.11 L/L**, or ~0.15 L/L
once part of the load is only warmed rather than fully heated.

**The two agree: roughly 0.15 to 0.26 L/L.** The current 1.37 is 5–9× higher.

## 6. Recommended values

| Process | Current | Recommended | Heated to |
|---|---|---|---|
| Fatty-film rinse | 0.30 | **0.05** | 40 °C |
| CIP pre-heat (detergent wash + vat) | 0.57 | **0.10** | 80 °C |
| Boiler feedwater | 0.50 | **remove** | — |
| **Total** | **1.37** | **0.15** | |

0.05 + 0.10 returns 8.3 kWh/kL, within 2% of Dairy Australia's published
hot-water share, so the thermal and electrical sides of the model stop
contradicting each other.

**Consequences before changing anything.** Dairy thermal demand falls from
159 to about 17 MWh/yr on the shipped 5 ML default. More importantly, removing
boiler feedwater removes the only around-the-clock process, so the dairy's
daylight-coincident ceiling rises from 72% toward the brewery's ~94% — the
case study's central finding inverts.

## 7. Overseas material — context only, not used

Retrieved during the search and recorded so the trail is complete. **None of
it is used for any value above.**

- DAERA Northern Ireland (2021), *Cleaning Systems for Milking Plants* —
  per-unit volumes and stage temperatures
- Shortall, O'Brien, Sleator & Upton (2018), *J. Dairy Sci.* 101(2):1565–1578,
  doi:10.3168/jds.2017-13407 — Irish pasture farms, 3.7 L water/L milk
- Shine, Upton, Sefeedpari & Murphy (2020), *Sustainability* 12(17):7201,
  doi:10.3390/su12177201 — global review of dairy water demand
- Boguniewicz-Zablocka, Klosok-Bazan & Naddeo (2017), *Environ. Sci. Pollut.
  Res.* 26(2):1208–1216 — European processing plants

## 8. A note on evidence type

There is no Australian peer-reviewed paper on milking-shed wash-water volumes.
The authoritative Australian sources are the state agency and the industry
body — Agriculture Victoria and Dairy Australia — not journals. For a thesis
that is defensible, provided it is described accurately: government and
industry guidance, not academic literature. The nearest Australian research
body in this space is RACE for 2030, already cited in the calculator's
model-basis panel.

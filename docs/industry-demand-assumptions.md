# Industry demand model evidence record

Last reviewed: 4 August 2026

This record separates published evidence from scenario assumptions used by the calculator. It is an audit trail, not a claim that the default demand models have been validated against metered facilities.

## Brewery

### Australian evidence

| Item | Evidence | Model use |
|---|---|---|
| Whole-site water intensity | The Tooheys Brewery planning assessment reports about 4 L of potable water per L of beer and identifies brewhouse/fermentation, filtration, packaging, boiler and cooling-tower makeup, and CIP as water-using or wastewater-generating processes. | `breweryWholeSiteWater` defaults to 4.0 L/L as a plausibility check. |
| Efficient and high water-use bounds | Green Industries South Australia reports that some breweries use up to 10 L/L and that targeted efficiency can reduce this to less than 4 L/L. It identifies cleaning practice, hot-liquor-tank control, water reuse and closed-loop CIP as major interventions. | The three selected warm-water allocations are compared with the editable whole-site figure. They must not be described as total brewery water use. |
| Renewable heat integration | ARENA's West End Brewery case identifies hot water for brewhouse heating and cleaning, a dedicated bottling CIP load, and boiler displacement as renewable process-heat opportunities. It also states that wort heating above 100 C remains a high-temperature duty. | The 40-45 C values are labelled PVT delivery caps, not final CIP, sanitation, mash or wort temperatures. |
| Seasonal context | The Australian Bureau of Statistics Manufacturing Production Survey included beer production as a national production series. | The monthly factors are retained only as a historical Australian shaping scenario. They are not evidence of one facility's monthly plan. |

### Scenario assumptions that remain unvalidated

- CIP/cleaning preheat: 0.80 L/L beer.
- Packaging rinse preheat: 0.45 L/L beer.
- Boiler makeup preheat: 0.60 L/L beer.
- PVT delivery caps: 45 C for cleaning/boiler makeup and 40 C for packaging rinse.
- Hourly weights for cleaning, packaging, boiler makeup and electricity.
- Electrical intensity: 11.5 kWh/hL.

The calculator now allows either continuous or Mon-Fri operation and renormalises the weights so the entered annual production is preserved. Neither calendar is a universal brewery schedule. A site study should replace it with batch starts, packaging runs, CIP logs, hot-liquor-tank data and interval meters.

## Dairy

### Published Australian evidence

- Agriculture Victoria's *Dairy Shed Water: How Much Do You Use?* documents substantial farm-to-farm variability and recommends measuring each dairy process separately.
- The APVMA states that Australian dairy wash routines normally include pre-rinse, detergent wash, and post-rinse/sanitising stages. It gives about 85 C for hot-water sanitising, while also allowing chemical sanitising.
- Australian dairy energy audits provide a public cross-check for the electrical intensity used by the calculator.

### Legacy project assumptions

The following defaults were inherited from the earlier CoolSheet project material, but no public report, dataset, author, page or measurement record supporting the exact values was located during the 4 August 2026 evidence review:

- Fatty-film rinse: 0.30 L/L milk.
- CIP preheat: 0.57 L/L milk.
- Boiler preheat: 0.50 L/L milk.
- PVT preheat cap: 35 C.
- Hourly process weights.

These values are preserved for reproducibility, not promoted to published Australian coefficients. The 35 C value is a PVT preheat cap and is not the final sanitising temperature. A supervisor-approved source record should be attached if the original project source can be recovered. Otherwise, thesis and interface text must describe these values as legacy scenario assumptions and require site process-water and cleaning records for calibration.

## Primary links

- Green Industries South Australia, *Sustainability Guide*: https://www.greenindustries.sa.gov.au/Sustainability%20Guide.pdf
- Arup, *Tooheys Brewery Waste Water Treatment Plant Preliminary Environmental Assessment*: https://majorprojects.planningportal.nsw.gov.au/prweb/PRRestService/mp/01/getContent?AttachRef=MP06_0303-MOD-3%2120190826T021556.763+GMT
- ARENA, *Renewable Energy for Process Heat Opportunity Study*: https://arena.gov.au/assets/2020/06/renewable-energy-for-process-heat-opportunity-study.pdf
- Australian Bureau of Statistics, *Manufacturing Production Survey*: https://www.abs.gov.au/AUSSTATS/abs%40.nsf/DSSbyCollectionid/87E111C47BE15BB2CA256BD00026FB74
- Agriculture Victoria, *Dairy Shed Water: How Much Do You Use?*: https://agriculture.vic.gov.au/__data/assets/pdf_file/0006/595410/595410-Dairyshedwater_22082022.pdf
- APVMA, *Guidelines for Efficacy Evaluation of On-farm Dairy Cleansers and Sanitisers*: https://www.apvma.gov.au/registrations-and-permits/data-requirements/agricultural-data-guidelines/efficacy-crop-safety-part-8/specific/efficacy-dairy-cleansers-sanitisers

#!/usr/bin/env python3
"""Generate the runtime BC-Aus zone constants from the raw CER deck identities.

The raw ``.inc`` files are the identity authority.  Zone number, weather file,
latitude, revision and all 12 mains-temperature values are parsed directly from
each fixture so a hand-written city registry cannot silently swap two zones.

The source decks are legacy CER/SRES domestic reference inputs (revised 2015),
not AS/NZS 4234:2021 engineering data.  Zones 1-4 are available to both the CER
SWH and ASHP postcode families; zone 5 is ASHP-only.  The PVT calculator uses
only the four-zone SWH family.

Usage from the project root::

    python tools/fit_bc_aus_by_zone.py
    python tools/fit_bc_aus_by_zone.py --check

The output path is canonical and deterministic: ``js/bc_aus_zone_constants.js``.
``--check`` fails when regenerating would change the committed runtime file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path

try:
    import numpy as np
    from scipy.optimize import least_squares
except ImportError as exc:  # pragma: no cover
    raise SystemExit("numpy and scipy are required to regenerate BC-Aus constants") from exc


TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent
CER_FIXTURE_DIR = PROJECT_ROOT / "validation" / "fixtures" / "cer"
NATIONAL_CONSTANTS_PATH = PROJECT_ROOT / "data" / "bc_aus_constants.js"
OUTPUT_PATH = PROJECT_ROOT / "js" / "bc_aus_zone_constants.js"

CER_POSTCODE_SOURCE = (
    "https://cer.gov.au/document/postcode-zones-solar-water-heaters-and-heat-pumps"
)

FIXTURE_NAMES = (
    "zone1_NW_Domestic.inc",
    "zone2_NW_Domestic.inc",
    "zone3_NW_Domestic.inc",
    "zone4_NW_Domestic.inc",
    "ZONEHP5_Au_Domestic.inc",
)

# Monthly ambient means previously derived from the CER weather files named by
# ASSIGN.  They are keyed by that filename rather than a hand-written zone/city
# label, which prevents the former Rockhampton/Alice Springs permutation.
# The original weather files are not distributed in this repository; this
# limitation is emitted into the generated metadata and remains auditable.
AMBIENT_MONTHLY_C_BY_WEATHER = {
    "rockhampton2.tmy": [26.74, 25.48, 25.83, 23.07, 19.73, 16.56, 16.14, 18.02, 19.01, 21.56, 23.79, 25.88],
    "alicesprings2.tmy": [27.91, 26.49, 23.55, 20.61, 16.39, 13.07, 9.65, 13.13, 16.65, 23.95, 24.80, 27.88],
    "sydney2.tmy": [23.11, 22.27, 22.37, 18.98, 14.57, 12.59, 11.31, 13.63, 16.66, 16.79, 19.94, 22.27],
    "melbourne2.tmy": [18.12, 21.89, 17.76, 16.63, 12.81, 10.58, 9.65, 11.63, 12.72, 14.10, 16.12, 17.45],
    "canberra2.tmy": [17.78, 18.91, 14.73, 12.47, 9.05, 5.46, 5.29, 6.95, 8.39, 11.95, 16.22, 17.57],
}

DISPLAY_CITY_BY_WEATHER = {
    "rockhampton2.tmy": "Rockhampton",
    "alicesprings2.tmy": "Alice Springs",
    "sydney2.tmy": "Sydney",
    "melbourne2.tmy": "Melbourne",
    "canberra2.tmy": "Canberra",
}


def parse_cer_fixture(path: Path) -> dict:
    raw = path.read_bytes()
    text = raw.decode("utf-8")

    weather_match = re.search(r"^ASSIGN\s+(\S+)\s+3\s*$", text, re.MULTILINE | re.IGNORECASE)
    zone_match = re.search(r"^zone\s*=\s*(\d+)\s*$", text, re.MULTILINE | re.IGNORECASE)
    lat_match = re.search(r"^LAT\s*=\s*([-+]?\d+(?:\.\d+)?)\s*$", text, re.MULTILINE | re.IGNORECASE)
    revision_match = re.search(r"\*Revised\s+(\d{2}/\d{2}/\d{2})", text, re.IGNORECASE)
    monthly_match = re.search(
        r"UNIT\s+17\s+TYPE\s+14\s*\r?\n"
        r"\*Monthly cold water temperature\s*\r?\n"
        r"PARAMETERS\s+48\s*\r?\n"
        r"((?:[^\r\n]*\r?\n){12})",
        text,
        re.IGNORECASE,
    )
    if not all((weather_match, zone_match, lat_match, revision_match, monthly_match)):
        raise ValueError(f"Could not parse required CER identity fields from {path}")

    monthly = []
    for line in monthly_match.group(1).splitlines():
        values = [float(value) for value in re.findall(r",\s*([-+]?\d+(?:\.\d+)?)", line)]
        if len(values) != 2 or not math.isclose(values[0], values[1], abs_tol=1e-12):
            raise ValueError(f"Malformed monthly mains row in {path.name}: {line!r}")
        monthly.append(values[0])
    if len(monthly) != 12:
        raise ValueError(f"Expected 12 monthly mains values in {path.name}")

    zone_number = int(zone_match.group(1))
    weather_file = weather_match.group(1).lower()
    if weather_file not in AMBIENT_MONTHLY_C_BY_WEATHER:
        raise ValueError(f"No ambient series registered for ASSIGN weather {weather_file}")

    return {
        "key": f"zone{zone_number}",
        "zoneNumber": zone_number,
        "name": f"Zone {zone_number} — {DISPLAY_CITY_BY_WEATHER[weather_file]}",
        "city": DISPLAY_CITY_BY_WEATHER[weather_file],
        "lat": float(lat_match.group(1)),
        "ta": AMBIENT_MONTHLY_C_BY_WEATHER[weather_file],
        "cer": monthly,
        "sourceFixture": path.name,
        "sourceWeather": weather_file,
        "sourceRevision": revision_match.group(1),
        "fixtureSha256": hashlib.sha256(raw).hexdigest(),
        "families": ["ashp"] if zone_number == 5 else ["swh", "ashp"],
    }


def load_zones() -> dict[str, dict]:
    zones = {}
    for name in FIXTURE_NAMES:
        zone = parse_cer_fixture(CER_FIXTURE_DIR / name)
        if zone["key"] in zones:
            raise ValueError(f"Duplicate CER zone {zone['key']}")
        zones[zone["key"]] = zone
    if set(zones) != {f"zone{i}" for i in range(1, 6)}:
        raise ValueError("CER fixtures must resolve to exactly zones 1-5")
    return dict(sorted(zones.items(), key=lambda item: item[1]["zoneNumber"]))


ZONES = load_zones()


def c_to_f(value_c: float) -> float:
    return value_c * 9.0 / 5.0 + 32.0


def f_to_c(value_f: float) -> float:
    return (value_f - 32.0) * 5.0 / 9.0


def mean(values) -> float:
    return sum(values) / len(values)


def load_national_constants(path: Path) -> tuple[float, float, float, float, float]:
    if not path.exists():
        return (0.0, 0.4, 0.01, 35.0, -1.0)
    text = path.read_text(encoding="utf-8")
    values = dict(re.findall(
        r"const\s+(BC_AUS_[A-Z0-9_]+)\s*=\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)",
        text,
    ))
    required = (
        "BC_AUS_OFFSET_F", "BC_AUS_RATIO_C0", "BC_AUS_RATIO_C1",
        "BC_AUS_LAG_C0", "BC_AUS_LAG_C1",
    )
    if not all(key in values for key in required):
        return (0.0, 0.4, 0.01, 35.0, -1.0)
    return tuple(float(values[key]) for key in required)


def compute_bc_monthly(ta_monthly, lat: float, params) -> list[float]:
    offset_f, ratio_c0, ratio_c1, lag_c0, lag_c1 = params
    annual_avg_f = c_to_f(mean(ta_monthly))
    delta_month_f = (max(ta_monthly) - min(ta_monthly)) * 9.0 / 5.0
    ratio = ratio_c0 + ratio_c1 * (annual_avg_f - 44.0)
    lag = lag_c0 + lag_c1 * (annual_avg_f - 44.0)

    month_buckets = [[] for _ in range(12)]
    for day in range(1, 366):
        model_day = day if lat >= 0 else (((day + 182 - 1) % 365) + 1)
        angle_deg = 0.986 * (model_day - 15.0 - lag) - 90.0
        mains_f = (annual_avg_f + offset_f) + ratio * (delta_month_f / 2.0) * math.sin(math.radians(angle_deg))
        month_idx = min(11, math.floor((day - 1) / 30.44))
        month_buckets[month_idx].append(f_to_c(mains_f))
    return [mean(bucket) for bucket in month_buckets]


def residuals_zone(params, zone) -> np.ndarray:
    pred = compute_bc_monthly(zone["ta"], zone["lat"], params)
    return np.asarray([p - target for p, target in zip(pred, zone["cer"])], dtype=float)


def fit_zone(zone, initial_guesses) -> dict:
    best = None
    for guess in initial_guesses:
        result = least_squares(residuals_zone, guess, args=(zone,), method="lm", max_nfev=10000)
        pred = compute_bc_monthly(zone["ta"], zone["lat"], result.x)
        errors = np.asarray(pred) - np.asarray(zone["cer"])
        fit = {
            "params": tuple(float(v) for v in result.x),
            "pred": pred,
            "rmseC": float(np.sqrt(np.mean(errors ** 2))),
            "maeC": float(np.mean(np.abs(errors))),
            "biasC": float(np.mean(errors)),
            "maxAbsC": float(np.max(np.abs(errors))),
            "success": bool(result.success),
        }
        if best is None or fit["rmseC"] < best["rmseC"]:
            best = fit
    if best is None or not best["success"]:
        raise RuntimeError(f"Fit failed for {zone['key']}")
    return best


def render_js(zone_results: dict[str, dict]) -> str:
    all_sq_errors = []
    for key, result in zone_results.items():
        zone = ZONES[key]
        all_sq_errors.extend((p - target) ** 2 for p, target in zip(result["pred"], zone["cer"]))
    overall_rmse = math.sqrt(sum(all_sq_errors) / len(all_sq_errors))

    lines = [
        "// Auto-generated by tools/fit_bc_aus_by_zone.py - DO NOT EDIT BY HAND.",
        "// Run `python tools/fit_bc_aus_by_zone.py --check` to verify determinism.",
        "//",
        "// Identity authority: raw CER DomDecks .inc ASSIGN/zone/LAT/UNIT 17 fields.",
        "// Scope: legacy CER/SRES domestic reference; not AS/NZS 4234:2021 data.",
        f"// Overall in-sample RMSE across all 5 legacy deck zones: {overall_rmse:.6f} degC",
        "const BC_AUS_ZONE_CONSTANTS = {",
    ]

    for key, result in zone_results.items():
        zone = ZONES[key]
        offset_f, ratio_c0, ratio_c1, lag_c0, lag_c1 = result["params"]
        lines.extend([
            f"  {key}: {{",
            f"    zoneNumber: {zone['zoneNumber']},",
            f"    name: {json.dumps(zone['name'], ensure_ascii=False)},",
            f"    city: {json.dumps(zone['city'])},",
            f"    families: {json.dumps(zone['families'])},",
            f"    sourceFixture: {json.dumps(zone['sourceFixture'])},",
            f"    sourceWeather: {json.dumps(zone['sourceWeather'])},",
            f"    sourceLatitude: {zone['lat']:.6f},",
            f"    sourceRevision: {json.dumps(zone['sourceRevision'])},",
            f"    fixtureSha256: {json.dumps(zone['fixtureSha256'])},",
            f"    referenceMonthlyC: {json.dumps(zone['cer'])},",
            f"    offsetF: {offset_f:.8f},",
            f"    ratioC0: {ratio_c0:.8f},",
            f"    ratioC1: {ratio_c1:.8f},",
            f"    lagC0: {lag_c0:.8f},",
            f"    lagC1: {lag_c1:.8f},",
            f"    maeC: {result['maeC']:.6f},",
            f"    rmseC: {result['rmseC']:.6f},",
            f"    biasC: {result['biasC']:.6f},",
            f"    maxAbsC: {result['maxAbsC']:.6f},",
            "  },",
        ])

    lines.extend([
        "};",
        "",
        f"const BC_AUS_ZONE_OVERALL_RMSE_C = {overall_rmse:.6f};",
        "const BC_AUS_ZONE_SOURCE = Object.freeze({",
        "  authority: \"raw CER DomDecks fixture identity\",",
        "  scope: \"legacy CER/SRES domestic reference\",",
        "  deckRevision: \"20/07/15\",",
        f"  postcodeSource: {json.dumps(CER_POSTCODE_SOURCE)},",
        "  runtimeFamily: \"swh\",",
        "  ambientDataLimitation: \"monthly means retained by ASSIGN weather filename; original CER TMY files are not distributed in this repository\",",
        "});",
        "",
    ])
    return "\n".join(lines)


def build_results() -> dict[str, dict]:
    national_guess = load_national_constants(NATIONAL_CONSTANTS_PATH)
    guesses = [national_guess, (0.0, 0.4, 0.01, 35.0, -1.0), (6.0, 0.4, 0.01, 35.0, -1.0)]
    return {key: fit_zone(zone, guesses) for key, zone in ZONES.items()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if regeneration differs from runtime file")
    args = parser.parse_args()

    results = build_results()
    rendered = render_js(results)
    if args.check:
        current = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else None
        if current != rendered:
            raise SystemExit(f"{OUTPUT_PATH.relative_to(PROJECT_ROOT)} is stale; regenerate it")
        print(f"OK: {OUTPUT_PATH.relative_to(PROJECT_ROOT)} is byte-identical to regeneration")
        return

    OUTPUT_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)}")
    for key, result in results.items():
        zone = ZONES[key]
        print(f"{key}: {zone['sourceWeather']} -> {zone['city']}; RMSE {result['rmseC']:.3f} C")


if __name__ == "__main__":
    main()

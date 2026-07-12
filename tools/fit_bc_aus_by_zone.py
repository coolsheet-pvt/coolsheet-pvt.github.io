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

The output path is canonical: ``js/bc_aus_zone_constants.js``. ``--check``
requires exact metadata/structure and numerical equivalence within 0.000002,
which permits only the final displayed-digit variation seen between libm
implementations on Windows and Linux.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import math
import re
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent
CER_FIXTURE_DIR = PROJECT_ROOT / "validation" / "fixtures" / "cer"
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
    canonical_fixture_bytes = text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")

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
        "fixtureSha256": hashlib.sha256(canonical_fixture_bytes).hexdigest(),
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


def format_fixed(value: float, places: int) -> str:
    """Format generated values without platform-dependent negative zero."""
    if abs(value) < 0.5 * (10.0 ** -places):
        value = 0.0
    return f"{value:.{places}f}"


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


def solve_3x3(matrix: list[list[float]], vector: list[float]) -> tuple[float, float, float]:
    """Solve a small full-rank system with deterministic partial pivoting."""
    augmented = [list(row) + [rhs] for row, rhs in zip(matrix, vector)]
    for column in range(3):
        pivot = max(range(column, 3), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-14:
            raise RuntimeError("BC-Aus canonical fit is singular")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        pivot_value = augmented[column][column]
        augmented[column] = [value / pivot_value for value in augmented[column]]
        for row in range(3):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [
                value - factor * pivot_entry
                for value, pivot_entry in zip(augmented[row], augmented[column])
            ]
    return tuple(row[3] for row in augmented)


def fit_zone(zone) -> dict:
    """Fit the three identifiable per-zone BC-Aus terms deterministically.

    For one fixed ambient series, ``ratioC0``/``ratioC1`` collapse to one
    effective amplitude and ``lagC0``/``lagC1`` collapse to one effective lag.
    Fitting all five terms is therefore rank-deficient and produced different
    but model-equivalent constants on Windows and Linux.  Expanding the sine
    into sine/cosine coefficients makes this an ordinary three-term linear fit.
    """
    month_components = [[] for _ in range(12)]
    for day in range(1, 366):
        model_day = day if zone["lat"] >= 0 else (((day + 182 - 1) % 365) + 1)
        base_angle = math.radians(0.986 * (model_day - 15.0) - 90.0)
        month_idx = min(11, math.floor((day - 1) / 30.44))
        month_components[month_idx].append((math.sin(base_angle), math.cos(base_angle)))

    rows = [
        (
            1.0,
            math.fsum(value[0] for value in values) / len(values),
            math.fsum(value[1] for value in values) / len(values),
        )
        for values in month_components
    ]
    annual_avg_f = c_to_f(mean(zone["ta"]))
    targets = [c_to_f(target) - annual_avg_f for target in zone["cer"]]
    normal_matrix = [
        [math.fsum(row[i] * row[j] for row in rows) for j in range(3)]
        for i in range(3)
    ]
    normal_vector = [
        math.fsum(row[i] * target for row, target in zip(rows, targets))
        for i in range(3)
    ]
    offset_f, sine_coefficient, cosine_coefficient = solve_3x3(normal_matrix, normal_vector)

    delta_month_f = (max(zone["ta"]) - min(zone["ta"])) * 9.0 / 5.0
    if delta_month_f <= 0:
        raise RuntimeError(f"Ambient monthly range is zero for {zone['key']}")
    effective_ratio = 2.0 * math.hypot(sine_coefficient, cosine_coefficient) / delta_month_f
    effective_lag = math.degrees(math.atan2(-cosine_coefficient, sine_coefficient)) / 0.986
    # The browser consumes eight-decimal constants.  Calculate validation
    # metrics from those exact shipped values rather than hidden extra digits.
    params = (round(offset_f, 8), round(effective_ratio, 8), 0.0, round(effective_lag, 8), 0.0)
    pred = compute_bc_monthly(zone["ta"], zone["lat"], params)
    errors = [value - target for value, target in zip(pred, zone["cer"])]
    return {
        "params": params,
        "pred": pred,
        "rmseC": math.sqrt(math.fsum(error ** 2 for error in errors) / len(errors)),
        "maeC": math.fsum(abs(error) for error in errors) / len(errors),
        "biasC": math.fsum(errors) / len(errors),
        "maxAbsC": max(abs(error) for error in errors),
    }


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
        "// Fixture SHA-256: UTF-8 text after canonical LF newline normalization.",
        "// Scope: legacy CER/SRES domestic reference; not AS/NZS 4234:2021 data.",
        f"// Overall in-sample RMSE across all 5 legacy deck zones: {format_fixed(overall_rmse, 6)} degC",
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
            f"    offsetF: {format_fixed(offset_f, 8)},",
            f"    ratioC0: {format_fixed(ratio_c0, 8)},",
            f"    ratioC1: {format_fixed(ratio_c1, 8)},",
            f"    lagC0: {format_fixed(lag_c0, 8)},",
            f"    lagC1: {format_fixed(lag_c1, 8)},",
            f"    maeC: {format_fixed(result['maeC'], 6)},",
            f"    rmseC: {format_fixed(result['rmseC'], 6)},",
            f"    biasC: {format_fixed(result['biasC'], 6)},",
            f"    maxAbsC: {format_fixed(result['maxAbsC'], 6)},",
            "  },",
        ])

    lines.extend([
        "};",
        "",
        f"const BC_AUS_ZONE_OVERALL_RMSE_C = {format_fixed(overall_rmse, 6)};",
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


NUMERIC_RUNTIME_LINE_PATTERNS = (
    re.compile(
        r"^(\s*(?:offsetF|ratioC0|ratioC1|lagC0|lagC1|maeC|rmseC|biasC|maxAbsC):\s*)"
        r"([-+]?\d+(?:\.\d+)?)(,\s*)$"
    ),
    re.compile(
        r"^(// Overall in-sample RMSE across all 5 legacy deck zones:\s*)"
        r"([-+]?\d+(?:\.\d+)?)(\s+degC)$"
    ),
    re.compile(
        r"^(const BC_AUS_ZONE_OVERALL_RMSE_C\s*=\s*)"
        r"([-+]?\d+(?:\.\d+)?)(;\s*)$"
    ),
)


def runtime_is_semantically_current(current: str, rendered: str, tolerance: float = 0.000002) -> bool:
    """Require exact provenance text and physically immaterial numeric drift only."""
    current_lines = current.splitlines()
    rendered_lines = rendered.splitlines()
    if len(current_lines) != len(rendered_lines):
        return False
    for current_line, rendered_line in zip(current_lines, rendered_lines):
        if current_line == rendered_line:
            continue
        equivalent = False
        for pattern in NUMERIC_RUNTIME_LINE_PATTERNS:
            current_match = pattern.fullmatch(current_line)
            rendered_match = pattern.fullmatch(rendered_line)
            if not current_match or not rendered_match:
                continue
            same_surrounding_text = (
                current_match.group(1) == rendered_match.group(1)
                and current_match.group(3) == rendered_match.group(3)
            )
            equivalent = same_surrounding_text and math.isclose(
                float(current_match.group(2)),
                float(rendered_match.group(2)),
                rel_tol=0.0,
                abs_tol=tolerance,
            )
            break
        if not equivalent:
            return False
    return True


def build_results() -> dict[str, dict]:
    return {key: fit_zone(zone) for key, zone in ZONES.items()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if regeneration differs from runtime file")
    args = parser.parse_args()

    results = build_results()
    rendered = render_js(results)
    if args.check:
        current = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else None
        if current is None or not runtime_is_semantically_current(current, rendered):
            diff = "" if current is None else "".join(difflib.unified_diff(
                current.splitlines(keepends=True),
                rendered.splitlines(keepends=True),
                fromfile=str(OUTPUT_PATH.relative_to(PROJECT_ROOT)),
                tofile="regenerated",
            ))
            raise SystemExit(
                f"{OUTPUT_PATH.relative_to(PROJECT_ROOT)} is stale; regenerate it"
                + (f"\n{diff}" if diff else "")
            )
        print(
            f"OK: {OUTPUT_PATH.relative_to(PROJECT_ROOT)} metadata is exact and generated values "
            "match within 0.000002"
        )
        return

    OUTPUT_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)}")
    for key, result in results.items():
        zone = ZONES[key]
        print(f"{key}: {zone['sourceWeather']} -> {zone['city']}; RMSE {result['rmseC']:.3f} C")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Strict post-deployment gate for the hosted TMY service (network required)."""
from __future__ import annotations

import hashlib
import json
import math
import os
import urllib.parse
import urllib.request

BASE = os.getenv("TMY_API_BASE", "https://coolsheet-pvt-tmy-api.onrender.com").rstrip("/")
CONTRACT = "2.1"
SITES = {
    "rockhampton-zone1": (-23.379, 150.510), "alice-springs-zone2": (-23.698, 133.881),
    "sydney-zone3": (-33.869, 151.209), "melbourne-zone4": (-37.814, 144.963),
    "canberra-ashp5": (-35.281, 149.130), "brisbane": (-27.470, 153.025),
    "adelaide": (-34.929, 138.601), "perth": (-31.951, 115.861),
    "hobart": (-42.882, 147.327), "darwin": (-12.463, 130.846),
}
REQUIRED = {"dayN", "hourN", "solarHour", "utcTimestamp", "dni", "dhi", "ghi", "ta", "vwind",
            "relativeHumidityPct", "infraredHorizontalWm2"}


def get_json(path: str, timeout: int = 180):
    request = urllib.request.Request(BASE + path, headers={"Accept": "application/json", "User-Agent": "CoolSheet-release-gate/2.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


health = get_json("/health", 90)
assert health.get("status") == "ready", health
assert health.get("apiContractVersion") == CONTRACT, health
assert health.get("modelBLongwavePolicy") == "frozen-prohibited", health
assert REQUIRED <= set(health.get("requiredRecordFields", [])), health

for name, (lat, lon) in SITES.items():
    data = get_json("/tmy?" + urllib.parse.urlencode({"lat": lat, "lon": lon}))
    provenance = data.get("provenance", {})
    records = data.get("records", [])
    assert provenance.get("apiContractVersion") == CONTRACT, name
    assert provenance.get("pvgisApiVersion") == "5.3", name
    assert provenance.get("request", {}).get("startyear") == 2005, name
    assert provenance.get("request", {}).get("endyear") == 2023, name
    assert provenance.get("request", {}).get("usehorizon") is True, name
    assert len(records) == 8760, (name, len(records))
    assert all(REQUIRED <= set(row) for row in records), name
    assert len({(row["dayN"], row["hourN"]) for row in records}) == 8760, name
    assert len({row["utcTimestamp"] for row in records}) == 8760, name
    assert all(0 <= row["relativeHumidityPct"] <= 100 for row in records), name
    assert all(math.isfinite(row["infraredHorizontalWm2"]) for row in records), name
    canonical = json.dumps(records, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    assert hashlib.sha256(canonical).hexdigest() == provenance.get("datasetSha256"), name
    print(f"PASS {name}: {provenance['datasetSha256'][:12]}…")

print(f"Hosted weather contract {CONTRACT} passed at {len(SITES)} Australian sites.")

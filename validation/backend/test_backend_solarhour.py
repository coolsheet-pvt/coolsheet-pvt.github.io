#!/usr/bin/env python3
"""Offline backend tests for the TMY solarHour contract.

These tests mock pvlib's PVGIS call, so they do not need network access.
They verify the local FastAPI backend emits solarHour consistently with
local API expectations before deployment to Render or another host.
"""

from __future__ import annotations

import sys
import unittest
import asyncio
import inspect
from pathlib import Path
from unittest import mock

import pandas as pd
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "pvt-tmy-api"
sys.path.insert(0, str(API_DIR))

import server  # noqa: E402


class FakeTimezoneFinder:
    def timezone_at(self, lng: float, lat: float) -> str:
        return "Australia/Sydney"


def fake_pvgis_tmy(_lat: float, _lon: float, **kwargs):
    idx = pd.date_range("2022-01-01 00:00", periods=48, freq="h", tz="UTC")
    df = pd.DataFrame(
        {
            "dni": [0.0] * 6 + [700.0] * 8 + [0.0] * 34,
            "dhi": [0.0] * 6 + [120.0] * 8 + [0.0] * 34,
            "ghi": [0.0] * 6 + [620.0] * 8 + [0.0] * 34,
            "t2m": [20.0 + (i % 24) * 0.1 for i in range(48)],
            "ws10m": [3.0] * 48,
            "relative_humidity": [55.0] * 48,
            # PVGIS net infrared can be negative at night; retain its sign.
            "IR(h)": [320.0] * 11 + [-10.0] + [320.0] * 36,
        },
        index=idx,
    )
    return df, {"source": "mock-pvgis", "inputs": {"meteo_data": {"radiation_db": "PVGIS-ERA5"}}, "months_selected": []}


class BackendSolarHourTests(unittest.TestCase):
    def setUp(self):
        server._TMY_CACHE.clear()

    def test_tmy_records_include_solar_hour(self):
        with mock.patch.object(server.pvlib.iotools, "get_pvgis_tmy", side_effect=fake_pvgis_tmy):
            with mock.patch.object(server, "_tf", FakeTimezoneFinder()):
                result = server.tmy(-33.869844, 151.208285)

        records = result["records"]
        self.assertEqual(len(records), 48)
        self.assertEqual(result["tz"], "Australia/Sydney")
        self.assertTrue(all("solarHour" in rec for rec in records))
        self.assertTrue(all(isinstance(rec["solarHour"], float) for rec in records))
        self.assertTrue(all(0.0 <= rec["solarHour"] < 24.0 for rec in records))
        self.assertEqual(result["provenance"]["apiContractVersion"], "2.1")
        self.assertEqual(len(result["provenance"]["datasetSha256"]), 64)
        self.assertTrue(all(rec["relativeHumidityPct"] == 55.0 for rec in records))
        self.assertEqual(records[11]["infraredHorizontalWm2"], -10.0)
        self.assertEqual(records[12]["infraredHorizontalWm2"], 320.0)
        self.assertEqual(result["provenance"]["weatherFields"]["infraredHorizontalWm2"].split(";")[-1].strip(),
                         "prohibited from frozen Model B")

    def test_rotation_keeps_solar_hour_and_timestamp_hour(self):
        with mock.patch.object(server.pvlib.iotools, "get_pvgis_tmy", side_effect=fake_pvgis_tmy):
            with mock.patch.object(server, "_tf", FakeTimezoneFinder()):
                result = server.tmy(-33.869844, 151.208285, rotate_last_n_day1=3)

        records = result["records"]
        self.assertEqual(len(records), 48)
        self.assertTrue(all("solarHour" in rec for rec in records))
        self.assertTrue(all(1 <= rec["hourN"] <= 24 for rec in records))
        self.assertTrue(all(0.0 <= rec["solarHour"] < 24.0 for rec in records))

    def test_synthetic_standard_clock_is_unique_for_all_australian_zones(self):
        for zone_name in (
            "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane",
            "Australia/Adelaide", "Australia/Darwin", "Australia/Perth", "Australia/Hobart",
        ):
            offset = server._standard_utc_offset_hours(ZoneInfo(zone_name))
            clocks = [server._synthetic_demand_clock(i, offset) for i in range(8760)]
            keys = {(day, hour) for day, hour, _utc in clocks}
            utc_values = {_utc for _day, _hour, _utc in clocks}
            self.assertEqual(len(keys), 8760, zone_name)
            self.assertEqual(len(utc_values), 8760, zone_name)
            self.assertTrue(all(1 <= day <= 365 and 1 <= hour <= 24 for day, hour in keys), zone_name)

    def test_standard_offset_ignores_dst(self):
        self.assertEqual(server._standard_utc_offset_hours(ZoneInfo("Australia/Sydney")), 10.0)
        self.assertEqual(server._standard_utc_offset_hours(ZoneInfo("Australia/Adelaide")), 9.5)
        self.assertEqual(server._standard_utc_offset_hours(ZoneInfo("Australia/Brisbane")), 10.0)

    def test_health_is_a_strict_release_gate(self):
        health = asyncio.run(server.health_check())
        self.assertEqual(health["status"], "ready")
        self.assertEqual(health["apiContractVersion"], "2.1")
        self.assertEqual(health["modelBLongwavePolicy"], "frozen-prohibited")
        self.assertIn("relativeHumidityPct", health["requiredRecordFields"])
        self.assertIn("infraredHorizontalWm2", health["requiredRecordFields"])

    def test_blocking_tmy_routes_use_fastapi_thread_pool(self):
        self.assertFalse(inspect.iscoroutinefunction(server.get_tmy))
        self.assertFalse(inspect.iscoroutinefunction(server.post_tmy))
        self.assertFalse(inspect.iscoroutinefunction(server.email_report))
        self.assertTrue(inspect.iscoroutinefunction(server.health_check))


if __name__ == "__main__":
    unittest.main(verbosity=2)

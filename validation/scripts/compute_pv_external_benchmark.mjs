import fs from "node:fs";

const CITIES = ["sydney", "melbourne", "brisbane", "perth", "adelaide"];
const AREA_M2 = 20;
const ETA_STC = 0.20;
const TEMP_COEFF_PER_C = -0.004;
const NOCT_C = 45;
const SYSTEM_LOSS = 0.14;
const INVERTER_EFFICIENCY = 0.96;

class TiltedSurfaceRadiation {
  constructor(latitude, longitude, tiltAngle, surfaceAzimuth, albedo = 0.2) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.tiltAngle = tiltAngle;
    this.surfaceAzimuth = surfaceAzimuth;
    this.albedo = albedo;
  }
  toRadians(degrees) { return degrees * Math.PI / 180; }
  toDegrees(radians) { return radians * 180 / Math.PI; }
  declinationAngle(dayN) { return 23.45 * Math.sin(this.toRadians((360 / 365) * (dayN + 284))); }
  hourAngle(hourN) { return 15 * (hourN - 12); }
  zenithAngle(dayN, hourN) {
    const declination = this.toRadians(this.declinationAngle(dayN));
    const hour = this.toRadians(this.hourAngle(hourN));
    const latitude = this.toRadians(this.latitude);
    const cosine = Math.sin(declination) * Math.sin(latitude)
      + Math.cos(declination) * Math.cos(latitude) * Math.cos(hour);
    return this.toDegrees(Math.acos(Math.min(1, Math.max(-1, cosine))));
  }
  incidenceAngle(dayN, hourN) {
    const declination = this.toRadians(this.declinationAngle(dayN));
    const hour = this.toRadians(this.hourAngle(hourN));
    const latitude = this.toRadians(this.latitude);
    const slope = this.toRadians(this.tiltAngle);
    const azimuth = this.toRadians(this.surfaceAzimuth - 180);
    const cosine = Math.sin(declination) * Math.sin(latitude) * Math.cos(slope)
      - Math.sin(declination) * Math.cos(latitude) * Math.sin(slope) * Math.cos(azimuth)
      + Math.cos(declination) * Math.cos(latitude) * Math.cos(slope) * Math.cos(hour)
      + Math.cos(declination) * Math.sin(latitude) * Math.sin(slope) * Math.cos(azimuth) * Math.cos(hour)
      + Math.cos(declination) * Math.sin(slope) * Math.sin(azimuth) * Math.sin(hour);
    return this.toDegrees(Math.acos(Math.min(1, Math.max(-1, cosine))));
  }
  calculate(dayN, hourN, dni, dhi) {
    const zenith = this.zenithAngle(dayN, hourN);
    const cosineZenith = Math.cos(this.toRadians(zenith));
    const directNormal = Math.max(0, dni || 0);
    const diffuseHorizontal = Math.max(0, dhi || 0);
    const beamHorizontal = cosineZenith > 1e-6 ? directNormal * Math.max(0, cosineZenith) : 0;
    const ghi = beamHorizontal + diffuseHorizontal;
    const incidence = this.incidenceAngle(dayN, hourN);
    const beam = cosineZenith > 1e-6 ? directNormal * Math.max(0, Math.cos(this.toRadians(incidence))) : 0;
    const slopeRadians = this.toRadians(this.tiltAngle);
    const diffuse = diffuseHorizontal * ((1 + Math.cos(slopeRadians)) / 2);
    const ground = ghi * this.albedo * ((1 - Math.cos(slopeRadians)) / 2);
    return Math.max(0, beam + diffuse + ground);
  }
}

const monthFromDayN = dayN => {
  const monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];
  let remaining = dayN;
  for (let month = 0; month < monthDays.length; month += 1) {
    if (remaining <= monthDays[month]) return month;
    remaining -= monthDays[month];
  }
  return 11;
};

export function computeCoolSheetPvOnly(city) {
  const backendPath = `validation/fixtures/backend/backend_${city}.json`;
  const weatherPath = `validation/fixtures/weather/${city}.json`;
  const fixturePath = fs.existsSync(backendPath) ? backendPath : weatherPath;
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const radiation = new TiltedSurfaceRadiation(fixture.lat, fixture.lon, 30, 0, 0.2);
  const monthlyDc = Array(12).fill(0);
  const monthlyAc = Array(12).fill(0);
  let annualPoaKWhM2 = 0;

  for (const row of fixture.records) {
    let clockHour = Number(row.hourN);
    if (clockHour >= 1 && clockHour <= 24) clockHour -= 1;
    const solarHour = Number.isFinite(Number(row.solarHour)) ? Number(row.solarHour) : clockHour;
    const poaWm2 = radiation.calculate(Number(row.dayN), solarHour, Number(row.dni), Number(row.dhi));
    const panelTemperatureC = Number(row.ta) + (poaWm2 / 800) * (NOCT_C - 20);
    const temperatureFactor = Math.max(0, 1 + TEMP_COEFF_PER_C * (panelTemperatureC - 25));
    const dcKWh = ETA_STC * poaWm2 * AREA_M2 / 1000 * temperatureFactor;
    const acKWh = dcKWh * (1 - SYSTEM_LOSS) * INVERTER_EFFICIENCY;
    const month = monthFromDayN(Number(row.dayN));
    annualPoaKWhM2 += poaWm2 / 1000;
    monthlyDc[month] += dcKWh;
    monthlyAc[month] += acKWh;
  }

  return {
    city: city[0].toUpperCase() + city.slice(1),
    latitude: fixture.lat,
    longitude: fixture.lon,
    annual_poa_kwh_m2: annualPoaKWhM2,
    annual_dc_kwh: monthlyDc.reduce((sum, value) => sum + value, 0),
    annual_ac_kwh: monthlyAc.reduce((sum, value) => sum + value, 0),
    monthly_ac_kwh: monthlyAc
  };
}

if (process.argv[1] && process.argv[1].endsWith("compute_pv_external_benchmark.mjs")) {
  console.log(JSON.stringify(CITIES.map(computeCoolSheetPvOnly), null, 2));
}

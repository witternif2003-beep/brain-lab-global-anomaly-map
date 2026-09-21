// lib/sources/expanded-p1-sources.ts
// 15+ Free/Keyless Real-World Telemetry Ingestion Endpoints

export async function fetchUSGS(minLat = 30.0, minLon = -85.0, maxLat = 35.0, maxLon = -80.0) {
  try {
    const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
    url.searchParams.set('format', 'geojson');
    url.searchParams.set('minmagnitude', '1.0');
    url.searchParams.set('minlatitude', minLat.toString());
    url.searchParams.set('maxlatitude', maxLat.toString());
    url.searchParams.set('minlongitude', minLon.toString());
    url.searchParams.set('maxlongitude', maxLon.toString());
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchOpenMeteo(lat = 32.08, lon = -81.09) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchSECEdgar(cik = "0000092222") {
  try {
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, '0')}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BrainLab/1.0 (contact@brainlab.dev)' },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchWorldBank(countryCode = "USA", indicator = "NY.GDP.MKTP.CD") {
  try {
    const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchOpenAlex(query = "macroeconomic anomaly detection") {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

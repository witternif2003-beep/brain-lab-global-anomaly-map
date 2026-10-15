/** NOAA SWPC + NASA CCMC DONKI space-weather normalizers (pure; no network). */

export interface OvationGrid {
  'Observation Time'?: string;
  'Forecast Time'?: string;
  coordinates?: [number, number, number][];
}

export const AURORA_MIN_PROBABILITY = 3;

/** OVATION aurora grid (lon 0–359, lat −90–90, probability %) → GeoJSON points at or above `min`. */
export function auroraGeojson(grid: OvationGrid, min = AURORA_MIN_PROBABILITY): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const c of grid.coordinates ?? []) {
    if (!Array.isArray(c) || c.length < 3) continue;
    const [lon, lat, p] = c;
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(p) || p < min) continue;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon > 180 ? lon - 360 : lon, lat] }, properties: { p } });
  }
  return { type: 'FeatureCollection', features };
}

export interface KpRow { time_tag: string; Kp: number }

export function latestKp(rows: unknown): { kp: number; time: string } | null {
  if (!Array.isArray(rows)) return null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i] as Partial<KpRow> | null;
    if (r && typeof r.time_tag === 'string' && Number.isFinite(Number(r.Kp))) return { kp: Number(r.Kp), time: `${r.time_tag}Z` };
  }
  return null;
}

type Scale = { Scale?: string | null; Text?: string | null };
export interface NoaaScales { R: string; S: string; G: string; time: string | null }

export function currentScales(body: unknown): NoaaScales | null {
  const now = (body as Record<string, { DateStamp?: string; TimeStamp?: string; R?: Scale; S?: Scale; G?: Scale }> | null)?.['0'];
  if (!now) return null;
  const s = (x?: Scale) => (x?.Scale == null ? '0' : String(x.Scale));
  return { R: `R${s(now.R)}`, S: `S${s(now.S)}`, G: `G${s(now.G)}`, time: now.DateStamp && now.TimeStamp ? `${now.DateStamp}T${now.TimeStamp}Z` : null };
}

export interface SolarWind { speedKmS: number | null; densityCm3: number | null; btNt: number | null; bzNt: number | null; time: string | null; source: string | null }

const firstActive = (rows: unknown): Record<string, unknown> | null => {
  if (!Array.isArray(rows)) return null;
  return (rows.find((r) => r && (r as { active?: boolean }).active) ?? rows[0] ?? null) as Record<string, unknown> | null;
};
const n = (v: unknown) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

export function solarWind(wind: unknown, mag: unknown): SolarWind {
  const w = firstActive(wind);
  const m = firstActive(mag);
  const t = (w?.time_tag ?? m?.time_tag) as string | undefined;
  return {
    speedKmS: n(w?.proton_speed),
    densityCm3: n(w?.proton_density),
    btNt: n(m?.bt),
    bzNt: n(m?.bz_gsm),
    time: t ? `${t}Z` : null,
    source: [w?.source, m?.source].filter(Boolean).join(' / ') || null,
  };
}

const FLARE_RANK: Record<string, number> = { A: 0, B: 1, C: 2, M: 3, X: 4 };
/** Orders GOES flare classes (e.g. "M6.7" > "M2.0" > "C9.9"). */
export function flareMagnitude(cls: string | null | undefined): number {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/.exec(String(cls ?? '').trim().toUpperCase());
  return m ? FLARE_RANK[m[1]] * 100 + Number(m[2]) : -1;
}

export interface DonkiFlare { flrID?: string; classType?: string; peakTime?: string; beginTime?: string; sourceLocation?: string; activeRegionNum?: number | null; link?: string }
export interface DonkiCme { activityID?: string; startTime?: string; link?: string; cmeAnalyses?: { isMostAccurate?: boolean; speed?: number | null }[] | null }
export interface DonkiStorm { gstID?: string; startTime?: string; link?: string; allKpIndex?: { kpIndex?: number }[] | null }

export function summarizeDonki(flares: DonkiFlare[], cmes: DonkiCme[], storms: DonkiStorm[]) {
  const strongest = [...flares].sort((a, b) => flareMagnitude(b.classType) - flareMagnitude(a.classType))[0] ?? null;
  const fastest = cmes
    .map((c) => ({ c, speed: Math.max(-1, ...(c.cmeAnalyses ?? []).map((a) => n(a.speed) ?? -1)) }))
    .filter((x) => x.speed > 0)
    .sort((a, b) => b.speed - a.speed)[0] ?? null;
  const stormKp = storms.map((s) => ({ s, kp: Math.max(-1, ...(s.allKpIndex ?? []).map((k) => n(k.kpIndex) ?? -1)) })).sort((a, b) => b.kp - a.kp)[0] ?? null;
  return {
    flares: flares.length,
    cmes: cmes.length,
    storms: storms.length,
    strongestFlare: strongest ? { class: strongest.classType ?? null, peak: strongest.peakTime ?? null, region: strongest.activeRegionNum ?? null, link: strongest.link ?? null } : null,
    fastestCme: fastest ? { speedKmS: fastest.speed, start: fastest.c.startTime ?? null, link: fastest.c.link ?? null } : null,
    strongestStorm: stormKp && stormKp.kp >= 0 ? { maxKp: stormKp.kp, start: stormKp.s.startTime ?? null, link: stormKp.s.link ?? null } : null,
  };
}

export const GA_BBOX = { west: -85.7, south: 30.3, east: -80.8, north: 35.1 };

export type LiveLayer = "aircraft" | "transit" | "micromobility" | "stations" | "streamgauges";
export type LiveValue = string | number | boolean | null;

export interface LiveMarker {
  lon: number;
  lat: number;
  observedAt: string | null;
  label: string;
  props: Record<string, LiveValue>;
}

const round = (n: number, d = 5) => Math.round(n * 10 ** d) / 10 ** d;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const inBox = (lon: number, lat: number) => lon >= GA_BBOX.west && lon <= GA_BBOX.east && lat >= GA_BBOX.south && lat <= GA_BBOX.north;

function marker(lon: number | null, lat: number | null, observedAt: string | null, label: string, props: Record<string, LiveValue>): LiveMarker | null {
  if (lon === null || lat === null || !inBox(lon, lat)) return null;
  return { lon: round(lon), lat: round(lat), observedAt, label, props };
}

const keep = (m: LiveMarker | null): m is LiveMarker => m !== null;

/** adsb.lol dbFlags bits for aircraft whose owners opted out of public display (FAA PIA and LADD programmes). */
const PRIVACY_FLAGS = 4 | 8;
const MAX_POSITION_AGE_S = 60;

interface AdsbAircraft {
  flight?: string; t?: string; lat?: number; lon?: number; alt_baro?: number | "ground"; gs?: number; track?: number;
  seen_pos?: number; category?: string; emergency?: string; dbFlags?: number;
}

/** Aircraft from an adsb.lol / readsb `v2` response; drops PIA/LADD aircraft and never returns ICAO hex or registration. */
export function parseAdsbLol(json: { ac?: AdsbAircraft[]; now?: number }, nowMs = Date.now()): LiveMarker[] {
  const now = json.now ?? nowMs;
  return (json.ac ?? [])
    .filter((a) => !((a.dbFlags ?? 0) & PRIVACY_FLAGS) && (a.seen_pos ?? 0) <= MAX_POSITION_AGE_S)
    .map((a) =>
      marker(num(a.lon), num(a.lat), new Date(now - (a.seen_pos ?? 0) * 1000).toISOString(), a.flight?.trim() || "no callsign", {
        type: a.t ?? null,
        altFt: a.alt_baro === "ground" ? 0 : num(a.alt_baro),
        onGround: a.alt_baro === "ground",
        gsKt: num(a.gs),
        track: num(a.track),
        category: a.category ?? null,
        emergency: a.emergency && a.emergency !== "none" ? a.emergency : null,
      }),
    )
    .filter(keep);
}

/** Aircraft from the OpenSky `/states/all` response (fallback source). */
export function parseOpenSky(json: { time?: number; states?: unknown[][] | null }): LiveMarker[] {
  return (json.states ?? [])
    .map((s) => {
      const t = num(s[3]) ?? json.time ?? null;
      const altM = num(s[7]);
      const v = num(s[9]);
      return marker(num(s[5]), num(s[6]), t === null ? null : new Date(t * 1000).toISOString(), String(s[1] ?? "").trim() || "no callsign", {
        type: null,
        altFt: altM === null ? null : Math.round(altM * 3.28084),
        onGround: s[8] === true,
        gsKt: v === null ? null : round(v * 1.943844, 1),
        track: num(s[10]),
        category: null,
        emergency: null,
      });
    })
    .filter(keep);
}

class Pb {
  pos = 0;
  private view: DataView;
  constructor(private buf: Uint8Array, private end = buf.length) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  more() { return this.pos < this.end; }
  varint(): number {
    let r = 0;
    let shift = 0;
    for (;;) {
      if (this.pos >= this.end) throw new Error("truncated varint");
      const b = this.buf[this.pos++];
      r += (b & 0x7f) * 2 ** shift;
      if (!(b & 0x80)) return r;
      shift += 7;
      if (shift > 63) throw new Error("varint too long");
    }
  }
  key(): { field: number; wire: number } {
    const k = this.varint();
    return { field: Math.floor(k / 8), wire: k % 8 };
  }
  sub(): Pb {
    const len = this.varint();
    if (this.pos + len > this.end) throw new Error("truncated message");
    const p = new Pb(this.buf, this.pos + len);
    p.pos = this.pos;
    this.pos += len;
    return p;
  }
  str(): string {
    const p = this.sub();
    return new TextDecoder().decode(this.buf.subarray(p.pos, p.end));
  }
  float(): number {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  skip(wire: number) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.sub();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`unsupported wire type ${wire}`);
  }
}

export interface GtfsVehicle {
  lat: number; lon: number; bearing: number | null; speedMs: number | null; timestamp: number | null;
  routeId: string | null; tripId: string | null; vehicleLabel: string | null;
}

function decodeVehicle(p: Pb): GtfsVehicle | null {
  const v: GtfsVehicle = { lat: NaN, lon: NaN, bearing: null, speedMs: null, timestamp: null, routeId: null, tripId: null, vehicleLabel: null };
  while (p.more()) {
    const { field, wire } = p.key();
    if (field === 1 && wire === 2) {
      const t = p.sub();
      while (t.more()) {
        const k = t.key();
        if (k.field === 1 && k.wire === 2) v.tripId = t.str();
        else if (k.field === 5 && k.wire === 2) v.routeId = t.str();
        else t.skip(k.wire);
      }
    } else if (field === 2 && wire === 2) {
      const q = p.sub();
      while (q.more()) {
        const k = q.key();
        if (k.field === 1 && k.wire === 5) v.lat = q.float();
        else if (k.field === 2 && k.wire === 5) v.lon = q.float();
        else if (k.field === 3 && k.wire === 5) v.bearing = q.float();
        else if (k.field === 5 && k.wire === 5) v.speedMs = q.float();
        else q.skip(k.wire);
      }
    } else if (field === 5 && wire === 0) v.timestamp = p.varint();
    else if (field === 8 && wire === 2) {
      const d = p.sub();
      while (d.more()) {
        const k = d.key();
        if (k.field === 2 && k.wire === 2) v.vehicleLabel = d.str();
        else d.skip(k.wire);
      }
    } else p.skip(wire);
  }
  return Number.isFinite(v.lat) && Number.isFinite(v.lon) ? v : null;
}

/** Vehicle positions from a GTFS-realtime FeedMessage (protobuf); only the fields the map needs are decoded. */
export function decodeGtfsRtVehicles(bytes: Uint8Array): { headerTimestamp: number | null; vehicles: GtfsVehicle[] } {
  const p = new Pb(bytes);
  let headerTimestamp: number | null = null;
  const vehicles: GtfsVehicle[] = [];
  while (p.more()) {
    const { field, wire } = p.key();
    if (field === 1 && wire === 2) {
      const h = p.sub();
      while (h.more()) {
        const k = h.key();
        if (k.field === 3 && k.wire === 0) headerTimestamp = h.varint();
        else h.skip(k.wire);
      }
    } else if (field === 2 && wire === 2) {
      const e = p.sub();
      while (e.more()) {
        const k = e.key();
        if (k.field === 4 && k.wire === 2) {
          const v = decodeVehicle(e.sub());
          if (v) vehicles.push(v);
        } else e.skip(k.wire);
      }
    } else p.skip(wire);
  }
  return { headerTimestamp, vehicles };
}

export function transitMarkers(vehicles: GtfsVehicle[], agency: string): LiveMarker[] {
  return vehicles
    .map((v) =>
      marker(v.lon, v.lat, v.timestamp ? new Date(v.timestamp * 1000).toISOString() : null, v.routeId ? `Route ${v.routeId}` : `${agency} vehicle`, {
        agency,
        route: v.routeId,
        vehicle: v.vehicleLabel,
        bearing: v.bearing === null ? null : Math.round(v.bearing),
        speedMph: v.speedMs === null ? null : round(v.speedMs * 2.236936, 1),
      }),
    )
    .filter(keep);
}

interface GbfsBike { lat?: number; lon?: number; is_reserved?: boolean | number; is_disabled?: boolean | number; vehicle_type?: string; current_range_meters?: number; last_reported?: number }

/** Parked shared scooters/bikes from a GBFS `free_bike_status` feed; reserved vehicles and vehicle IDs are dropped. */
export function parseGbfsFreeBikes(json: { last_updated?: number; data?: { bikes?: GbfsBike[] } }, operator: string): LiveMarker[] {
  return (json.data?.bikes ?? [])
    .filter((b) => !b.is_reserved)
    .map((b) => {
      const t = b.last_reported ?? json.last_updated ?? null;
      return marker(num(b.lon), num(b.lat), t ? new Date(t * 1000).toISOString() : null, operator, {
        operator,
        vehicleType: b.vehicle_type ?? null,
        disabled: !!b.is_disabled,
        rangeKm: num(b.current_range_meters) === null ? null : round(Number(b.current_range_meters) / 1000, 1),
      });
    })
    .filter(keep);
}

interface IemRow { station?: string; name?: string; network?: string; utc_valid?: string | null; lon?: number; lat?: number; tmpf?: number | null; dwpf?: number | null; relh?: number | null; sknt?: number | null; gust?: number | null; drct?: number | null; phour?: number | null; pday?: number | null }

/** Weather/hydrology stations from the Iowa Environmental Mesonet `currents` API; observations older than `maxAgeH` are dropped. */
export function parseIemCurrents(json: { data?: IemRow[] }, network: string, nowMs = Date.now(), maxAgeH = 6): LiveMarker[] {
  return (json.data ?? [])
    .filter((r) => r.utc_valid && nowMs - Date.parse(r.utc_valid) <= maxAgeH * 3_600_000)
    .map((r) =>
      marker(num(r.lon), num(r.lat), new Date(Date.parse(String(r.utc_valid))).toISOString(), r.name ?? r.station ?? "station", {
        station: r.station ?? null,
        network,
        tempF: num(r.tmpf),
        dewF: num(r.dwpf),
        rh: num(r.relh) === null ? null : Math.round(Number(r.relh)),
        windKt: num(r.sknt),
        gustKt: num(r.gust),
        windDir: num(r.drct),
        precipHourIn: num(r.phour),
        precipDayIn: num(r.pday),
      }),
    )
    .filter(keep);
}

interface UsgsSeries {
  sourceInfo?: { siteName?: string; siteCode?: { value?: string }[]; geoLocation?: { geogLocation?: { latitude?: number; longitude?: number } } };
  variable?: { variableCode?: { value?: string }[]; unit?: { unitCode?: string } };
  values?: { value?: { value?: string; dateTime?: string; qualifiers?: string[] }[] }[];
}

/** Latest gage height per site from a USGS NWIS instantaneous-values JSON response. */
export function parseUsgsIv(json: { value?: { timeSeries?: UsgsSeries[] } }): LiveMarker[] {
  const out = new Map<string, LiveMarker>();
  for (const s of json.value?.timeSeries ?? []) {
    const site = s.sourceInfo?.siteCode?.[0]?.value;
    const latest = s.values?.[0]?.value?.at(-1);
    const geo = s.sourceInfo?.geoLocation?.geogLocation;
    const v = num(latest?.value);
    if (!site || !latest?.dateTime || v === null || v <= -999_999) continue;
    const m = marker(num(geo?.longitude), num(geo?.latitude), new Date(latest.dateTime).toISOString(), s.sourceInfo?.siteName ?? site, {
      site,
      gageHeightFt: v,
      unit: s.variable?.unit?.unitCode ?? "ft",
      provisional: latest.qualifiers?.includes("P") ?? false,
    });
    if (m) out.set(site, m);
  }
  return [...out.values()];
}

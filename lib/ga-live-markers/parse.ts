export const GA_BBOX = { west: -85.7, south: 30.3, east: -80.8, north: 35.1 };

export type OsmInfraKind = "signals" | "towers" | "police" | "firestations" | "sirens" | "speedcams" | "alpr";
export type LiveLayer = "aircraft" | "transit" | "micromobility" | "stations" | "streamgauges" | "quakes" | "tfr" | "augusta911" | "athens911" | OsmInfraKind;
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
  seen_pos?: number; category?: string; emergency?: string; dbFlags?: number; type?: string; nac_p?: number;
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
        gpsNacp: a.type?.startsWith("adsb") ? num(a.nac_p) : null,
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
        gpsNacp: null,
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

interface UsgsQuakeFeature {
  geometry?: { coordinates?: unknown[] } | null;
  properties?: { mag?: number | null; place?: string | null; time?: number | null; type?: string | null; url?: string | null; status?: string | null };
}

/** Seismic events from a USGS FDSN event GeoJSON response (magnitude, depth, review status, event page). */
export function parseUsgsQuakes(json: { features?: UsgsQuakeFeature[] }): LiveMarker[] {
  return (json.features ?? [])
    .map((f) => {
      const [lon, lat, depth] = f.geometry?.coordinates ?? [];
      const p = f.properties ?? {};
      const mag = num(p.mag);
      const time = num(p.time);
      return marker(num(lon), num(lat), time === null ? null : new Date(time).toISOString(), `M${mag === null ? "?" : mag.toFixed(1)} ${p.place ?? ""}`.trim(), {
        mag: mag === null ? null : round(mag, 2),
        depthKm: num(depth) === null ? null : round(num(depth)!, 1),
        eventType: p.type ?? null,
        status: p.status ?? null,
        url: p.url ?? null,
      });
    })
    .filter(keep);
}

interface OsmElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/** Which mapped public-safety infrastructure an OSM element is; untagged nodes are `out skel` traffic-signal nodes. */
export function osmInfraKind(tags: Record<string, string> | undefined): OsmInfraKind | null {
  if (!tags || tags.highway === "traffic_signals") return "signals";
  if (tags.amenity === "police") return "police";
  if (tags.amenity === "fire_station") return "firestations";
  if (tags.emergency === "siren") return "sirens";
  if (tags.highway === "speed_camera") return "speedcams";
  if (tags.man_made === "surveillance" && tags["surveillance:type"]?.toUpperCase() === "ALPR") return "alpr";
  if ((tags.man_made === "mast" || tags.man_made === "tower") && tags["tower:type"] === "communication") return "towers";
  return null;
}

const INFRA_LABEL: Record<OsmInfraKind, string> = {
  signals: "Traffic signal",
  towers: "Communication tower",
  police: "Police facility",
  firestations: "Fire station",
  sirens: "Outdoor warning siren",
  speedcams: "Speed camera",
  alpr: "Plate-reader camera (location)",
};

const tagOr = (t: Record<string, string>, ...keys: string[]) => keys.map((k) => t[k]).find((v) => v?.trim())?.trim() ?? null;
const commUses = (t: Record<string, string>) =>
  Object.entries(t)
    .filter(([k, v]) => k.startsWith("communication:") && v === "yes")
    .map(([k]) => k.slice("communication:".length).replace(/_/g, " "))
    .join(", ") || null;

/** OpenStreetMap public-safety infrastructure from an Overpass JSON response, split by kind; `observedAt` is the OSM database time. */
export function parseOverpassInfra(json: { osm3s?: { timestamp_osm_base?: string }; elements?: OsmElement[] }): Record<OsmInfraKind, LiveMarker[]> {
  const asOf = json.osm3s?.timestamp_osm_base ?? null;
  const out: Record<OsmInfraKind, LiveMarker[]> = { signals: [], towers: [], police: [], firestations: [], sirens: [], speedcams: [], alpr: [] };
  for (const e of json.elements ?? []) {
    const kind = osmInfraKind(e.tags);
    if (!kind || !e.type || e.id === undefined) continue;
    const t = e.tags ?? {};
    const name = tagOr(t, "name", "official_name");
    const m = marker(num(e.lon ?? e.center?.lon), num(e.lat ?? e.center?.lat), asOf, name ?? INFRA_LABEL[kind], {
      osm: `${e.type}/${e.id}`,
      kind: INFRA_LABEL[kind],
      named: name !== null,
      operator: tagOr(t, "operator"),
      heightM: num(t.height),
      uses: kind === "towers" ? commUses(t) : null,
      sirenType: kind === "sirens" ? tagOr(t, "siren:type") : null,
      sirenPurpose: kind === "sirens" ? tagOr(t, "siren:purpose") : null,
    });
    if (m) out[kind].push(m);
  }
  return out;
}

export interface TfrListItem {
  notam_id?: string;
  type?: string;
  facility?: string;
  state?: string;
  description?: string;
  creation_date?: string;
}

const xmlText = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim() ?? null;
const dms = (v: string) => {
  const m = v.match(/^([0-9.]+)([NSEW])$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? (m[2] === "S" || m[2] === "W" ? -n : n) : null;
};
const utc = (v: string | null) => (v ? `${v}Z` : null);

/** Centre, name, window and ceiling of an FAA temporary flight restriction from its tfr.faa.gov XNOTAM detail XML. */
export function parseTfrXml(xml: string, item: TfrListItem): LiveMarker | null {
  const pts: [number, number][] = [];
  for (const m of xml.matchAll(/<geoLat>([^<]+)<\/geoLat>\s*<geoLong>([^<]+)<\/geoLong>/g)) {
    const lat = dms(m[1].trim());
    const lon = dms(m[2].trim());
    if (lat !== null && lon !== null) pts.push([lon, lat]);
  }
  if (!pts.length) return null;
  const lon = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const upper = num(xmlText(xml, "valDistVerUpper"));
  return marker(lon, lat, utc(xmlText(xml, "dateIssued")), xmlText(xml, "txtLocalName") ?? item.description ?? "TFR", {
    notam: item.notam_id ?? null,
    tfrType: item.type ?? null,
    place: item.description ?? null,
    area: xmlText(xml, "txtName"),
    effective: utc(xmlText(xml, "dateEffective")),
    expires: utc(xmlText(xml, "dateExpire")),
    upperFt: upper,
    upperRef: xmlText(xml, "codeDistVerUpper"),
    facility: item.facility ?? null,
  });
}

const EASTERN = "America/New_York";
const easternOffsetMin = (t: number) => {
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, timeZoneName: "shortOffset" }).formatToParts(new Date(t)).find((x) => x.type === "timeZoneName")?.value ?? "";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
};

/** UTC ISO time for a wall-clock time in US Eastern (handles EST/EDT). */
export function easternToIso(y: number, mo: number, d: number, h: number, mi: number): string {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const first = wall - easternOffsetMin(wall) * 60_000;
  return new Date(wall - easternOffsetMin(first) * 60_000).toISOString();
}

export interface BskyFeedItem {
  reason?: unknown;
  post?: {
    uri?: string;
    author?: { handle?: string };
    record?: { text?: string; createdAt?: string; facets?: { features?: { uri?: string }[] }[] };
  };
}

export interface Augusta911Call {
  callType: string;
  location: string;
  calledAt: string | null;
  postedAt: string | null;
  postUrl: string | null;
  coord: [number, number] | null;
}

const AUG_POST = /^(\d{1,2})\/(\d{1,2})\/(\d{4})@(\d{1,2}):(\d{2}) ([AP])M: (.+?) at (.+?)(?: https?:\/\/\S*)?$/s;
const COORD_TEXT = /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/;

/** Calls from the Augusta, GA E911 Bluesky author feed (`app.bsky.feed.getAuthorFeed`); reposts and unparseable posts are skipped, repeated posts of one call are merged. */
export function parseAugusta911Feed(json: { feed?: BskyFeedItem[] }): Augusta911Call[] {
  const seen = new Set<string>();
  const out: Augusta911Call[] = [];
  for (const it of json.feed ?? []) {
    const post = it.post;
    const rec = post?.record;
    if (it.reason || !rec?.text) continue;
    const m = rec.text.trim().match(AUG_POST);
    if (!m) continue;
    const mapUri = rec.facets?.flatMap((f) => f.features ?? []).map((f) => f.uri ?? "").find((u) => /[?&]q=/.test(u));
    const q = mapUri ? new URL(mapUri).searchParams.get("q") : null;
    const location = (q ?? m[8]).replace(/\s+/g, " ").replace(/\.{3}$/, "").trim();
    const hour = (Number(m[4]) % 12) + (m[6] === "P" ? 12 : 0);
    const calledAt = easternToIso(Number(m[3]), Number(m[1]), Number(m[2]), hour, Number(m[5]));
    const callType = m[7].replace(/\s+/g, " ").trim();
    const key = `${calledAt}|${callType}|${location}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = location.replace(/\s+AUGUSTA\s+GA$/i, "").match(COORD_TEXT);
    const rkey = post?.uri?.split("/").pop();
    out.push({
      callType,
      location,
      calledAt,
      postedAt: rec.createdAt ?? null,
      postUrl: rkey && post?.author?.handle ? `https://bsky.app/profile/${post.author.handle}/post/${rkey}` : null,
      coord: c ? [Number(c[2]), Number(c[1])] : null,
    });
  }
  return out;
}

/** Single-line query for the Augusta GIS address locator: city suffix dropped, "A AND B" written as an intersection "A & B". */
export const augustaGeocodeQuery = (location: string) => location.replace(/\s+AUGUSTA\s+GA$/i, "").replace(/\s+AND\s+/gi, " & ").replace(/\s+/g, " ").trim();

export interface GeocodeHit { lon: number; lat: number; score: number; matched: string }

/** Esri locator scores: ≥ 80 a good match; 60–79 placed but flagged approximate; below 60 not placed. */
export const GEOCODE_GOOD_SCORE = 80;
export const GEOCODE_MIN_SCORE = 60;

/** Map markers for Augusta E911 calls; location is the coordinate in the post or the Augusta GIS locator match, calls without either are dropped. */
export function augusta911Markers(calls: Augusta911Call[], geocode: (query: string) => GeocodeHit | null): LiveMarker[] {
  return calls
    .map((c) => {
      const hit = c.coord ? null : geocode(augustaGeocodeQuery(c.location));
      const [lon, lat] = c.coord ?? (hit ? [hit.lon, hit.lat] : [null, null]);
      const delayMin = c.calledAt && c.postedAt ? Math.round((Date.parse(c.postedAt) - Date.parse(c.calledAt)) / 60_000) : null;
      return marker(lon, lat, c.calledAt, c.callType, {
        agency: "Augusta-Richmond County E911",
        callType: c.callType,
        location: c.location,
        postedAt: c.postedAt,
        postDelayMin: delayMin,
        placedBy: c.coord ? "coordinates in post" : "Augusta GIS address locator",
        matched: hit?.matched ?? null,
        matchScore: hit ? Math.round(hit.score) : null,
        approximate: hit !== null && hit.score < GEOCODE_GOOD_SCORE,
        postUrl: c.postUrl,
      });
    })
    .filter(keep);
}

export interface AccpdFeature {
  attributes?: { Incident_Number?: string | null; Incident_Type?: string | null; Date?: number | null; Lat?: number | null; Lon?: number | null; Call_Source?: string | null; Personnel_Incidentcount?: number | null; ObjectId?: number | null };
}

/** Athens-Clarke PD calls for service from the county's `Incidents_accpd_Public` ArcGIS layer, at the published point; the layer gives a date only, so `observedAt` is local midnight. */
export function parseAccpdIncidents(json: { features?: AccpdFeature[] }): LiveMarker[] {
  return (json.features ?? [])
    .map((f) => {
      const a = f.attributes ?? {};
      const t = num(a.Date);
      return marker(num(a.Lon), num(a.Lat), t === null ? null : new Date(t).toISOString(), a.Incident_Type?.trim() || "Call for service", {
        agency: "Athens-Clarke County Police",
        incident: a.Incident_Number ?? null,
        callType: a.Incident_Type?.trim() || null,
        callSource: a.Call_Source?.trim() || null,
        date: t === null ? null : new Date(t).toLocaleDateString("en-CA", { timeZone: EASTERN }),
        personnel: num(a.Personnel_Incidentcount),
        objectId: num(a.ObjectId),
      });
    })
    .filter(keep);
}

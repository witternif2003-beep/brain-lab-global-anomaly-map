import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { LABEL_MAX_DIST_M, carCount, carLabel, carStatus, labelCandidates, msToMph, CRAWL_SPEED_MS, FREE_SPEED_MS, flowDensityPerKm, flowSpeedMs, JAM_FRACTION, JAM_SPEED_MS, MAX_AGENTS_TOUCH, TrafficSim, bearingDeg, buildEdge, haversineM, inJam, positionAt, type LngLat } from '../lib/traffic-sim';
import { trafficSimEnabled } from '../lib/traffic-overlay';

/** ~16.1 km (10 mi) due-north line at Atlanta's longitude, in 5 vertices. */
const I75: LngLat[] = [0, 1, 2, 3, 4].map((i) => [-84.39, 33.70 + (i * 0.145) / 4] as LngLat);

test('haversine length of one degree of latitude ≈ 111.2 km', () => {
  assert.ok(Math.abs(haversineM([0, 0], [0, 1]) - 111_195) < 5);
});

test('linear referencing: cumulative length, midpoint position and bearing', () => {
  const e = buildEdge(I75, 0);
  assert.ok(Math.abs(e.length - haversineM(I75[0], I75[4])) < 1);
  const mid = positionAt(e, e.length / 2);
  assert.ok(Math.abs(mid.position[1] - (33.70 + 0.145 / 2)) < 1e-6);
  assert.ok(Math.abs(mid.bearing) < 1e-6 || Math.abs(mid.bearing - 360) < 1e-6);
  assert.ok(Math.abs(bearingDeg([0, 0], [1, 0]) - 90) < 1e-6);
});

test('jam zone covers 30% of each line', () => {
  const e = buildEdge(I75, 7);
  let jam = 0;
  const N = 10_000;
  for (let i = 0; i < N; i++) if (inJam(e, ((i + 0.5) / N) * e.length)) jam++;
  assert.ok(Math.abs(jam / N - JAM_FRACTION) < 0.001);
});

test('densities: 200/km jammed, 35/km free (jam pitch ≥ 5 m, so 4 m cars never overlap); speeds 15 and 100 km/h', () => {
  const sim = new TrafficSim([I75], 10_000);
  const km = sim.edges[0].length / 1000;
  const jam = sim.agents.filter((a) => a.speed === JAM_SPEED_MS).length;
  const free = sim.agents.filter((a) => a.speed === FREE_SPEED_MS).length;
  assert.ok(Math.abs(jam - 200 * km * 0.3) <= 1, `jam ${jam}`);
  assert.ok(Math.abs(free - 35 * km * 0.7) <= 1, `free ${free}`);
  assert.ok(1000 / flowDensityPerKm({ level: 0 }) >= 5);
});

test('agents advance by speed × dt and wrap to the start of the line', () => {
  const sim = new TrafficSim([I75], 10_000);
  const e = sim.edges[0];
  const a = sim.agents[0];
  const d0 = a.offsetDistance;
  const v = a.speed;
  sim.tick(1000);
  const moved = a.offsetDistance - d0;
  assert.ok(Math.abs(moved - v) < 1e-6 || moved < 0);
  a.offsetDistance = e.length - 1;
  sim.tick(1000);
  assert.ok(a.offsetDistance < 30 && a.offsetDistance >= 0);
});

test('agent cap holds and short fragments are skipped', () => {
  const sim = new TrafficSim([I75, I75.map(([x, y]) => [x + 0.1, y] as LngLat), [[0, 0], [0, 0.0001]]], MAX_AGENTS_TOUCH);
  assert.equal(sim.edges.length, 2);
  assert.ok(sim.agents.length <= MAX_AGENTS_TOUCH);
});

test('SIM vehicles run by default and stop only with ?traffic=off', () => {
  assert.equal(trafficSimEnabled(''), true);
  assert.equal(trafficSimEnabled('?traffic=sim'), true);
  assert.equal(trafficSimEnabled('?x=1&traffic=off'), false);
});

test('TomTom-bound lines: speed = 100 km/h × traffic_level, density 35→200/km by jamFactor, closures stop', () => {
  assert.ok(Math.abs(flowSpeedMs({ level: 1 }) - FREE_SPEED_MS) < 1e-9);
  assert.ok(Math.abs(flowSpeedMs({ level: 0.5 }) - FREE_SPEED_MS / 2) < 1e-9);
  assert.equal(flowSpeedMs({ level: 0 }), CRAWL_SPEED_MS);
  assert.equal(flowSpeedMs({ level: 0.9, closed: true }), 0);
  assert.equal(flowDensityPerKm({ level: 1 }), 35);
  assert.equal(flowDensityPerKm({ level: 0 }), 200);
  assert.equal(flowDensityPerKm({ level: 0.5 }), 117.5);
  const sim = new TrafficSim([I75, I75.map(([x, y]) => [x + 0.1, y] as LngLat)], 100_000, undefined, [{ level: 1 }, { level: 0.1 }]);
  const onLine = (i: number) => sim.agents.filter((a) => a.edgeIndex === i);
  assert.ok(onLine(1).length > onLine(0).length * 5);
  assert.ok(onLine(0).every((a) => Math.abs(a.speed - FREE_SPEED_MS) < 1e-9));
  assert.ok(onLine(1).every((a) => Math.abs(a.speed - FREE_SPEED_MS * 0.1) < 1e-9));
  sim.tick(1000);
  assert.ok(onLine(1).every((a) => Math.abs(a.speed - FREE_SPEED_MS * 0.1) < 1e-9));
});

test('car telemetry: mph conversion, SIM label, 4-level status by mph', () => {
  assert.ok(Math.abs(msToMph(FREE_SPEED_MS) - 62.137) < 0.01);
  assert.equal(carLabel({ id: 'car-3-7', speed: 20 }), 'SIM car-3-7 | 44.7 mph');
  const mph = (m: number) => ({ speed: m / 2.2369362920544 });
  assert.equal(carStatus(mph(5)).label, 'Stopped');
  assert.equal(carStatus(mph(29.9)).label, 'Jammed');
  assert.equal(carStatus(mph(30)).label, 'Slow');
  assert.equal(carStatus(mph(55)).label, 'Free-flow');
});

test('car labels: none at zoom 15.5 or below; nearest 50 within 500 m above it', () => {
  const center: LngLat = [-84.388, 33.749];
  const car = (i: number, dLat: number) => ({ id: `c${i}`, edgeIndex: 0, offsetDistance: 0, speed: 20, bearing: 0, elevM: 0, position: [center[0], center[1] + dLat] as LngLat });
  const cars = Array.from({ length: 80 }, (_, i) => car(i, i * 0.00005));
  assert.equal(labelCandidates(cars, center, 15.5).length, 0);
  const got = labelCandidates(cars, center, 15.6);
  assert.equal(got.length, 50);
  assert.equal(got[0].id, 'c0');
  assert.ok(got.every((c) => haversineM(c.position, center) < LABEL_MAX_DIST_M));
  assert.equal(labelCandidates([car(0, 0.01)], center, 18).length, 0);
});

test('updateFlows: fresh TomTom level changes car speed in place without respawning', () => {
  const line: LngLat[] = [[-84.4, 33.75], [-84.39, 33.75]];
  const sim = new TrafficSim([line], 100, undefined, [{ level: 1 }]);
  const ids = sim.agents.map((a) => a.id);
  assert.equal(sim.updateFlows([{ level: 0.2 }]), 1);
  sim.tick(16);
  assert.deepEqual(sim.agents.map((a) => a.id), ids);
  assert.ok(sim.agents.every((a) => Math.abs(a.speed - FREE_SPEED_MS * 0.2) < 1e-9));
  assert.equal(sim.updateFlows([undefined]), 0);
});

test('short free-flow TomTom lines still get cars: 200 × 100 m at 35/km ≈ 700 cars, not 0', () => {
  const lines: LngLat[][] = Array.from({ length: 200 }, (_, i) => [[-84.4, 33.7 + i * 0.001], [-84.3989, 33.7 + i * 0.001]] as LngLat[]);
  const sim = new TrafficSim(lines, 4000, undefined, lines.map(() => ({ level: 1 })));
  assert.ok(sim.agents.length >= 600 && sim.agents.length <= 800, String(sim.agents.length));
  assert.equal(carCount(0.5, 1) + carCount(0, 1), carCount(0.5, 1));
  assert.equal(carCount(3, 9), 3);
});

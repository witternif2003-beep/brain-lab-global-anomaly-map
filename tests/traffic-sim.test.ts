import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { CRAWL_SPEED_MS, FREE_SPEED_MS, flowDensityPerKm, flowSpeedMs, JAM_FRACTION, JAM_SPEED_MS, MAX_AGENTS_TOUCH, TrafficSim, bearingDeg, buildEdge, haversineM, inJam, positionAt, type LngLat } from '../lib/traffic-sim';
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

test('densities: 80/km jammed, 5/km free; speeds 15 and 100 km/h', () => {
  const sim = new TrafficSim([I75], 10_000);
  const km = sim.edges[0].length / 1000;
  const jam = sim.agents.filter((a) => a.speed === JAM_SPEED_MS).length;
  const free = sim.agents.filter((a) => a.speed === FREE_SPEED_MS).length;
  assert.ok(Math.abs(jam - 80 * km * 0.3) <= 1, `jam ${jam}`);
  assert.ok(Math.abs(free - 5 * km * 0.7) <= 1, `free ${free}`);
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

test('SIM vehicles are opt-in via ?traffic=sim only', () => {
  assert.equal(trafficSimEnabled(''), false);
  assert.equal(trafficSimEnabled('?traffic=off'), false);
  assert.equal(trafficSimEnabled('?traffic-sim=1'), false);
  assert.equal(trafficSimEnabled('?x=1&traffic=sim'), true);
});

test('TomTom-bound lines: speed = 100 km/h × traffic_level, density 5→80/km by jamFactor, closures stop', () => {
  assert.ok(Math.abs(flowSpeedMs({ level: 1 }) - FREE_SPEED_MS) < 1e-9);
  assert.ok(Math.abs(flowSpeedMs({ level: 0.5 }) - FREE_SPEED_MS / 2) < 1e-9);
  assert.equal(flowSpeedMs({ level: 0 }), CRAWL_SPEED_MS);
  assert.equal(flowSpeedMs({ level: 0.9, closed: true }), 0);
  assert.equal(flowDensityPerKm({ level: 1 }), 5);
  assert.equal(flowDensityPerKm({ level: 0 }), 80);
  assert.equal(flowDensityPerKm({ level: 0.5 }), 42.5);
  const sim = new TrafficSim([I75, I75.map(([x, y]) => [x + 0.1, y] as LngLat)], 100_000, undefined, [{ level: 1 }, { level: 0.1 }]);
  const onLine = (i: number) => sim.agents.filter((a) => a.edgeIndex === i);
  assert.ok(onLine(1).length > onLine(0).length * 10);
  assert.ok(onLine(0).every((a) => Math.abs(a.speed - FREE_SPEED_MS) < 1e-9));
  assert.ok(onLine(1).every((a) => Math.abs(a.speed - FREE_SPEED_MS * 0.1) < 1e-9));
  sim.tick(1000);
  assert.ok(onLine(1).every((a) => Math.abs(a.speed - FREE_SPEED_MS * 0.1) < 1e-9));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlindspotDetector, BuildingIndex, VantageAnalyzer, ViewshedEngine, localFrame, type Building } from '../../lib/ga-viewshed/engine';

const box = (x0: number, y0: number, x1: number, y1: number, topM: number): Building => ({
  ring: new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]),
  topM,
});
const flat = () => 0;

test('on open flat ground the viewshed reaches the full radius in every direction', () => {
  const e = new ViewshedEngine(new BuildingIndex([]), flat);
  const v = e.analyze({ x: 0, y: 0, z: 1.7 }, { radiusM: 200, azimuths: 72 });
  assert.ok([...v.reach].every((r) => r === 200));
  assert.ok(Math.abs(v.areaM2 / v.circleAreaM2 - 1) < 0.01);
});

test('a tall building to the north stops the view north but not south', () => {
  const idx = new BuildingIndex([box(-20, 50, 20, 70, 30)]);
  const v = new ViewshedEngine(idx, flat).analyze({ x: 0, y: 0, z: 1.7 }, { radiusM: 200, azimuths: 36 });
  assert.ok(v.reach[0] < 80, `north reach ${v.reach[0]}`);
  assert.equal(v.reach[18], 200);
  assert.ok(v.areaM2 < 0.95 * v.circleAreaM2);
});

test('an observer on a high roof sees over a low building', () => {
  const idx = new BuildingIndex([box(-20, 50, 20, 70, 6)]);
  const e = new ViewshedEngine(idx, flat);
  assert.equal(e.visible({ x: 0, y: 0, z: 1.7 }, 0, 150), false);
  assert.equal(e.visible({ x: 0, y: 0, z: 60 }, 0, 150), true);
});

test('a ridge in the terrain hides the valley behind it', () => {
  const ridge = (_x: number, y: number) => (y > 90 && y < 110 ? 40 : 0);
  const e = new ViewshedEngine(new BuildingIndex([]), ridge);
  assert.equal(e.visible({ x: 0, y: 0, z: 1.7 }, 0, 200), false);
  assert.equal(e.visible({ x: 0, y: 0, z: 1.7 }, 0, 50), true);
});

test('blind spots are the ground cells behind buildings; building cells are excluded', () => {
  const idx = new BuildingIndex([box(10, -10, 20, 10, 20)]);
  const e = new ViewshedEngine(idx, flat);
  const g = new BlindspotDetector(e, idx).detect({ x0: -50, y0: -50, x1: 50, y1: 50 }, [{ x: 0, y: 0, z: 1.7 }], { cellM: 5 });
  assert.equal(g.cols, 20);
  assert.ok(g.coverage > 0.6 && g.coverage < 0.9, `coverage ${g.coverage}`);
  assert.equal(g.cells[10 * 20 + 13], 255);
  assert.equal(g.cells[10 * 20 + 18], 0);
});

test('vantage ranking picks the observer that sees past the wall first', () => {
  const idx = new BuildingIndex([box(-5, -50, 5, 50, 15)]);
  const e = new ViewshedEngine(idx, flat);
  const ranked = new VantageAnalyzer(new BlindspotDetector(e, idx)).rank(
    { x0: -50, y0: -50, x1: 50, y1: 50 },
    [{ x: -30, y: 0, z: 1.7 }, { x: 0, y: 0, z: 16.7 }],
    { cellM: 10 },
  );
  assert.equal(ranked[0].observer.z, 16.7);
  assert.ok(ranked[0].coverage > ranked[1].coverage);
});

test('the local frame round-trips lng/lat within a centimetre', () => {
  const f = localFrame(-84.39, 33.75);
  const [x, y] = f.toLocal(-84.385, 33.752);
  const [lng, lat] = f.toLngLat(x, y);
  assert.ok(Math.abs(lng + 84.385) < 1e-7 && Math.abs(lat - 33.752) < 1e-7);
});

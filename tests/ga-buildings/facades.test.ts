import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACADE_PATTERN_EXPRESSION, FACADE_ROWS, FACADE_SPECS, FACADE_TILE_PX, facadePattern } from '../../lib/ga-buildings/facades';

const px = (p: ReturnType<typeof facadePattern>, x: number, y: number) => Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));

test('each facade tile is an opaque RGBA square', () => {
  for (const spec of Object.values(FACADE_SPECS)) {
    const p = facadePattern(spec);
    assert.equal(p.width, FACADE_TILE_PX);
    assert.equal(p.data.length, FACADE_TILE_PX * FACADE_TILE_PX * 4);
    for (let i = 3; i < p.data.length; i += 4) assert.equal(p.data[i], 255);
  }
});

test('every storey row has a floor band, windows between piers, and a sill', () => {
  const p = facadePattern(FACADE_SPECS['facade-brick']);
  const rowH = FACADE_TILE_PX / FACADE_ROWS;
  for (let r = 0; r < FACADE_ROWS; r++) {
    const y0 = r * rowH;
    assert.deepEqual(px(p, 4, y0).slice(0, 3), [0x87, 0x41, 0x27]);
    assert.deepEqual(px(p, 0, y0 + rowH / 2).slice(0, 3), [0xaa, 0x55, 0x33]);
    assert.notDeepEqual(px(p, 6, y0 + rowH / 2), px(p, 0, y0 + rowH / 2));
    assert.deepEqual(px(p, 6, y0 + rowH - 1).slice(0, 3), [0xaa, 0x55, 0x33]);
  }
});

test('glass curtain walls have more glazing than brick', () => {
  const glassy = (id: keyof typeof FACADE_SPECS) => {
    const p = facadePattern(FACADE_SPECS[id]);
    const wall = px(p, 0, 4).join();
    let n = 0;
    for (let x = 0; x < p.width; x++) if (px(p, x, 4).join() !== wall) n++;
    return n;
  };
  assert.ok(glassy('facade-glass') > glassy('facade-brick'));
});

test('the pattern expression only names registered facades and keys on Overture facade_material', () => {
  assert.deepEqual(FACADE_PATTERN_EXPRESSION[1], ['get', 'facade_material']);
  const names = JSON.stringify(FACADE_PATTERN_EXPRESSION).match(/facade-[a-z]+/g)!;
  for (const n of names) assert.ok(n in FACADE_SPECS, n);
});

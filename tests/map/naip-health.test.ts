import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialNaipHealth, noteNaipError, NAIP_ERRORS_TO_FALLBACK, NAIP_ERROR_WINDOW_MS } from '../../lib/map/naip-health';

test('NAIP falls back to Esri imagery after 3 tile errors inside 60 s', () => {
  let s = initialNaipHealth();
  for (let i = 0; i < NAIP_ERRORS_TO_FALLBACK - 1; i++) s = noteNaipError(s, 1000 + i, 'HTTP 502');
  assert.equal(s.down, false);
  s = noteNaipError(s, 2000, 'HTTP 502');
  assert.equal(s.down, true);
  assert.equal(s.since, 2000);
  assert.equal(s.lastError, 'HTTP 502');
});

test('errors spread wider than the window do not trigger fallback', () => {
  let s = initialNaipHealth();
  for (let i = 0; i < 5; i++) s = noteNaipError(s, i * (NAIP_ERROR_WINDOW_MS + 1));
  assert.equal(s.down, false);
});

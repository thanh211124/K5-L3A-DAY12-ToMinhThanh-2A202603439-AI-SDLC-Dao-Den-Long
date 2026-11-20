// Ticket-02 palette + ambient formula are used verbatim by the renderer (static check of web/ sources).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('web/main.js', 'utf8');
const css = readFileSync('web/style.css', 'utf8');
const STANDARD = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  lampOn: '#FFB347', lampCore: '#FFE9B0', lampOff: '#5B5F6E', moteCore: '#FFF6C2', moteGlow: '#FFE58A',
  shadeBody: '#120A1A', shadeRim: '#7A3CFF', shadeStun: '#3A3450', cloth: '#E8E2D0', scarf: '#C8102E',
  gold: '#F2C14E', drifter: '#8FA3B8', danger: '#FF5A5F', ui: '#F5F1E6',
  cbRim: '#00B3FF', cbDanger: '#FFFFFF', // Ticket-03 colour-blind mode
};

test('renderer palette C{} matches the standard hex values exactly', () => {
  for (const [k, hex] of Object.entries(STANDARD)) assert.match(main, new RegExp(`${k}: '${hex}'`), `${k} should be ${hex}`);
});
test('UI text / danger / score colours in CSS match the standard', () => {
  for (const hex of ['#F5F1E6', '#FF5A5F', '#F2C14E']) assert.ok(css.includes(hex), hex);
});
test('ambient intensity = 0.15 + 0.55 × lit/total', () => {
  assert.match(main, /ambient\.intensity = 0\.15 \+ 0\.55 \* \(sim\.litCount \/ sim\.lanterns\.length\)/);
});

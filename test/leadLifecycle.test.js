import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isValidIsraeliPhone, validateLeadPayload } from '../src/lib/leadApi.js';

test('started lead requires a valid phone and consent but not a name', () => {
  assert.deepEqual(validateLeadPayload({
    lifecycleAction: 'start',
    name: '',
    phone: '054-279-0088',
    email: '',
    consent: true
  }), {});
});

test('personal lead is rejected before both phone and consent are valid', () => {
  const invalidPhone = validateLeadPayload({ lifecycleAction: 'start', name: '', phone: '123', email: '', consent: true });
  const missingConsent = validateLeadPayload({ lifecycleAction: 'start', name: '', phone: '054-279-0088', email: '', consent: false });
  assert.equal(invalidPhone.phone, 'נא להזין מספר טלפון תקין.');
  assert.equal(missingConsent.consent, 'יש לאשר את העברת הפרטים כדי שנוכל לחזור אליכם.');
});

test('completed lead still requires a customer name', () => {
  const errors = validateLeadPayload({ lifecycleAction: 'complete', name: '', phone: '054-279-0088', email: '', consent: true });
  assert.equal(errors.name, 'נא להזין שם מלא.');
});

test('Israeli local and international mobile formats are accepted', () => {
  assert.equal(isValidIsraeliPhone('054-279-0088'), true);
  assert.equal(isValidIsraeliPhone('972542790088'), true);
  assert.equal(isValidIsraeliPhone('04-1234567'), false);
});

test('lead lifecycle never blocks calculator navigation with a phone gate', () => {
  const lifecycleSource = readFileSync(new URL('../src/roofCheckLeadLifecycle.js', import.meta.url), 'utf8');
  assert.equal(lifecycleSource.includes('enforceLeadGate'), false);
  assert.equal(lifecycleSource.includes('toggleAddressNext'), false);
  assert.equal(lifecycleSource.includes('data-lifecycle-phone'), false);
});

test('report contact form never reuses a stored customer identity', () => {
  const reportSource = readFileSync(new URL('../src/reportUxFix.js', import.meta.url), 'utf8');
  assert.equal(reportSource.includes('draft.name'), false);
  assert.equal(reportSource.includes('draft.phone'), false);
  assert.equal(reportSource.includes('lifecycleSession.phone'), false);
  assert.match(reportSource, /input name="name"[^>]+value=""/);
  assert.match(reportSource, /input name="phone"[^>]+value=""/);
});

test('roof map starts from a neutral overview and resolves every entered address', () => {
  const mapSource = readFileSync(new URL('../src/roofCheckMapPatch.js', import.meta.url), 'utf8');
  assert.equal(mapSource.includes("return [32.7937, 34.9892]"), false);
  assert.match(mapSource, /setView\(center, 8\)/);
  assert.match(mapSource, /setView\(\[point\.lat, point\.lng\], mapProvider\.maxZoom\)/);
});

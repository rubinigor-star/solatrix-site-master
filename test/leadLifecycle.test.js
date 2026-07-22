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

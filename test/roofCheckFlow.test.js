import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lifecycleEventType,
  nextLeadStatus,
  normalizeLifecycleAction,
  shouldAbandonLead
} from '../supabase/functions/_shared/leadLifecycle.js';

test('complete Roof Check lifecycle keeps one lead through start, activity and completion', () => {
  let status = nextLeadStatus(null, 'start');
  assert.equal(status, 'started');
  assert.equal(lifecycleEventType(null, status, 'start', true), 'lead_started');

  const activeStatus = nextLeadStatus(status, 'activity');
  assert.equal(activeStatus, 'started');
  assert.equal(lifecycleEventType(status, activeStatus, 'activity'), 'lead_activity');

  const completedStatus = nextLeadStatus(activeStatus, 'complete');
  assert.equal(completedStatus, 'completed');
  assert.equal(lifecycleEventType(activeStatus, completedStatus, 'complete'), 'lead_completed');
});

test('inactive started lead becomes eligible for abandonment only after 24 hours', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  assert.equal(shouldAbandonLead('started', '2026-07-21T12:00:01Z', now), false);
  assert.equal(shouldAbandonLead('started', '2026-07-21T12:00:00Z', now), true);
  assert.equal(shouldAbandonLead('completed', '2026-07-20T12:00:00Z', now), false);
});

test('returning abandoned session resumes the same lead', () => {
  const status = nextLeadStatus('abandoned', 'start');
  assert.equal(status, 'started');
  assert.equal(lifecycleEventType('abandoned', status, 'start'), 'lead_resumed');
});

test('calculator activity does not overwrite CRM-owned terminal workflow statuses', () => {
  for (const status of ['completed', 'contacted', 'qualified', 'lost']) {
    assert.equal(nextLeadStatus(status, 'activity'), status);
  }
  assert.equal(normalizeLifecycleAction('unexpected'), 'complete');
});

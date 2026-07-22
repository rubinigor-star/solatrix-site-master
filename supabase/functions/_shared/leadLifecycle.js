export const LEAD_STATUSES = Object.freeze(['started', 'completed', 'abandoned', 'contacted', 'qualified', 'lost']);
export const LIFECYCLE_ACTIONS = Object.freeze(['start', 'activity', 'complete']);

export function normalizeLifecycleAction(value) {
  const action = String(value || 'complete');
  return LIFECYCLE_ACTIONS.includes(action) ? action : 'complete';
}

export function nextLeadStatus(currentStatus, action) {
  if (action === 'complete') return 'completed';
  if (currentStatus === 'abandoned' || currentStatus === 'started' || !currentStatus) return 'started';
  return LEAD_STATUSES.includes(currentStatus) ? currentStatus : 'started';
}

export function lifecycleEventType(currentStatus, nextStatus, action, isNew = false) {
  if (isNew) return nextStatus === 'completed' ? 'lead_completed' : 'lead_started';
  if (currentStatus === 'abandoned' && nextStatus === 'started') return 'lead_resumed';
  if (action === 'complete') return 'lead_completed';
  return 'lead_activity';
}

export function shouldAbandonLead(status, lastActivityAt, now = Date.now()) {
  const lastActivity = new Date(lastActivityAt).getTime();
  return status === 'started' && Number.isFinite(lastActivity) && now - lastActivity >= 24 * 60 * 60 * 1000;
}

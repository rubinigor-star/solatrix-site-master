import './roofCheckLeadLifecycle.css';
import {
  getRoofCheckLifecycleSession,
  isValidIsraeliPhone,
  syncRoofCheckLead
} from './lib/leadApi.js';

const STEP_NAMES = ['start', 'address', 'roof-type', 'roof-marking', 'obstacles', 'analysis', 'report'];
let activityTimer = 0;
let lastActivitySignature = '';
let resumeAttempted = false;

function currentStep() {
  const path = location.pathname.replace(/\/$/, '');
  const match = STEP_NAMES.find((step) => step !== 'start' && path.endsWith(`/${step}`));
  return match || (document.querySelector('.reportCard') ? 'report' : 'start');
}

function scheduleActivity() {
  const session = getRoofCheckLifecycleSession();
  if (!session.verified || !session.consent || !isValidIsraeliPhone(session.phone)) return;
  const snapshot = calculatorSnapshot();
  const signature = JSON.stringify(snapshot);
  if (signature === lastActivitySignature) return;
  window.clearTimeout(activityTimer);
  activityTimer = window.setTimeout(async () => {
    try {
      await syncRoofCheckLead({
        phone: session.phone,
        consent: true,
        lifecycleAction: 'activity',
        calculatorStep: currentStep(),
        ...snapshot
      });
      lastActivitySignature = signature;
    } catch (error) {
      console.warn('Roof Check lead activity was not saved.', error);
    }
  }, 800);
}

function calculatorSnapshot() {
  const calculation = serializable(window.__solatrixRoofCalculation) || {};
  const surfaces = serializable(window.__solatrixRoofSurfaces) || [];
  const roofGeometry = serializable(window.__solatrixRoofGeometry);
  const address = document.querySelector('[data-field="address"]')?.value || calculation.address || '';
  const monthlyBill = document.querySelector('[data-field="monthlyBill"]')?.value || calculation.monthlyBill || '';
  const roofType = calculation.roofType || '';
  return {
    cityOrAddress: address,
    monthlyBill,
    propertyType: roofType,
    metadata: {
      roofCheckLifecycle: true,
      calculatorStep: currentStep(),
      roofType,
      surfaces,
      roofGeometry,
      calculation
    }
  };
}

function resumeStoredLead() {
  if (resumeAttempted) return;
  const session = getRoofCheckLifecycleSession();
  if (!session.verified || !session.consent || !isValidIsraeliPhone(session.phone)) return;
  resumeAttempted = true;
  syncRoofCheckLead({
    phone: session.phone,
    consent: true,
    lifecycleAction: 'start',
    calculatorStep: currentStep(),
    ...calculatorSnapshot()
  }).catch((error) => console.warn('Roof Check lead resume was not saved.', error));
}

function serializable(value) {
  try { return value ? JSON.parse(JSON.stringify(value)) : null; } catch { return null; }
}

function applyLifecycle() {
  resumeStoredLead();
  scheduleActivity();
}

const observer = new MutationObserver(applyLifecycle);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', applyLifecycle);
window.addEventListener('popstate', applyLifecycle);
window.addEventListener('pageshow', applyLifecycle);
window.addEventListener('solatrix:roof-geometry-changed', scheduleActivity);
setTimeout(applyLifecycle, 0);

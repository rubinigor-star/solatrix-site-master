import './roofCheckLeadLifecycle.css';
import {
  getRoofCheckLifecycleSession,
  isValidIsraeliPhone,
  syncRoofCheckLead,
  updateRoofCheckLifecycleSession
} from './lib/leadApi.js';

const STEP_NAMES = ['start', 'address', 'roof-type', 'roof-marking', 'obstacles', 'analysis', 'report'];
let startTimer = 0;
let activityTimer = 0;
let lastActivitySignature = '';
let resumeAttempted = false;

function currentStep() {
  const path = location.pathname.replace(/\/$/, '');
  const match = STEP_NAMES.find((step) => step !== 'start' && path.endsWith(`/${step}`));
  return match || (document.querySelector('.reportCard') ? 'report' : 'start');
}

function enhancePhoneGate() {
  const addressInput = document.querySelector('[data-field="address"]');
  const card = addressInput?.closest('.focusCard');
  if (!card || card.dataset.leadLifecycleGate === 'true') return;
  card.dataset.leadLifecycleGate = 'true';

  const session = getRoofCheckLifecycleSession();
  const gate = document.createElement('section');
  gate.className = 'roofLeadGate';
  gate.innerHTML = `
    <h3>לפני שמתחילים</h3>
    <p>הזינו מספר טלפון תקין ואשרו את השמירה. רק לאחר שני השלבים ייפתח כרטיס ליד.</p>
    <div class="roofLeadGateFields">
      <input type="tel" inputmode="tel" autocomplete="tel" value="${escapeAttribute(session.phone)}" placeholder="מספר טלפון" data-lifecycle-phone />
      <label class="roofLeadGateConsent"><input type="checkbox" data-lifecycle-consent ${session.consent ? 'checked' : ''} /><span>אני מאשר/ת ל-Solatrix לשמור את נתוני הבדיקה וליצור איתי קשר בנוגע לתוצאות.</span></label>
    </div>
    <p class="roofLeadGateStatus" data-lifecycle-status></p>`;

  const fieldGroup = addressInput.closest('.fieldGroup');
  card.insertBefore(gate, fieldGroup || addressInput);
  const phoneInput = gate.querySelector('[data-lifecycle-phone]');
  const consentInput = gate.querySelector('[data-lifecycle-consent]');
  const handleChange = () => {
    const phone = phoneInput.value.trim();
    const consent = consentInput.checked;
    const previous = getRoofCheckLifecycleSession();
    updateRoofCheckLifecycleSession({ phone, consent, verified: previous.verified && previous.phone === phone && consent });
    applyGateState(gate);
    window.clearTimeout(startTimer);
    if (isValidIsraeliPhone(phone) && consent && !getRoofCheckLifecycleSession().verified) {
      startTimer = window.setTimeout(() => startLead(gate, phone), 450);
    }
  };
  phoneInput.addEventListener('input', handleChange);
  consentInput.addEventListener('change', handleChange);
  applyGateState(gate);
}

async function startLead(gate, phone, lifecycleAction = 'start') {
  setGateStatus(gate, 'שומרים את התחלת הבדיקה…', 'saving');
  try {
    await syncRoofCheckLead({
      phone,
      consent: true,
      lifecycleAction,
      calculatorStep: 'address',
      ...calculatorSnapshot()
    });
    applyGateState(gate);
    scheduleActivity();
  } catch {
    updateRoofCheckLifecycleSession({ verified: false });
    setGateStatus(gate, 'לא הצלחנו לשמור. בדקו את החיבור ונסו שוב.', 'error');
    toggleAddressNext(false);
  }
}

function applyGateState(gate) {
  const session = getRoofCheckLifecycleSession();
  const valid = isValidIsraeliPhone(session.phone);
  if (session.verified && valid && session.consent) {
    setGateStatus(gate, 'הפרטים נשמרו. אפשר להמשיך לכתובת.', 'ready');
    toggleAddressNext(true);
  } else {
    setGateStatus(gate, valid || !session.phone ? '' : 'יש להזין מספר טלפון ישראלי תקין.', valid || !session.phone ? '' : 'error');
    toggleAddressNext(false);
  }
}

function toggleAddressNext(enabled) {
  const addressInput = document.querySelector('[data-field="address"]');
  const card = addressInput?.closest('.focusCard');
  const next = card?.querySelector('[data-action="next"]');
  if (next) {
    next.disabled = !enabled;
    next.setAttribute('aria-disabled', String(!enabled));
  }
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

function setGateStatus(gate, message, state) {
  const node = gate?.querySelector('[data-lifecycle-status]');
  if (!node) return;
  node.textContent = message;
  node.dataset.state = state;
}

function serializable(value) {
  try { return value ? JSON.parse(JSON.stringify(value)) : null; } catch { return null; }
}
function escapeAttribute(value) { return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

function applyLifecycle() {
  if (enforceLeadGate()) return;
  enhancePhoneGate();
  resumeStoredLead();
  scheduleActivity();
}

function enforceLeadGate() {
  const step = currentStep();
  if (step === 'start' || step === 'address') return false;
  const session = getRoofCheckLifecycleSession();
  if (session.verified && session.consent && isValidIsraeliPhone(session.phone)) return false;
  history.replaceState({ step: 1 }, '', '/roof-check/address');
  window.dispatchEvent(new PopStateEvent('popstate', { state: { step: 1 } }));
  return true;
}

const observer = new MutationObserver(applyLifecycle);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', applyLifecycle);
window.addEventListener('popstate', applyLifecycle);
window.addEventListener('pageshow', applyLifecycle);
window.addEventListener('solatrix:roof-geometry-changed', scheduleActivity);
setTimeout(applyLifecycle, 0);

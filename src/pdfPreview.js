import './reportTypographyPatch.js';
import { createRoofCheckPdf } from './reportPdfClient.js';

const viewer = document.querySelector('#viewer');
const download = document.querySelector('#download');
const refresh = document.querySelector('#refresh');
const status = document.querySelector('#status');
let objectUrl = '';

const sample = {
  customer: { name: 'איגור רובין', phone: '052-513-8899' },
  reportData: {
    roofData: {
      address: 'ויצו 24, חיפה',
      roofType: 'residential',
      monthlyBill: 850,
      urbanEligible: true,
      urbanLocality: 'חיפה',
      surfaces: [{ area: 162 }]
    },
    calculationModel: {
      address: 'ויצו 24, חיפה',
      roofArea: 162,
      usableArea: 133,
      annualProduction: 37125,
      annualSavings: 21533,
      costBeforeVat: 65250,
      costWithVat: 76995,
      paybackWithVat: 3.6,
      panels: 35,
      monthlyBill: 850,
      isCommercial: false,
      urbanEligible: true,
      urbanLocality: 'חיפה'
    },
    calculation: {}
  }
};

function setDownloadReady(ready) {
  download.style.pointerEvents = ready ? 'auto' : 'none';
  download.style.opacity = ready ? '1' : '0.45';
  if (!ready) download.removeAttribute('href');
}

async function render() {
  status.textContent = 'מייצר PDF…';
  refresh.disabled = true;
  setDownloadReady(false);
  viewer.removeAttribute('src');

  try {
    const blob = await createRoofCheckPdf(sample);
    if (!(blob instanceof Blob) || blob.size < 1000) throw new Error('Generated PDF is empty.');

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    viewer.src = objectUrl;
    download.href = objectUrl;
    setDownloadReady(true);
    status.textContent = 'התצוגה מוכנה';
  } catch (error) {
    console.error('PDF preview failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    status.textContent = `שגיאה ביצירת התצוגה: ${message}`;
  } finally {
    refresh.disabled = false;
  }
}

refresh.addEventListener('click', render);
window.addEventListener('beforeunload', () => objectUrl && URL.revokeObjectURL(objectUrl));
setDownloadReady(false);
render();